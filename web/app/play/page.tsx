"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useSuiClient } from "@mysten/dapp-kit";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  KeyRound,
  Copy,
  X,
  ShieldAlert,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { generateName, truncateAddress } from "../utils/generateName";
import {
  ANSWER_COLORS,
  PACKAGE_ID,
  MODULE_NAME,
  SUBMIT_ANSWER_FN,
} from "../constants";

// ── Types ────────────────────────────────────────────────────────────────────

type GameState = "waiting" | "answering" | "result" | "complete";

type AnswerResult = {
  correct: boolean;
  points: number;
  totalScore: number;
};

type ArenaQuestion = {
  id: string;
  game_id: string;
  question_text: string;
  options: string[];
  correct_index: number;
};

type ArenaGame = {
  id: string;
  onchain_game_id: string;
  status: "active" | "completed";
  created_at: string;
  questions: ArenaQuestion[];
};

// ── Page (with Suspense boundary for useSearchParams) ────────────────────────

export default function PlayPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PlayContent />
    </Suspense>
  );
}

// ── Loading fallback ─────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-(--cyber-black)">
      <Loader2 className="w-10 h-10 text-(--cyber-accent) animate-spin" />
    </div>
  );
}

// ── Content (reads URL params) ───────────────────────────────────────────────

function PlayContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("game");

  if (!gameId) {
    return <InvalidGameScreen />;
  }

  return <GameController gameId={gameId} />;
}

// ── Invalid Game Screen ──────────────────────────────────────────────────────

function InvalidGameScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 bg-(--cyber-black) p-6 text-center">
      <CyberpunkGrid />
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 flex flex-col items-center gap-5"
      >
        <div className="w-20 h-20 rounded-full bg-(--error-red)/20 flex items-center justify-center">
          <AlertTriangle className="w-10 h-10 text-(--error-red)" />
        </div>
        <h1 className="text-3xl font-orbitron font-bold text-(--error-red)">
          INVALID GAME CODE
        </h1>
        <p className="text-(--cyber-muted) text-lg max-w-xs">
          Scan a valid QR code or get a link from the host to join a game.
        </p>
        <Link
          href="/"
          className="mt-4 px-8 py-3 rounded-xl font-orbitron font-bold text-lg
                     bg-linear-to-r from-(--cyber-accent) to-(--cyber-accent-dim)
                     text-(--cyber-black) active:scale-95 transition-transform"
        >
          GO HOME
        </Link>
      </motion.div>
    </div>
  );
}

// ── Game Controller (state machine) ──────────────────────────────────────────

function GameController({ gameId }: { gameId: string }) {
  const suiClient = useSuiClient();
  const [burner, setBurner] = useState<Ed25519Keypair | null>(null);
  const [gameState, setGameState] = useState<GameState>("waiting");
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<AnswerResult | null>(null);
  const [activeGame, setActiveGame] = useState<ArenaGame | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [gameLoading, setGameLoading] = useState(true);

  const currentQuestion = activeGame?.questions[currentQuestionIndex] ?? null;

  // Fetch active arena game from backend
  useEffect(() => {
    const load = async () => {
      setGameLoading(true);
      try {
        const res = await fetch("/api/arena/current", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as ArenaGame;
          setActiveGame(data);
        }
      } catch {
        // no active arena game — fall back to URL gameId for transaction target
      } finally {
        setGameLoading(false);
      }
    };
    void load();
  }, []);

  // Initialise invisible burner wallet on mount
  useEffect(() => {
    const stored = localStorage.getItem("onetrivia_burner");
    if (stored) {
      const { secretKey } = decodeSuiPrivateKey(stored);
      setBurner(Ed25519Keypair.fromSecretKey(secretKey));
    } else {
      const kp = new Ed25519Keypair();
      localStorage.setItem("onetrivia_burner", kp.getSecretKey());
      setBurner(kp);
    }
  }, []);

  // Resolve the on-chain game object id: prefer active arena game, fall back to URL param
  const resolveGameObjectId = useCallback(() => {
    return activeGame?.onchain_game_id ?? gameId;
  }, [activeGame, gameId]);

  // Submit answer via sponsored transaction
  const submitAnswer = useCallback(
    async (index: number) => {
      if (sendingIndex !== null) return; // prevent double-tap

      if (!burner) {
        toast.error("Wallet is initialising, please wait…");
        return;
      }

      const gameObjectId = resolveGameObjectId();

      setSendingIndex(index);

      try {
        // 1. Build the Move call (transaction kind only — no gas info)
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::${SUBMIT_ANSWER_FN}`,
          arguments: [
            tx.object(gameObjectId), // GameSession (shared object)
            tx.object("0x6"), // Clock singleton
            tx.pure.u64(index), // answer_index
          ],
        });

        const kindBytes = await tx.build({
          client: suiClient,
          onlyTransactionKind: true,
        });
        const kindB64 = toBase64(kindBytes);

        // 2. Send to sponsor API — returns final bytes + sponsor signature
        const res = await fetch("/api/sponsor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txBytes: kindB64,
            sender: burner.toSuiAddress(),
          }),
        });

        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Network error" }));
          throw new Error(err.error || `HTTP ${res.status}`);
        }

        const { txBytes: signedBytes, sponsorSignature } = await res.json();

        // 3. Player co-signs with burner keypair (no wallet popup)
        const bytesArray = fromBase64(signedBytes);
        const { signature: userSignature } =
          await burner.signTransaction(bytesArray);

        // 4. Execute with both signatures
        await suiClient.executeTransactionBlock({
          transactionBlock: bytesArray,
          signature: [userSignature, sponsorSignature],
        });

        // 5. Update local score (contract always awards 10 pts)
        const newScore = score + 10;
        setLastResult({ correct: true, points: 10, totalScore: newScore });
        setScore(newScore);
        setStreak((s) => s + 1);
        setGameState("result");
        toast.success("Answer Submitted!");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to submit answer",
        );
      } finally {
        setSendingIndex(null);
      }
    },
    [resolveGameObjectId, burner, sendingIndex, suiClient, score],
  );

  // Result → advance to next question (2s delay) or complete state
  useEffect(() => {
    if (gameState !== "result") return;

    const timer = setTimeout(() => {
      if (activeGame) {
        const nextIndex = currentQuestionIndex + 1;
        if (nextIndex >= activeGame.questions.length) {
          setGameState("complete");
        } else {
          setCurrentQuestionIndex(nextIndex);
          setGameState("answering");
        }
      } else {
        // no arena game — return to waiting as before
        setGameState("waiting");
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [gameState, activeGame, currentQuestionIndex]);

  if (gameLoading) {
    return <LoadingScreen />;
  }

  return (
    <div
      className="min-h-dvh flex flex-col bg-(--cyber-black) relative select-none"
      style={{ touchAction: "manipulation", overscrollBehavior: "none" }}
    >
      <CyberpunkGrid />

      {/* Score bar — always visible */}
      <ScoreBar
        score={score}
        streak={streak}
        burnerAddress={burner?.toSuiAddress() ?? null}
        burner={burner}
      />

      {/* Screens */}
      <AnimatePresence mode="wait">
        {gameState === "waiting" && (
          <ScreenWrapper key="waiting">
            <WaitingScreen
              onSimulate={() => setGameState("answering")}
              hasActiveGame={Boolean(activeGame?.questions?.length)}
            />
          </ScreenWrapper>
        )}
        {gameState === "answering" && (
          <ScreenWrapper key={`answering-${currentQuestionIndex}`}>
            <AnsweringScreen
              sendingIndex={sendingIndex}
              onAnswer={submitAnswer}
              currentQuestion={currentQuestion}
              questionIndex={currentQuestionIndex}
              totalQuestions={activeGame?.questions.length ?? 0}
            />
          </ScreenWrapper>
        )}
        {gameState === "result" && (
          <ScreenWrapper key="result">
            <ResultScreen result={lastResult} score={score} />
          </ScreenWrapper>
        )}
        {gameState === "complete" && (
          <ScreenWrapper key="complete">
            <GameCompleteScreen
              score={score}
              totalQuestions={activeGame?.questions.length ?? 0}
            />
          </ScreenWrapper>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Screen transition wrapper ────────────────────────────────────────────────

function ScreenWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="relative z-10 flex-1 flex flex-col"
    >
      {children}
    </motion.div>
  );
}

// ── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  score,
  streak,
  burnerAddress,
  burner,
}: {
  score: number;
  streak: number;
  burnerAddress: string | null;
  burner: Ed25519Keypair | null;
}) {
  const [showModal, setShowModal] = useState(false);
  const playerName = burnerAddress ? generateName(burnerAddress) : "…";
  const truncated = burnerAddress ? truncateAddress(burnerAddress) : "…";

  return (
    <>
      <div
        className="sticky top-0 z-30 flex items-center justify-between px-4 py-3
                   bg-(--cyber-dark)/90 backdrop-blur-sm border-b border-(--cyber-grid)"
      >
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-(--cyber-muted) font-orbitron">
              Score
            </span>
            <span className="text-xl font-orbitron font-bold text-(--winner-gold)">
              {score}
            </span>
          </div>
          <div className="w-px h-8 bg-(--cyber-grid)" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-widest text-(--cyber-muted) font-orbitron">
              Streak
            </span>
            <span className="text-xl font-orbitron font-bold text-(--cyber-accent)">
              {streak}🔥
            </span>
          </div>
        </div>

        {/* Player name + address + export button */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowModal(true)}
            className="p-2 rounded-lg border border-(--cyber-grid) bg-(--cyber-dark)
                       hover:border-(--cyber-accent) transition-colors"
            aria-label="Export wallet"
          >
            <KeyRound className="w-4 h-4 text-(--cyber-muted) hover:text-(--cyber-accent)" />
          </button>
          <div className="flex flex-col items-end bg-(--cyber-dark) px-3 py-1.5 rounded-lg border border-(--cyber-grid)">
            <span className="text-sm font-orbitron font-bold text-(--cyber-accent)">
              {playerName}
            </span>
            <span className="text-[10px] font-mono text-(--cyber-muted)/60">
              {truncated}
            </span>
          </div>
        </div>
      </div>

      {showModal && (
        <ExportWalletModal
          burner={burner}
          burnerAddress={burnerAddress}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}

// ── Export Wallet Modal ──────────────────────────────────────────────────────

function ExportWalletModal({
  burner,
  burnerAddress,
  onClose,
}: {
  burner: Ed25519Keypair | null;
  burnerAddress: string | null;
  onClose: () => void;
}) {
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const copyToClipboard = async (text: string, type: "addr" | "key") => {
    await navigator.clipboard.writeText(text);
    if (type === "addr") {
      setCopiedAddr(true);
      setTimeout(() => setCopiedAddr(false), 2000);
    } else {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const privateKey = burner ? burner.getSecretKey() : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-(--cyber-dark) border border-(--cyber-grid) rounded-2xl p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-orbitron font-bold text-white">
            Your Burner Wallet
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-(--cyber-muted)" />
          </button>
        </div>

        {/* Warning */}
        <div className="flex gap-3 p-3 rounded-xl bg-(--error-red)/10 border border-(--error-red)/30 mb-5">
          <ShieldAlert className="w-5 h-5 text-(--error-red) shrink-0 mt-0.5" />
          <p className="text-xs text-(--cyber-muted) leading-relaxed">
            If you win, funds are sent here. Export this key to a real wallet
            (like <strong className="text-white">OneWallet</strong>) to claim
            them.
          </p>
        </div>

        {/* Public Address */}
        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-widest text-(--cyber-muted) font-orbitron">
            Public Address
          </span>
          <div className="mt-1.5 flex items-center gap-2 p-3 rounded-lg bg-(--cyber-black) border border-(--cyber-grid)">
            <code className="text-xs font-mono text-(--cyber-accent) break-all flex-1 select-all">
              {burnerAddress ?? "…"}
            </code>
            <button
              onClick={() =>
                burnerAddress && copyToClipboard(burnerAddress, "addr")
              }
              className="shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors"
              aria-label="Copy address"
            >
              {copiedAddr ? (
                <CheckCircle className="w-4 h-4 text-[#00e676]" />
              ) : (
                <Copy className="w-4 h-4 text-(--cyber-muted)" />
              )}
            </button>
          </div>
        </div>

        {/* Private Key */}
        <div className="mb-5">
          <span className="text-[10px] uppercase tracking-widest text-(--cyber-muted) font-orbitron">
            Private Key
          </span>
          {!keyRevealed ? (
            <button
              onClick={() => setKeyRevealed(true)}
              className="mt-1.5 w-full flex items-center justify-center gap-2 p-3 rounded-lg
                         border border-(--cyber-grid) bg-(--cyber-black)
                         hover:border-(--error-red) transition-colors"
            >
              <Eye className="w-4 h-4 text-(--error-red)" />
              <span className="text-xs font-orbitron font-bold text-(--error-red)">
                Reveal Private Key
              </span>
            </button>
          ) : (
            <>
              <div className="mt-1.5 flex items-center gap-2 p-3 rounded-lg bg-(--cyber-black) border border-(--error-red)/50">
                <code className="text-xs font-mono text-(--error-red) break-all flex-1 select-all">
                  {privateKey ?? "…"}
                </code>
                <button
                  onClick={() =>
                    privateKey && copyToClipboard(privateKey, "key")
                  }
                  className="shrink-0 p-1.5 rounded hover:bg-white/10 transition-colors"
                  aria-label="Copy private key"
                >
                  {copiedKey ? (
                    <CheckCircle className="w-4 h-4 text-[#00e676]" />
                  ) : (
                    <Copy className="w-4 h-4 text-(--cyber-muted)" />
                  )}
                </button>
              </div>
              <p className="mt-2 text-[10px] text-(--error-red)/80 text-center">
                Never share this key. Anyone with it can drain your wallet.
              </p>
            </>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl font-orbitron font-bold text-sm
                     bg-(--cyber-grid) text-(--cyber-muted)
                     hover:bg-(--cyber-accent) hover:text-(--cyber-black) transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}

// ── Waiting Screen ───────────────────────────────────────────────────────────

function WaitingScreen({
  onSimulate,
  hasActiveGame,
}: {
  onSimulate: () => void;
  hasActiveGame: boolean;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-8 p-6">
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="w-24 h-24 rounded-full bg-(--cyber-accent)/10 flex items-center justify-center"
      >
        <Eye className="w-14 h-14 text-(--cyber-accent)" />
      </motion.div>

      <div className="flex flex-col items-center gap-3 text-center">
        {hasActiveGame ? (
          <>
            <h2 className="text-3xl font-orbitron font-bold text-white">
              ORACLE MATCH
              <br />
              <span className="text-(--cyber-accent)">READY!</span>
            </h2>
            <p className="text-(--cyber-muted) animate-pulse text-lg">
              Tap the button below to begin…
            </p>
            <button
              onClick={onSimulate}
              className="mt-4 px-8 py-3 rounded-xl font-orbitron font-bold text-lg
                         bg-linear-to-r from-(--cyber-accent) to-(--cyber-accent-dim)
                         text-(--cyber-black) active:scale-95 transition-transform"
            >
              START MATCH
            </button>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-orbitron font-bold text-white">
              LOOK AT THE
              <br />
              <span className="text-(--cyber-accent)">BIG SCREEN!</span>
            </h2>
            <p className="text-(--cyber-muted) animate-pulse text-lg">
              Waiting for next question…
            </p>
          </>
        )}
      </div>

      {/* Dev-only simulate button (no active arena game) */}
      {process.env.NODE_ENV === "development" && !hasActiveGame && (
        <button
          onClick={onSimulate}
          className="mt-8 px-6 py-2 rounded-lg border border-(--cyber-grid) text-(--cyber-muted)
                     text-sm font-orbitron hover:border-(--cyber-accent) hover:text-(--cyber-accent)
                     transition-colors"
        >
          Simulate Question →
        </button>
      )}
    </div>
  );
}

// ── Answering Screen (2×2 Grid) ──────────────────────────────────────────────

function AnsweringScreen({
  sendingIndex,
  onAnswer,
  currentQuestion,
  questionIndex,
  totalQuestions,
}: {
  sendingIndex: number | null;
  onAnswer: (index: number) => void;
  currentQuestion: ArenaQuestion | null;
  questionIndex: number;
  totalQuestions: number;
}) {
  const isSending = sendingIndex !== null;

  // Derive the four option strings, filling gaps if options array is short
  const options = Array.from(
    { length: 4 },
    (_, i) => currentQuestion?.options[i] ?? "—",
  );

  return (
    <div className="flex-1 flex flex-col">
      {/* ── Question heading ───────────────────────────────────────────────── */}
      <div className="px-4 pt-4 pb-3">
        {totalQuestions > 0 && (
          <p className="text-[10px] uppercase tracking-widest text-center text-(--cyber-muted) font-orbitron mb-2">
            Question {questionIndex + 1} / {totalQuestions}
          </p>
        )}
        <div
          className="relative rounded-xl border border-(--cyber-accent)/40 px-4 py-3 overflow-hidden"
          style={{
            background: "rgba(0,217,255,0.06)",
            boxShadow: "0 0 24px rgba(0,217,255,0.08)",
          }}
        >
          {/* Scanning line */}
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-(--cyber-accent) to-transparent"
          />
          <h2
            className="text-center text-lg sm:text-xl md:text-2xl font-bold leading-snug text-white"
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              textShadow: "0 0 20px rgba(0,217,255,0.25)",
            }}
          >
            {currentQuestion?.question_text ?? "Loading question…"}
          </h2>
        </div>
      </div>

      {/* ── Answer grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-4">
        {ANSWER_COLORS.map((color) => {
          const isThisSending = sendingIndex === color.index;
          const isDisabled = isSending && !isThisSending;
          const optionText = options[color.index];

          return (
            <motion.button
              key={color.id}
              whileTap={!isSending ? { scale: 0.92 } : undefined}
              onClick={() => onAnswer(color.index)}
              disabled={isSending}
              className="relative rounded-2xl border-4 border-white/20 overflow-hidden
                         flex flex-col items-center justify-center gap-2
                         min-h-36 transition-opacity duration-200"
              style={{
                background: isThisSending ? color.active : color.hex,
                opacity: isDisabled ? 0.4 : 1,
                pointerEvents: isDisabled ? "none" : "auto",
              }}
            >
              {/* Scanline overlay */}
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
                }}
              />

              {/* Corner accents */}
              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/40 rounded-tl-md" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr-md" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl-md" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/40 rounded-br-md" />

              {/* Content */}
              <span className="relative z-10 w-full px-3">
                {isThisSending ? (
                  <span className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                    <span className="text-base font-orbitron font-bold text-white/90">
                      Sending…
                    </span>
                  </span>
                ) : (
                  <span
                    className="block text-center font-orbitron font-black text-white drop-shadow-lg
                               leading-tight wrap-break-word hyphens-auto
                               text-base sm:text-lg md:text-xl"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}
                  >
                    {optionText}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Game Complete Screen ─────────────────────────────────────────────────────

function GameCompleteScreen({
  score,
  totalQuestions,
}: {
  score: number;
  totalQuestions: number;
}) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-8 p-6"
      style={{
        background:
          "radial-gradient(circle at center, rgba(255,215,0,0.12) 0%, transparent 70%)",
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -15 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 180, damping: 12 }}
      >
        <Trophy className="w-28 h-28 text-(--winner-gold)" />
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="flex flex-col items-center gap-3 text-center"
      >
        <h2
          className="text-4xl sm:text-5xl font-orbitron font-black"
          style={{
            color: "#ffd700",
            textShadow: "0 0 30px rgba(255,215,0,0.45)",
          }}
        >
          MATCH COMPLETE
        </h2>
        <p className="text-(--cyber-muted) text-lg font-orbitron">
          {totalQuestions} question{totalQuestions !== 1 ? "s" : ""} answered
        </p>

        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-sm uppercase tracking-widest text-(--cyber-muted) font-orbitron">
            Final Score
          </span>
          <motion.span
            initial={{ scale: 0.6 }}
            animate={{ scale: [0.6, 1.2, 1] }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="text-6xl font-orbitron font-black text-(--winner-gold)"
          >
            {score}
          </motion.span>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        <Link
          href="/arena"
          className="px-8 py-3 rounded-xl font-orbitron font-bold text-lg
                     bg-linear-to-r from-(--cyber-accent) to-(--cyber-accent-dim)
                     text-(--cyber-black) active:scale-95 transition-transform"
        >
          BACK TO ARENA
        </Link>
      </motion.div>
    </div>
  );
}

// ── Result Screen ────────────────────────────────────────────────────────────

function ResultScreen({
  result,
  score,
}: {
  result: AnswerResult | null;
  score: number;
}) {
  const correct = result?.correct ?? false;
  const points = result?.points ?? 0;

  return (
    <div
      className="flex-1 flex flex-col items-center justify-center gap-6 p-6"
      style={{
        background: correct
          ? "radial-gradient(circle at center, rgba(0,230,118,0.15) 0%, transparent 70%)"
          : "radial-gradient(circle at center, rgba(255,23,68,0.15) 0%, transparent 70%)",
      }}
    >
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        {correct ? (
          <CheckCircle className="w-28 h-28 text-[#00e676]" />
        ) : (
          <XCircle className="w-28 h-28 text-(--error-red)" />
        )}
      </motion.div>

      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-2"
      >
        {correct ? (
          <motion.span
            initial={{ scale: 0.5 }}
            animate={{ scale: [0.5, 1.3, 1] }}
            transition={{ duration: 0.5 }}
            className="text-5xl font-orbitron font-black text-[#00e676]"
          >
            +{points}
          </motion.span>
        ) : (
          <span className="text-5xl font-orbitron font-black text-(--error-red)">
            WRONG!
          </span>
        )}

        <div className="mt-4 flex flex-col items-center gap-1">
          <span className="text-sm uppercase tracking-widest text-(--cyber-muted) font-orbitron">
            Total Score
          </span>
          <span className="text-4xl font-orbitron font-bold text-(--winner-gold)">
            {score}
          </span>
        </div>
      </motion.div>

      {/* Progress bar — 2s countdown until next question */}
      <motion.div className="w-full max-w-xs h-1 rounded-full bg-(--cyber-grid) mt-6 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{
            background: correct ? "#00e676" : "var(--error-red)",
          }}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 2, ease: "linear" }}
        />
      </motion.div>
    </div>
  );
}

// ── Cyberpunk Grid Background ────────────────────────────────────────────────

function CyberpunkGrid() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
      style={{
        backgroundImage: `
          linear-gradient(var(--cyber-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--cyber-grid) 1px, transparent 1px)
        `,
        backgroundSize: "30px 30px",
      }}
    />
  );
}
