"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Copy, Check, Sparkles, Loader2, Trophy } from "lucide-react";
import QRCode from "react-qr-code";
import {
  useSignAndExecuteTransaction,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";

import { Navbar } from "../components/Navbar";
import { PACKAGE_ID, MODULE_NAME, CREATE_GAME_FN } from "../constants";
import { generateName, truncateAddress } from "../utils/generateName";

type Phase = "idle" | "generating" | "signing";

/* ───────────────────── host / lobby page ──────────────────── */

export default function HostPage() {
  const [topic, setTopic] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [gameId, setGameId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState(0);
  const [leaderboard, setLeaderboard] = useState<
    { address: string; score: number }[]
  >([]);

  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecuteTransaction } = useSignAndExecuteTransaction({
    execute: async ({ bytes, signature }) =>
      await suiClient.executeTransactionBlock({
        transactionBlock: bytes,
        signature,
        options: {
          showEffects: true,
          showObjectChanges: true,
        },
      }),
  });

  const isBusy = phase !== "idle";

  /* ── Join URL for QR / clipboard ── */
  const joinUrl =
    typeof window !== "undefined" && gameId
      ? `${window.location.origin}/play?game=${gameId}`
      : "";

  /* ── Unified: AI generate → on-chain create → save to DB ── */
  const handleGenerateAndCreate = useCallback(async () => {
    if (!currentAccount || !topic.trim() || isBusy) return;
    setPhase("generating");
    setError(null);

    // 1. Generate questions via Gemini
    let questions: {
      question_text: string;
      options: string[];
      correct_index: number;
    }[];
    try {
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      });
      if (!genRes.ok) {
        const err = (await genRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(err.error ?? `Generation failed (${genRes.status})`);
      }
      questions = await genRes.json();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate questions",
      );
      setPhase("idle");
      return;
    }

    // 2. Create on-chain game session
    setPhase("signing");

    const tx = new Transaction();
    tx.moveCall({
      target: `${PACKAGE_ID}::${MODULE_NAME}::${CREATE_GAME_FN}`,
      arguments: [tx.pure.bool(false)],
    });

    signAndExecuteTransaction(
      { transaction: tx },
      {
        onSuccess: async (result) => {
          /* Primary: filter objectChanges for ::game::GameSession */
          const changes = result.objectChanges ?? [];
          const sessionObj = changes.find(
            (o) =>
              o.type === "created" &&
              "objectType" in o &&
              typeof o.objectType === "string" &&
              o.objectType.includes("::game::GameSession"),
          );

          /* Fallback: first shared object from effects.created */
          const effectsCreated = (
            result.effects as
              | {
                  created?: {
                    owner:
                      | string
                      | { Shared?: unknown }
                      | { AddressOwner?: string };
                    reference: { objectId: string };
                  }[];
                }
              | undefined
          )?.created;
          const sharedFromEffects = effectsCreated?.find(
            (o) =>
              typeof o.owner === "object" &&
              o.owner !== null &&
              "Shared" in o.owner,
          );

          const id =
            (sessionObj && "objectId" in sessionObj
              ? sessionObj.objectId
              : undefined) ??
            sharedFromEffects?.reference.objectId ??
            (
              changes.find((o) => o.type === "created") as
                | { objectId?: string }
                | undefined
            )?.objectId ??
            null;

          // 3. Save game + questions to DB so arena/play pages serve them
          if (id) {
            try {
              const saveRes = await fetch("/api/arena/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ onchain_game_id: id, questions }),
              });
              if (!saveRes.ok) {
                const err = (await saveRes.json().catch(() => ({}))) as {
                  error?: string;
                };
                console.error("Failed to save game to DB:", err.error);
              }
            } catch (err) {
              console.error("Failed to save game to DB:", err);
            }
          }

          setGameId(id);
          setPhase("idle");
        },
        onError: (err) => {
          console.error("Create game failed:", err);
          setError(err.message ?? "Transaction failed");
          setPhase("idle");
        },
      },
    );
  }, [currentAccount, topic, isBusy, signAndExecuteTransaction]);

  /* ── Copy link ── */
  const handleCopyLink = () => {
    navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* ── Poll for unique players via AnswerSubmitted events ── */
  useEffect(() => {
    if (!gameId) return;

    const poll = async () => {
      try {
        const { data } = await suiClient.queryEvents({
          query: {
            MoveEventType: `${PACKAGE_ID}::${MODULE_NAME}::AnswerSubmitted`,
          },
        });

        const matching = data.filter(
          (e) => (e.parsedJson as { game_id: string })?.game_id === gameId,
        );

        // Player count
        const uniquePlayers = new Set(
          matching.map((e) => (e.parsedJson as { player: string }).player),
        );
        setPlayerCount(uniquePlayers.size);

        // Leaderboard: highest score per unique player
        const scoreMap = new Map<string, number>();
        for (const e of matching) {
          const parsed = e.parsedJson as { player: string; score: number };
          const prev = scoreMap.get(parsed.player) ?? 0;
          if (parsed.score > prev) scoreMap.set(parsed.player, parsed.score);
        }
        const sorted = Array.from(scoreMap.entries())
          .map(([address, score]) => ({ address, score }))
          .sort((a, b) => b.score - a.score);
        setLeaderboard(sorted);
      } catch (err) {
        console.error("[host] Failed to query player events:", err);
      }
    };

    poll();
    const id = setInterval(poll, 3000);
    return () => clearInterval(id);
  }, [gameId, suiClient]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f] text-white">
      {/* ── Animated Cyberpunk Grid Background ── */}
      <div className="absolute inset-0 opacity-[0.03]">
        <motion.div
          className="absolute inset-0"
          animate={{ backgroundPosition: ["0px 0px", "50px 50px"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,217,255,0.06) 2px, transparent 2px),
              linear-gradient(90deg, rgba(0,217,255,0.06) 2px, transparent 2px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* ── Floating Glowing Orbs ── */}
      <motion.div
        animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-20 w-96 h-96 bg-[#00d9ff] opacity-20 blur-[120px] rounded-full"
      />
      <motion.div
        animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-20 w-96 h-96 bg-[#ffd700] opacity-20 blur-[120px] rounded-full"
      />

      {/* ── Content Stack ── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-12">
          {/* ── Title ── */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center mb-10"
          >
            <h1
              className="text-5xl sm:text-7xl tracking-wider mb-4 bg-linear-to-r from-[#00d9ff] via-white to-[#00d9ff] bg-clip-text text-transparent"
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 900,
              }}
            >
              ONECHAIN
            </h1>
            <p
              className="text-xl sm:text-2xl text-[#8b8b9a] tracking-[0.3em]"
              style={{
                fontFamily: "var(--font-rajdhani), sans-serif",
                fontWeight: 600,
              }}
            >
              GAME LOBBY
            </p>
          </motion.div>

          {/* ── Two-Column Layout ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 w-full max-w-4xl">
            {/* ━━━━━━ Left Column: QR Code ━━━━━━ */}
            <div className="flex flex-col items-center gap-4">
              {gameId ? (
                /* ── Post-creation: QR Code ── */
                <>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    className="relative"
                  >
                    {/* Glow behind QR */}
                    <div className="absolute inset-0 bg-[#00d9ff] opacity-20 blur-xl rounded-lg" />

                    <div
                      className="relative bg-white p-6 rounded-lg border-4 border-[#00d9ff]"
                      style={{
                        boxShadow: "0 0 30px rgba(0, 217, 255, 0.3)",
                      }}
                    >
                      <QRCode
                        value={joinUrl}
                        size={220}
                        level="H"
                        fgColor="#0a0a0f"
                        bgColor="#ffffff"
                      />
                    </div>

                    {/* Gold corner accents */}
                    <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-[#ffd700]" />
                    <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-[#ffd700]" />
                    <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-[#ffd700]" />
                    <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-[#ffd700]" />
                  </motion.div>

                  <p
                    className="text-lg text-white tracking-wide text-center"
                    style={{
                      fontFamily: "var(--font-rajdhani), sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    SCAN TO JOIN ON MOBILE
                  </p>

                  {/* Copy Link Button */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleCopyLink}
                    className="w-full max-w-[320px] bg-[#2a2a3e] border-2 border-[#00d9ff] rounded-lg px-6 py-3 flex items-center justify-center gap-3 hover:bg-[#00d9ff] hover:text-[#0a0a0f] transition-all cursor-pointer"
                    style={{ boxShadow: "0 0 20px rgba(0, 217, 255, 0.2)" }}
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span
                          style={{
                            fontFamily: "var(--font-rajdhani), sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          LINK COPIED!
                        </span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5" />
                        <span
                          style={{
                            fontFamily: "var(--font-rajdhani), sans-serif",
                            fontWeight: 700,
                          }}
                        >
                          COPY INVITE LINK
                        </span>
                      </>
                    )}
                  </motion.button>
                </>
              ) : (
                /* ── Pre-creation: QR Placeholder ── */
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex flex-col items-center gap-6 w-full"
                >
                  <div
                    className="relative bg-[#1a1a2e] border-2 border-[#2a2a3e] rounded-lg p-8 w-full max-w-90 flex flex-col items-center"
                    style={{ boxShadow: "0 0 20px rgba(0, 217, 255, 0.1)" }}
                  >
                    {/* Decorative QR placeholder */}
                    <div className="relative">
                      <div className="w-55 h-55 rounded-lg border-4 border-dashed border-[#2a2a3e] flex items-center justify-center">
                        <div className="text-center">
                          <div
                            className="text-6xl mb-2 text-[#00d9ff] opacity-30"
                            style={{
                              fontFamily: "var(--font-orbitron), sans-serif",
                              fontWeight: 900,
                            }}
                          >
                            QR
                          </div>
                          <p
                            className="text-sm text-[#8b8b9a]"
                            style={{
                              fontFamily: "var(--font-rajdhani), sans-serif",
                              fontWeight: 500,
                            }}
                          >
                            GENERATE & CREATE
                            <br />
                            TO GET QR CODE
                          </p>
                        </div>
                      </div>
                      {/* Corner accents (dimmed) */}
                      <div className="absolute -top-2 -left-2 w-6 h-6 border-t-4 border-l-4 border-[#ffd700]/30" />
                      <div className="absolute -top-2 -right-2 w-6 h-6 border-t-4 border-r-4 border-[#ffd700]/30" />
                      <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-4 border-l-4 border-[#ffd700]/30" />
                      <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-4 border-r-4 border-[#ffd700]/30" />
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* ━━━━━━ Right Column: AI Quiz Generator + Stats ━━━━━━ */}
            <div className="flex flex-col gap-4">
              {/* AI Quiz Generator */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="bg-[#1a1a2e] border-2 border-[#2a2a3e] rounded-lg p-6"
                style={{ boxShadow: "0 0 20px rgba(0, 217, 255, 0.1)" }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-[#ffd700]" />
                  <h2
                    className="text-xl sm:text-2xl text-white"
                    style={{
                      fontFamily: "var(--font-orbitron), sans-serif",
                      fontWeight: 700,
                    }}
                  >
                    AI QUIZ GENERATOR
                  </h2>
                </div>

                <div className="space-y-4">
                  {/* Topic Input */}
                  <div>
                    <label
                      className="block text-sm text-[#8b8b9a] mb-2"
                      style={{
                        fontFamily: "var(--font-rajdhani), sans-serif",
                        fontWeight: 600,
                      }}
                    >
                      QUIZ TOPIC
                    </label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Enter quiz topic (e.g., Web3, Blockchain, DeFi)"
                      disabled={isBusy || !!gameId}
                      className="w-full bg-[#0a0a0f] border-2 border-[#2a2a3e] rounded-lg px-4 py-3 text-white placeholder-[#8b8b9a]/50 focus:border-[#00d9ff] focus:outline-none transition-colors disabled:opacity-50"
                      style={{
                        fontFamily: "var(--font-rajdhani), sans-serif",
                        fontWeight: 500,
                      }}
                    />
                  </div>

                  {/* GENERATE & CREATE GAME — unified button */}
                  <motion.button
                    whileHover={
                      !isBusy && currentAccount && topic.trim() && !gameId
                        ? { scale: 1.02 }
                        : {}
                    }
                    whileTap={
                      !isBusy && currentAccount && topic.trim() && !gameId
                        ? { scale: 0.98 }
                        : {}
                    }
                    onClick={() => void handleGenerateAndCreate()}
                    disabled={
                      !currentAccount || !topic.trim() || isBusy || !!gameId
                    }
                    className="w-full bg-linear-to-r from-[#ffd700] to-[#ff8800] text-[#0a0a0f] rounded-lg px-6 py-4 flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    style={{
                      fontFamily: "var(--font-orbitron), sans-serif",
                      fontWeight: 700,
                      boxShadow:
                        currentAccount && topic.trim() && !gameId
                          ? "0 0 30px rgba(255, 215, 0, 0.3)"
                          : "none",
                    }}
                  >
                    {phase === "generating" ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          <Sparkles className="w-5 h-5" />
                        </motion.div>
                        <span>GENERATING QUESTIONS...</span>
                      </>
                    ) : phase === "signing" ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                        >
                          <Loader2 className="w-5 h-5" />
                        </motion.div>
                        <span>CREATING ON-CHAIN...</span>
                      </>
                    ) : gameId ? (
                      <>
                        <Check className="w-5 h-5" />
                        <span>GAME CREATED</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        <span>GENERATE & CREATE GAME</span>
                      </>
                    )}
                  </motion.button>

                  {!currentAccount && (
                    <p
                      className="text-sm text-[#ffd700] text-center"
                      style={{
                        fontFamily: "var(--font-rajdhani), sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      CONNECT WALLET TO CREATE A GAME
                    </p>
                  )}

                  {error && (
                    <p
                      className="text-sm text-[#ff1744] text-center"
                      style={{
                        fontFamily: "var(--font-rajdhani), sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      {error}
                    </p>
                  )}
                </div>
              </motion.div>

              {/* Stats Panel */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="bg-[#1a1a2e] border-2 border-[#2a2a3e] rounded-lg p-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <p
                      className="text-sm text-[#8b8b9a] mb-1"
                      style={{
                        fontFamily: "var(--font-rajdhani), sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      PLAYERS
                    </p>
                    <p
                      className="text-4xl text-[#00d9ff]"
                      style={{
                        fontFamily: "var(--font-orbitron), sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {playerCount}
                    </p>
                  </div>
                  <div className="text-center">
                    <p
                      className="text-sm text-[#8b8b9a] mb-1"
                      style={{
                        fontFamily: "var(--font-rajdhani), sans-serif",
                        fontWeight: 500,
                      }}
                    >
                      STATUS
                    </p>
                    <motion.p
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="text-xl text-[#ffd700]"
                      style={{
                        fontFamily: "var(--font-orbitron), sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      {gameId ? "LOBBY" : "WAITING"}
                    </motion.p>
                  </div>
                </div>
              </motion.div>

              {/* ━━━━━━ LIVE LEADERBOARD ━━━━━━ */}
              {gameId && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  className="bg-[#1a1a2e] border-2 border-[#2a2a3e] rounded-lg p-6"
                  style={{ boxShadow: "0 0 20px rgba(255, 215, 0, 0.1)" }}
                >
                  {/* Header */}
                  <div className="flex items-center gap-3 mb-4">
                    <motion.div
                      animate={{ rotate: [0, 360] }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    >
                      <Trophy className="w-6 h-6 text-[#ffd700]" />
                    </motion.div>
                    <h2
                      className="text-xl sm:text-2xl bg-linear-to-r from-[#ffd700] via-white to-[#00d9ff] bg-clip-text text-transparent"
                      style={{
                        fontFamily: "var(--font-orbitron), sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      LIVE LEADERBOARD
                    </h2>
                    <motion.span
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="ml-auto text-xs px-2 py-0.5 rounded bg-[#ffd700]/20 text-[#ffd700] border border-[#ffd700]/40"
                      style={{
                        fontFamily: "var(--font-orbitron), sans-serif",
                        fontWeight: 700,
                      }}
                    >
                      LIVE
                    </motion.span>
                  </div>

                  {/* Rows */}
                  <div className="space-y-2">
                    <AnimatePresence mode="popLayout">
                      {leaderboard.length === 0 ? (
                        <motion.p
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="text-center text-[#8b8b9a] py-6"
                          style={{
                            fontFamily: "var(--font-rajdhani), sans-serif",
                            fontWeight: 500,
                          }}
                        >
                          Waiting for players...
                        </motion.p>
                      ) : (
                        leaderboard.map((entry, idx) => {
                          const rank = idx + 1;
                          const rankStyles: Record<
                            number,
                            { border: string; glow: string; bg: string }
                          > = {
                            1: {
                              border: "#ffd700",
                              glow: "rgba(255,215,0,0.35)",
                              bg: "#ffd700",
                            },
                            2: {
                              border: "#c0c0c0",
                              glow: "rgba(192,192,192,0.3)",
                              bg: "#c0c0c0",
                            },
                            3: {
                              border: "#cd7f32",
                              glow: "rgba(205,127,50,0.3)",
                              bg: "#cd7f32",
                            },
                          };
                          const rs = rankStyles[rank];
                          const playerName = generateName(entry.address);
                          const truncAddr = truncateAddress(entry.address);

                          return (
                            <motion.div
                              layout
                              key={entry.address}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, x: 20 }}
                              transition={{
                                type: "spring",
                                stiffness: 500,
                                damping: 50,
                              }}
                              className="flex items-center gap-3 rounded-lg px-4 py-3 border-2"
                              style={{
                                borderColor: rs?.border ?? "#2a2a3e",
                                background: rs
                                  ? `linear-gradient(90deg, ${rs.glow}, transparent)`
                                  : "#0a0a0f",
                                boxShadow: rs ? `0 0 18px ${rs.glow}` : "none",
                              }}
                            >
                              {/* Rank badge */}
                              <motion.div
                                animate={
                                  rs
                                    ? {
                                        scale: [1, 1.15, 1],
                                        rotate: [0, 4, -4, 0],
                                      }
                                    : {}
                                }
                                transition={{
                                  duration: 2,
                                  repeat: Infinity,
                                }}
                                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 border-2"
                                style={{
                                  backgroundColor: rs?.bg ?? "#2a2a3e",
                                  borderColor: rs ? "#ffffff" : "#2a2a3e",
                                  boxShadow: rs
                                    ? `0 0 12px ${rs.glow}`
                                    : "none",
                                }}
                              >
                                <span
                                  className="text-sm"
                                  style={{
                                    fontFamily:
                                      "var(--font-orbitron), sans-serif",
                                    fontWeight: 900,
                                    color: rs ? "#0a0a0f" : "#ffffff",
                                  }}
                                >
                                  {rank}
                                </span>
                              </motion.div>

                              {/* Player name + address */}
                              <div className="flex-1 min-w-0">
                                <span
                                  className="block truncate text-base"
                                  style={{
                                    fontFamily:
                                      "var(--font-rajdhani), sans-serif",
                                    fontWeight: 700,
                                    color: rs ? "#ffffff" : "#c0c0d0",
                                  }}
                                >
                                  {playerName}
                                </span>
                                <span
                                  className="block truncate text-[11px]"
                                  style={{
                                    fontFamily: "monospace",
                                    fontWeight: 400,
                                    color: "#8b8b9a",
                                    opacity: 0.6,
                                  }}
                                >
                                  {truncAddr}
                                </span>
                              </div>

                              {/* Score */}
                              <motion.span
                                key={entry.score}
                                initial={{ scale: 1.2, color: "#00d9ff" }}
                                animate={{ scale: 1, color: "#ffd700" }}
                                transition={{ duration: 0.3 }}
                                className="text-lg tabular-nums"
                                style={{
                                  fontFamily:
                                    "var(--font-orbitron), sans-serif",
                                  fontWeight: 700,
                                }}
                              >
                                {entry.score.toLocaleString()}
                              </motion.span>
                            </motion.div>
                          );
                        })
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
