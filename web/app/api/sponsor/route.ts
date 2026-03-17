import { NextRequest, NextResponse } from "next/server";
import { Transaction } from "@mysten/sui/transactions";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

/* ═══════════════════════════════════════════════════════════════════════════
 * MODULE-LEVEL INIT — runs once on serverless cold start
 * ═══════════════════════════════════════════════════════════════════════════ */

/** RPC endpoint — defaults to OneChain testnet, overridable via env */
const RPC_URL = process.env.RPC_URL || "https://rpc-testnet.onelabs.cc:443";

/** Single unified client — used for both RPC queries and tx.build() */
const suiClient = new SuiJsonRpcClient({
  url: RPC_URL,
  network: "onechain-testnet",
});

/**
 * Load the sponsor Ed25519Keypair from an environment variable.
 * Supports two formats:
 *  1. Bech32  — `suiprivkey1qp...`  (standard Sui/OneChain export format)
 *  2. Base64  — raw 32-byte secret key encoded in base64
 */
function loadSponsorKeypair(): Ed25519Keypair {
  const key = process.env.SPONSOR_PRIVATE_KEY?.trim();
  if (!key) {
    throw new Error("SPONSOR_PRIVATE_KEY environment variable is not set");
  }

  // Try Bech32 (suiprivkey1...) first, fall back to raw base64
  try {
    const { secretKey } = decodeSuiPrivateKey(key);
    return Ed25519Keypair.fromSecretKey(secretKey);
  } catch {
    const raw = Uint8Array.from(Buffer.from(key, "base64"));
    return Ed25519Keypair.fromSecretKey(raw.length === 33 ? raw.slice(1) : raw);
  }
}

let sponsorKeypair: Ed25519Keypair | null = null;
let sponsorAddress: string | null = null;
let initError: string | null = null;

try {
  sponsorKeypair = loadSponsorKeypair();
  sponsorAddress = sponsorKeypair.toSuiAddress();
  console.log(`[sponsor] Loaded sponsor address: ${sponsorAddress}`);
} catch (err) {
  initError =
    err instanceof Error ? err.message : "Failed to load sponsor keypair";
  console.error(`[sponsor] Init error: ${initError}`);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * POST /api/sponsor
 *
 * Accepts a client-built Transaction (serialized as base64) and the player's
 * address. Signs the transaction as the gas sponsor and returns the final
 * bytes + sponsor signature. The client then co-signs with the player's
 * wallet and submits both signatures via executeTransactionBlock.
 *
 * Request body:
 *   { txBytes: string, sender: string }
 *
 * Response (200):
 *   { txBytes: string, sponsorSignature: string }
 *
 * Error responses:
 *   400 — missing / invalid params
 *   500 — sponsor key not configured or internal error
 *   502 — sponsor wallet has no gas coins
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function POST(request: NextRequest) {
  // ── Fail fast if sponsor key was not loaded ──────────────────────────────
  if (!sponsorKeypair || !sponsorAddress) {
    return NextResponse.json(
      { error: initError || "Sponsor key not configured" },
      { status: 500 },
    );
  }

  try {
    // 1. Parse & validate request body ─────────────────────────────────────
    const body = await request.json();
    const { txBytes, sender } = body as {
      txBytes?: string;
      sender?: string;
    };

    if (!txBytes || typeof txBytes !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid txBytes (expected base64 string)" },
        { status: 400 },
      );
    }

    if (!sender || typeof sender !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid sender address" },
        { status: 400 },
      );
    }

    // 2. Reconstruct the Transaction from the client-serialized data ───────
    const tx = Transaction.fromKind(fromBase64(txBytes));

    // 3. Set sender (player) & gas owner (sponsor) ─────────────────────────
    //    sender  = player address → ctx.sender() in Move resolves to player
    //    gasOwner = sponsor address → sponsor pays all gas fees
    tx.setSender(sender);
    tx.setGasOwner(sponsorAddress);

    // 4. Fetch sponsor's gas coins for payment ─────────────────────────────
    const { data: coins } = await suiClient.getCoins({
      owner: sponsorAddress,
    });

    if (!coins || coins.length === 0) {
      return NextResponse.json(
        {
          error:
            "Sponsor wallet has no gas coins. Please fund the sponsor address.",
        },
        { status: 502 },
      );
    }

    // Pick the coin with the highest balance to minimize "insufficient gas"
    const sorted = [...coins].sort(
      (a, b) => Number(b.balance) - Number(a.balance),
    );
    const gasPayment = sorted.slice(0, 1).map((coin) => ({
      objectId: coin.coinObjectId,
      version: coin.version,
      digest: coin.digest,
    }));

    tx.setGasPayment(gasPayment);
    tx.setGasBudget(50_000_000); // 50 M MIST — generous for a Move call

    // 4b. Pin expiration to current epoch (OneChain doesn't support multi-epoch ranges)
    const { epoch } = await suiClient.getLatestSuiSystemState();
    tx.setExpiration({ Epoch: Number(epoch) });

    // 5. Build the complete transaction bytes ──────────────────────────────
    const builtBytes = await tx.build({ client: suiClient });

    // 6. Sign with the sponsor keypair ─────────────────────────────────────
    const { signature } = await sponsorKeypair.signTransaction(builtBytes);

    // 7. Return bytes + sponsor signature for client co-signing ────────────
    return NextResponse.json({
      txBytes: toBase64(builtBytes), // base64-encoded final transaction bytes
      sponsorSignature: signature, // sponsor's Ed25519 signature (base64)
    });
  } catch (err) {
    console.error("[sponsor] Error:", err);
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
