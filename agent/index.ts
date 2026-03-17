import { SuiClient } from "@mysten/sui.js/client";
import { TransactionBlock } from "@mysten/sui.js/transactions";
import { Ed25519Keypair } from "@mysten/sui.js/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui.js/cryptography";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { TwitterApi } from "twitter-api-v2";
import { Pool } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function requireAnyEnv(keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  throw new Error(
    `Missing required environment variable. Provide one of: ${keys.join(", ")}`,
  );
}

function toLibpqCompatSslUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.set("sslmode", "require");
    url.searchParams.set("uselibpqcompat", "true");
    return url.toString();
  } catch {
    return connectionString;
  }
}

// 1. Initialize Clients
const DATABASE_URL = requireAnyEnv(["DATABASE_URL", "DIRECT_URL"]);
const DB_SSL_INSECURE =
  (process.env.DB_SSL_INSECURE || "false").toLowerCase() === "true";
const EFFECTIVE_DATABASE_URL = DB_SSL_INSECURE
  ? toLibpqCompatSslUrl(DATABASE_URL)
  : DATABASE_URL;
const pgPool = new Pool({
  connectionString: EFFECTIVE_DATABASE_URL,
  ssl: DB_SSL_INSECURE ? { rejectUnauthorized: false } : undefined,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg(pgPool),
});
const suiClient = new SuiClient({ url: "https://rpc-testnet.onelabs.cc:443" });
const PACKAGE_ID = requireEnv("PACKAGE_ID");
const genAI = new GoogleGenerativeAI(requireEnv("GEMINI_API_KEY"));
const GAS_COIN_TYPE = process.env.GAS_COIN_TYPE?.trim() || "0x2::oct::OCT";
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemma-3-1b-it";
const GEMINI_MODEL_FALLBACKS = (
  process.env.GEMINI_MODEL_FALLBACKS ||
  "gemini-2.0-flash-lite,gemini-2.0-flash-001,gemini-flash-lite-latest"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);
const GEMINI_RETRY_COUNT = Number(process.env.GEMINI_RETRY_COUNT || "2");
const GEMINI_RETRY_BASE_MS = Number(process.env.GEMINI_RETRY_BASE_MS || "1500");

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getGeminiErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeStatus = (error as { status?: unknown }).status;
  if (typeof maybeStatus === "number") return maybeStatus;

  const message = (error as { message?: unknown }).message;
  if (typeof message !== "string") return undefined;
  const matched = message.match(/\[(\d{3})\s/);
  return matched ? Number(matched[1]) : undefined;
}

async function announceGame(gameId: string): Promise<void> {
  const discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  const twitterApiKey = process.env.TWITTER_API_KEY?.trim();

  if (discordWebhookUrl) {
    try {
      const content =
        `🚨 New Oracle Match Live! 🚨\n\n` +
        `🧠 Topic: Web3 & DeFi\n` +
        `🏆 Prize Pool: Sponsored\n` +
        `🎮 Play Now: https://onetrivia.vercel.app/arena\n\n` +
        `*Agent Game ID: ${gameId}*`;

      const discordRes = await fetch(discordWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          embeds: [
            {
              title: "New Oracle Match Live",
              description: content,
              color: 0x00c2ff,
              footer: {
                text: `Agent Game ID: ${gameId}`,
              },
            },
          ],
        }),
      });

      if (!discordRes.ok) {
        const errorText = await discordRes.text();
        throw new Error(
          `Discord webhook failed (${discordRes.status}): ${errorText}`,
        );
      }

      console.log("📣 Discord broadcast sent.");
    } catch (error) {
      console.error("⚠️ Discord broadcast failed:", error);
    }
  }

  if (twitterApiKey) {
    try {
      const twitterApiSecret = process.env.TWITTER_API_SECRET?.trim();
      const twitterAccessToken = process.env.TWITTER_ACCESS_TOKEN?.trim();
      const twitterAccessSecret = process.env.TWITTER_ACCESS_SECRET?.trim();

      if (!twitterApiSecret || !twitterAccessToken || !twitterAccessSecret) {
        throw new Error(
          "Missing one or more Twitter credentials: TWITTER_API_SECRET, TWITTER_ACCESS_TOKEN, TWITTER_ACCESS_SECRET",
        );
      }

      const twitterClient = new TwitterApi({
        appKey: twitterApiKey,
        appSecret: twitterApiSecret,
        accessToken: twitterAccessToken,
        accessSecret: twitterAccessSecret,
      });

      await twitterClient.v2.tweet(
        "🚨 A new #OneChain Arena Match has been generated by the Oracle!\n\n" +
          "🧠 Topic: Web3 & DeFi\n" +
          "🎮 Play gasless: https://onetrivia.vercel.app/arena\n\n" +
          "#GameFi #Web3 #AI",
      );

      console.log("📣 X broadcast sent.");
    } catch (error) {
      console.error("⚠️ X broadcast failed:", error);
    }
  }
}

// 2. Safely Load Agent Wallet (Handles both suiprivkey and hex)
function getAgentKeypair(): Ed25519Keypair {
  const key = requireEnv("AGENT_PRIVATE_KEY");
  try {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch {
    let hex = key.startsWith("0x") ? key.slice(2) : key;
    const raw = Uint8Array.from(Buffer.from(hex, "hex"));
    return Ed25519Keypair.fromSecretKey(raw.length === 33 ? raw.slice(1) : raw);
  }
}

const agentKeypair = getAgentKeypair();
const agentAddress = agentKeypair.toSuiAddress();

if (DB_SSL_INSECURE) {
  console.warn(
    "⚠️ DB_SSL_INSECURE=true: TLS certificate verification is disabled for the database connection.",
  );
}

console.log("=========================================");
console.log("🤖 THE ORACLE AGENT IS ONLINE");
console.log("Wallet Address:", agentAddress);
console.log("=========================================\n");

// 3. The Brain: Generate Trivia
async function generateTrivia() {
  console.log("🧠 Thinking: Generating Web3 Trivia via Gemini...");
  const prompt = `
    Generate 3 trivia questions about Web3, Blockchain, and DeFi. 
    Make them fun and moderately challenging.
    You MUST respond with ONLY a valid JSON array. No markdown formatting, no backticks.
    Format exactly like this:
    [
      { "question_text": "What does DeFi stand for?", "options": ["Decentralized Finance", "Direct Fiat", "Digital Fees", "Data File"], "correct_index": 0 }
    ]
    Random Seed/Timestamp: ${Date.now()}
  `;

  const modelCandidates = [GEMINI_MODEL, ...GEMINI_MODEL_FALLBACKS].filter(
    (model, index, arr) => arr.indexOf(model) === index,
  );

  const errors: string[] = [];

  for (const model of modelCandidates) {
    const aiModel = genAI.getGenerativeModel({ model });

    for (let attempt = 0; attempt <= GEMINI_RETRY_COUNT; attempt++) {
      try {
        if (attempt > 0) {
          console.log(
            `↻ Retrying Gemini model ${model} (attempt ${attempt + 1})...`,
          );
        }

        const result = await aiModel.generateContent(prompt);
        let text = result.response.text().trim();

        // Clean up markdown if Gemini disobeys instructions
        if (text.startsWith("```json")) text = text.replace("```json", "");
        if (text.startsWith("```")) text = text.replace("```", "");
        if (text.endsWith("```")) text = text.replace(/```$/, "");

        return JSON.parse(text);
      } catch (error) {
        const status = getGeminiErrorStatus(error);
        const message = error instanceof Error ? error.message : String(error);

        if (status === 429 && attempt < GEMINI_RETRY_COUNT) {
          const delayMs = GEMINI_RETRY_BASE_MS * (attempt + 1);
          console.warn(
            `⚠️ Gemini rate-limited on ${model}. Waiting ${delayMs}ms before retry...`,
          );
          await sleep(delayMs);
          continue;
        }

        // 404 usually means this model is not available for the API version/account.
        if (status === 404) {
          errors.push(`${model}: model not available`);
          console.warn(
            `⚠️ Gemini model unavailable: ${model}. Trying next fallback...`,
          );
          break;
        }

        errors.push(`${model}: ${message}`);
        break;
      }
    }
  }

  throw new Error(
    `Failed to generate trivia from Gemini models. Attempts: ${errors.join(" | ")}`,
  );
}

// 4. The Hand: Create Game on OneChain
async function createGameOnChain(): Promise<string> {
  console.log("⛓️  Executing: Creating GameSession on OneChain...");
  const tx = new TransactionBlock();

  tx.moveCall({
    target: `${PACKAGE_ID}::game::create_game`,
    arguments: [tx.pure(true)], // true = is_agent_game
  });

  tx.setGasBudget(100_000_000);
  tx.setGasOwner(agentAddress);

  const gasCoins = await suiClient.getCoins({
    owner: agentAddress,
    coinType: GAS_COIN_TYPE,
    limit: 16,
  });

  if (!gasCoins.data.length) {
    throw new Error(
      `No gas coins found for type ${GAS_COIN_TYPE} at ${agentAddress}`,
    );
  }

  tx.setGasPayment(
    gasCoins.data.map((coin) => ({
      objectId: coin.coinObjectId,
      digest: coin.digest,
      version: coin.version,
    })),
  );

  const response = await suiClient.signAndExecuteTransactionBlock({
    signer: agentKeypair,
    transactionBlock: tx,
    options: { showEffects: true, showObjectChanges: true },
  });

  // Extract the newly created GameSession ID
  const changes = response.objectChanges || [];
  const sessionObj = changes.find(
    (o: any) =>
      o.type === "created" &&
      (o as any).objectType.includes("::game::GameSession"),
  );

  const fallbackShared = (response.effects as any)?.created?.find(
    (o: any) => o.owner?.Shared,
  );
  const gameId =
    (sessionObj as any)?.objectId || fallbackShared?.reference?.objectId;

  if (gameId) {
    console.log(`✅ Game Created! ID: ${gameId}`);
    return gameId;
  } else {
    throw new Error("Failed to extract GameSession ID from transaction");
  }
}

// 5. The Cycle: Tie it all together
async function runAgentCycle() {
  try {
    console.log(
      `\n--- Starting New Arena Cycle: ${new Date().toLocaleTimeString()} ---`,
    );

    // Step A: Generate Questions
    const questions = await generateTrivia();

    // Step B: Create Game On-Chain
    const onchain_game_id = await createGameOnChain();

    // Step C: Ensure only one active game exists before creating a new one
    const completedGames = await prisma.game.updateMany({
      where: { status: "active" },
      data: { status: "completed" },
    });
    console.log(
      `✅ Marked ${completedGames.count} previous active game(s) as completed.`,
    );

    // Step D: Save everything to Supabase via Prisma
    console.log("💾 Saving game and questions to Database...");
    const dbGame = await prisma.game.create({
      data: {
        onchain_game_id: onchain_game_id,
        status: "active",
        questions: {
          create: questions.map((q: any) => ({
            question_text: q.question_text,
            options: q.options,
            correct_index: q.correct_index,
          })),
        },
      },
    });

    await announceGame(dbGame.id);

    console.log(`🚀 Success! Agent Game [${dbGame.id}] is live in the Arena.`);
    console.log("⏳ Agent going to sleep. Waiting for next cycle...");
  } catch (error) {
    console.error("❌ Agent Cycle Failed:", error);
  }
}

// Run immediately!
runAgentCycle();

// Then run every 1 hour (for production, change as needed)
setInterval(runAgentCycle, 60 * 60 * 1000);
