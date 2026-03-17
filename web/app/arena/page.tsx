"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Clock,
  Trophy,
  Flame,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  Users,
} from "lucide-react";
import {
  ConnectButton,
  useCurrentAccount,
  useSuiClient,
} from "@mysten/dapp-kit";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Transaction } from "@mysten/sui/transactions";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { toast } from "sonner";
import { Navbar } from "../components/Navbar";
import {
  ANSWER_COLORS,
  PACKAGE_ID,
  MODULE_NAME,
  SUBMIT_ANSWER_FN,
} from "../constants";

type GameStatus = "waiting" | "active";
const AGENT_CYCLE_SECONDS = 60 * 60;
const ARENA_POLL_SECONDS = 20;

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

type ApiError = Error & {
  status?: number;
};

type LoadActiveGameResult = {
  game: ArenaGame | null;
  statusCode: number | null;
};

const MOCK_WINNERS = [
  { name: "alex.one", amount: 500, token: "OCT" },
  { name: "crypto.one", amount: 750, token: "OCT" },
  { name: "gamer.one", amount: 1000, token: "OCT" },
  { name: "ninja.one", amount: 250, token: "OCT" },
  { name: "pixel.one", amount: 600, token: "OCT" },
];

const MOCK_LEADERBOARD = [
  { rank: 1, name: "crypto.one", score: 5840, streak: 12 },
  { rank: 2, name: "gamer.one", score: 4920, streak: 8 },
  { rank: 3, name: "ninja.one", score: 4100, streak: 15 },
  { rank: 4, name: "alex.one", score: 3750, streak: 3 },
  { rank: 5, name: "pixel.one", score: 3200, streak: 6 },
  { rank: 6, name: "legend.one", score: 2800, streak: 2 },
  { rank: 7, name: "blaze.one", score: 2400, streak: 9 },
  { rank: 8, name: "storm.one", score: 1950, streak: 0 },
  { rank: 9, name: "viper.one", score: 1600, streak: 4 },
  { rank: 10, name: "echo.one", score: 1200, streak: 1 },
];

const RANK_STYLES: Record<
  number,
  { color: string; glow: string; label: string }
> = {
  1: { color: "#ffd700", glow: "rgba(255,215,0,0.4)", label: "🥇" },
  2: { color: "#c0c0c0", glow: "rgba(192,192,192,0.3)", label: "🥈" },
  3: { color: "#cd7f32", glow: "rgba(205,127,50,0.3)", label: "🥉" },
};

export default function ArenaPage() {
  const account = useCurrentAccount();
  const suiClient = useSuiClient();

  const [gameStatus, setGameStatus] = useState<GameStatus>("waiting");
  const [timeLeft, setTimeLeft] = useState(AGENT_CYCLE_SECONDS);
  const [isLoading, setIsLoading] = useState(true);
  const [activeGame, setActiveGame] = useState<ArenaGame | null>(null);
  const [fetchErrorCode, setFetchErrorCode] = useState<number | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [completedGameId, setCompletedGameId] = useState<string | null>(null);
  const [burner, setBurner] = useState<Ed25519Keypair | null>(null);

  const getCycleTimeLeft = useCallback((createdAt: string) => {
    const createdAtMs = new Date(createdAt).getTime();
    if (Number.isNaN(createdAtMs)) return AGENT_CYCLE_SECONDS;

    const elapsedSeconds = Math.floor((Date.now() - createdAtMs) / 1000);
    return Math.max(0, AGENT_CYCLE_SECONDS - elapsedSeconds);
  }, []);

  const loadActiveGame =
    useCallback(async (): Promise<LoadActiveGameResult> => {
      setIsLoading(true);
      setFetchErrorCode(null);

      try {
        const res = await fetch("/api/arena/current", { cache: "no-store" });

        if (res.status === 404) {
          setActiveGame(null);
          setFetchErrorCode(404);
          setGameStatus("waiting");
          setTimeLeft(ARENA_POLL_SECONDS);
          return { game: null, statusCode: 404 };
        }

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          const apiError = new Error(
            payload?.error || `HTTP ${res.status}`,
          ) as ApiError;
          apiError.status = res.status;
          throw apiError;
        }

        const data = (await res.json()) as ArenaGame;
        setActiveGame(data);
        setCurrentQuestionIndex(0);
        setGameStatus("waiting");
        setTimeLeft(getCycleTimeLeft(data.created_at));
        return { game: data, statusCode: res.status };
      } catch (error) {
        const status =
          error && typeof error === "object" && "status" in error
            ? Number((error as ApiError).status)
            : 500;

        setActiveGame(null);
        setGameStatus("waiting");
        setFetchErrorCode(status);

        if (status >= 500) {
          toast.error("Oracle feed unavailable. Backend is currently offline.");
        }

        return { game: null, statusCode: status };
      } finally {
        setIsLoading(false);
      }
    }, [getCycleTimeLeft]);

  useEffect(() => {
    void loadActiveGame();
  }, [loadActiveGame]);

  useEffect(() => {
    const stored = localStorage.getItem("onetrivia_burner");
    if (stored) {
      const { secretKey } = decodeSuiPrivateKey(stored);
      setBurner(Ed25519Keypair.fromSecretKey(secretKey));
      return;
    }

    const kp = new Ed25519Keypair();
    localStorage.setItem("onetrivia_burner", kp.getSecretKey());
    setBurner(kp);
  }, []);

  useEffect(() => {
    if (gameStatus !== "waiting") return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 0) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStatus]);

  useEffect(() => {
    if (gameStatus !== "waiting") return;

    const interval = setInterval(() => {
      void loadActiveGame();
    }, ARENA_POLL_SECONDS * 1000);

    return () => clearInterval(interval);
  }, [gameStatus, loadActiveGame]);

  const hasLiveGame = Boolean(activeGame?.questions?.length);
  const isReplayLocked = Boolean(
    activeGame && completedGameId && activeGame.id === completedGameId,
  );
  const hasJoinableGame = hasLiveGame && !isReplayLocked;

  const handleJoinPool = async () => {
    if (!account) {
      toast.error("Connect your wallet first to join the pool.");
      return;
    }

    if (hasJoinableGame) {
      setCurrentQuestionIndex(0);
      setGameStatus("active");
      toast.success("Live Oracle match available. Entering arena...");
      return;
    }

    const latest = await loadActiveGame();
    const hasLatestLiveGame = Boolean(latest.game?.questions?.length);
    const isLatestReplayLocked = Boolean(
      latest.game && completedGameId && latest.game.id === completedGameId,
    );

    if (hasLatestLiveGame && !isLatestReplayLocked) {
      setCurrentQuestionIndex(0);
      setGameStatus("active");
      toast.success("New Oracle match found. Entering arena...");
      return;
    }

    if (isLatestReplayLocked) {
      toast(
        "You already completed this match. Waiting for the next Oracle game.",
      );
      return;
    }

    if (latest.statusCode && latest.statusCode >= 500) {
      toast.error(
        "Cannot join right now: Oracle backend is unavailable (server error).",
      );
      return;
    }

    if (isReplayLocked) {
      toast(
        "You already completed this match. Waiting for the next Oracle game.",
      );
      return;
    }

    if (fetchErrorCode && fetchErrorCode >= 500) {
      toast.error(
        "Cannot join right now: Oracle backend is unavailable (server error).",
      );
      return;
    }

    toast("No active match yet. Oracle is preparing the next round.");
  };

  const handleMatchComplete = useCallback((gameId: string) => {
    setCompletedGameId(gameId);
    setGameStatus("waiting");
    setTimeLeft(AGENT_CYCLE_SECONDS);
  }, []);

  const refreshActiveGame = useCallback(async () => {
    await loadActiveGame();
  }, [loadActiveGame]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f] text-white">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
        <motion.div
          className="absolute inset-0"
          animate={{ backgroundPosition: ["0px 0px", "50px 50px"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,215,0,0.06) 2px, transparent 2px),
              linear-gradient(90deg, rgba(255,215,0,0.06) 2px, transparent 2px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      <motion.div
        animate={{ x: [0, 80, 0], y: [0, -40, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-10 w-96 h-96 bg-[#ffd700] opacity-10 blur-[120px] rounded-full pointer-events-none"
      />
      <motion.div
        animate={{ x: [0, -80, 0], y: [0, 60, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-10 w-96 h-96 bg-[#00d9ff] opacity-10 blur-[120px] rounded-full pointer-events-none"
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        <AnimatePresence mode="wait">
          {gameStatus === "waiting" ? (
            <motion.div
              key="lobby"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col"
            >
              <LobbyView
                timeLeft={timeLeft}
                account={account}
                isLoading={isLoading}
                hasGame={hasJoinableGame}
                isNoGame={fetchErrorCode === 404}
                hasServerError={Boolean(
                  fetchErrorCode && fetchErrorCode >= 500,
                )}
                isReplayLocked={isReplayLocked}
                onJoinPool={handleJoinPool}
                onRefresh={refreshActiveGame}
              />
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex-1 flex flex-col"
            >
              {activeGame ? (
                <ActiveGameView
                  burner={burner}
                  game={activeGame}
                  currentQuestionIndex={currentQuestionIndex}
                  setCurrentQuestionIndex={setCurrentQuestionIndex}
                  onMatchComplete={handleMatchComplete}
                  onRefreshGame={refreshActiveGame}
                  suiClient={suiClient}
                />
              ) : (
                <div className="flex-1 grid place-items-center px-6 text-center">
                  <OracleStatusCard
                    isLoading={isLoading}
                    isNoGame={fetchErrorCode === 404}
                    hasGame={hasJoinableGame}
                    hasServerError={Boolean(
                      fetchErrorCode && fetchErrorCode >= 500,
                    )}
                    isReplayLocked={isReplayLocked}
                    onRefresh={refreshActiveGame}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function LobbyView({
  timeLeft,
  account,
  isLoading,
  hasGame,
  isNoGame,
  hasServerError,
  isReplayLocked,
  onJoinPool,
  onRefresh,
}: {
  timeLeft: number;
  account: ReturnType<typeof useCurrentAccount>;
  isLoading: boolean;
  hasGame: boolean;
  isNoGame: boolean;
  hasServerError: boolean;
  isReplayLocked: boolean;
  onJoinPool: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 flex flex-col items-center px-4 sm:px-8 py-8 gap-10">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-3 mb-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #ffd700, #00d9ff)",
              boxShadow: "0 0 40px rgba(0, 217, 255, 0.4)",
            }}
          >
            <Brain className="w-8 h-8 text-[#0a0a0f]" />
          </div>
        </div>
        <h1
          className="text-5xl sm:text-7xl tracking-wider mb-2"
          style={{
            fontFamily: "var(--font-orbitron), sans-serif",
            fontWeight: 900,
            color: "#ffd700",
            textShadow: "0 0 30px rgba(255, 215, 0, 0.3)",
          }}
        >
          THE ARENA
        </h1>
        <p
          className="text-xl sm:text-2xl text-[#8b8b9a] tracking-[0.3em]"
          style={{
            fontFamily: "var(--font-rajdhani), sans-serif",
            fontWeight: 600,
          }}
        >
          ORACLE FEED TERMINAL
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, delay: 0.2 }}
        className="relative w-full max-w-lg"
      >
        <div
          className="relative bg-[#101327] border-2 border-[#ffd700]/30 rounded-2xl p-8 overflow-hidden"
          style={{ boxShadow: "0 0 40px rgba(255, 215, 0, 0.08)" }}
        >
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-[#00d9ff] to-transparent"
          />

          <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-[#00d9ff] rounded-tl-md" />
          <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-[#00d9ff] rounded-tr-md" />
          <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-[#00d9ff] rounded-bl-md" />
          <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-[#00d9ff] rounded-br-md" />

          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#ffd700]" />
              <p
                className="text-sm text-[#8b8b9a] uppercase tracking-widest"
                style={{
                  fontFamily: "var(--font-rajdhani), sans-serif",
                  fontWeight: 500,
                }}
              >
                Next Oracle Match Window
              </p>
            </div>
            <motion.p
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-6xl sm:text-7xl"
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 900,
                color: "#ffd700",
                textShadow: "0 0 30px rgba(255, 215, 0, 0.5)",
              }}
            >
              {formatTime(timeLeft)}
            </motion.p>

            <div className="w-full h-1.5 bg-[#2a2a3e] rounded-full mt-2 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: "linear-gradient(90deg, #00d9ff, #ffd700)",
                }}
                initial={false}
                animate={{
                  width: `${Math.max(
                    0,
                    (timeLeft / AGENT_CYCLE_SECONDS) * 100,
                  )}%`,
                }}
                transition={{ duration: 1, ease: "linear" }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      <OracleStatusCard
        isLoading={isLoading}
        isNoGame={isNoGame}
        hasGame={hasGame}
        hasServerError={hasServerError}
        isReplayLocked={isReplayLocked}
        onRefresh={onRefresh}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        {account ? (
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => void onJoinPool()}
            className="px-10 py-4 rounded-xl text-xl font-bold tracking-wider text-[#0a0a0f] cursor-pointer"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              background: "linear-gradient(135deg, #ffd700, #00d9ff)",
              boxShadow: "0 0 30px rgba(0, 217, 255, 0.35)",
            }}
          >
            <div className="flex items-center gap-3">
              <Zap className="w-6 h-6" />
              {hasGame ? "ENTER LIVE MATCH" : "JOIN POOL"}
            </div>
          </motion.button>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className="relative rounded-xl p-0.5"
              style={{
                background: "linear-gradient(135deg, #ffd700, #00d9ff)",
              }}
            >
              <div className="bg-[#1a1a2e] rounded-[10px] px-2 py-1">
                <ConnectButton />
              </div>
            </div>
            <p className="text-sm text-[#8b8b9a] text-center max-w-xs">
              Connect your wallet to join the pool. All transactions are
              sponsored.
            </p>
          </div>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="w-full max-w-4xl overflow-hidden"
      >
        <div className="relative bg-[#1a1a2e]/60 border border-[#ffd700]/20 rounded-xl py-4 overflow-hidden">
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 left-0 right-0 h-0.5 bg-linear-to-r from-transparent via-[#ffd700]/60 to-transparent"
          />

          <p
            className="text-xs text-[#8b8b9a] uppercase tracking-widest text-center mb-3 px-4"
            style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
          >
            Recent Winners
          </p>

          <div className="overflow-hidden">
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="flex gap-8 px-4"
            >
              {[...MOCK_WINNERS, ...MOCK_WINNERS].map((winner, i) => (
                <div key={i} className="flex items-center gap-2 shrink-0">
                  <Trophy className="w-4 h-4 text-[#ffd700]" />
                  <p
                    className="text-base whitespace-nowrap"
                    style={{
                      fontFamily: "var(--font-rajdhani), sans-serif",
                      fontWeight: 600,
                    }}
                  >
                    <span className="text-[#00d9ff]">{winner.name}</span>
                    <span className="text-white"> won </span>
                    <span className="text-[#ffd700]">
                      {winner.amount} {winner.token}
                    </span>
                  </p>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.8 }}
        className="w-full max-w-2xl"
      >
        <LeaderboardPanel />
      </motion.div>
    </div>
  );
}

function OracleStatusCard({
  isLoading,
  isNoGame,
  hasGame,
  hasServerError,
  isReplayLocked,
  onRefresh,
}: {
  isLoading: boolean;
  isNoGame: boolean;
  hasGame: boolean;
  hasServerError: boolean;
  isReplayLocked: boolean;
  onRefresh: () => Promise<void>;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative w-full max-w-2xl bg-[#0d1122]/80 border border-[#00d9ff]/35 rounded-2xl p-6 overflow-hidden"
      style={{ boxShadow: "0 0 35px rgba(0, 217, 255, 0.12)" }}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-15"
        style={{
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 4px, rgba(0,217,255,0.15) 4px, rgba(0,217,255,0.15) 5px)",
        }}
      />

      {isLoading ? (
        <div className="relative z-10 flex flex-col items-center gap-4 text-center py-4">
          <RadarSpinner />
          <p
            className="text-[#00d9ff] uppercase tracking-[0.24em] text-sm"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            Syncing Oracle Feed
          </p>
        </div>
      ) : isNoGame ? (
        <div className="relative z-10 flex flex-col items-center gap-4 text-center py-3">
          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
            className="text-lg sm:text-xl text-[#ffd700]"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              textShadow: "0 0 20px rgba(255, 215, 0, 0.55)",
            }}
          >
            Waiting for the Oracle to generate the next match...
          </motion.p>
          <button
            onClick={() => void onRefresh()}
            className="px-4 py-2 rounded-lg border border-[#00d9ff]/50 text-[#00d9ff]
                       hover:bg-[#00d9ff]/10 transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            Refresh Feed
          </button>
        </div>
      ) : hasGame ? (
        <div className="relative z-10 flex flex-col items-center gap-3 text-center py-3">
          <p
            className="text-[#00d9ff] uppercase tracking-[0.22em] text-xs"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            Oracle Transmission
          </p>
          <p
            className="text-xl sm:text-2xl text-[#ffd700]"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              textShadow: "0 0 14px rgba(255, 215, 0, 0.35)",
            }}
          >
            LIVE MATCH AVAILABLE
          </p>
        </div>
      ) : isReplayLocked ? (
        <div className="relative z-10 flex flex-col items-center gap-3 text-center py-3">
          <p
            className="text-[#ffd700] text-lg"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              textShadow: "0 0 14px rgba(255, 215, 0, 0.35)",
            }}
          >
            Current match already completed. Waiting for a new Oracle game.
          </p>
          <button
            onClick={() => void onRefresh()}
            className="px-4 py-2 rounded-lg border border-[#00d9ff]/50 text-[#00d9ff]
                       hover:bg-[#00d9ff]/10 transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            Check For New Match
          </button>
        </div>
      ) : hasServerError ? (
        <div className="relative z-10 flex flex-col items-center gap-3 text-center py-3">
          <p
            className="text-[#ff6b6b] text-lg"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              textShadow: "0 0 12px rgba(255, 107, 107, 0.45)",
            }}
          >
            Oracle backend unavailable (server error).
          </p>
          <button
            onClick={() => void onRefresh()}
            className="px-4 py-2 rounded-lg border border-[#ff6b6b]/50 text-[#ff6b6b]
                       hover:bg-[#ff6b6b]/10 transition-colors cursor-pointer"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <div className="relative z-10 text-center py-3 text-[#8b8b9a]">
          Oracle status unavailable.
        </div>
      )}
    </motion.div>
  );
}

function RadarSpinner() {
  return (
    <div className="relative w-24 h-24">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 rounded-full border-2 border-[#00d9ff]/30"
      >
        <div className="absolute top-1/2 left-1/2 w-1/2 h-0.5 origin-left -translate-y-1/2 bg-linear-to-r from-[#ffd700] to-[#00d9ff]" />
      </motion.div>
      <div className="absolute inset-3 rounded-full border border-[#ffd700]/40" />
      <div className="absolute inset-6 rounded-full border border-[#00d9ff]/25" />
      <motion.div
        animate={{ scale: [1, 1.18, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-[40%] rounded-full bg-[#ffd700]"
      />
    </div>
  );
}

function LeaderboardPanel() {
  return (
    <div className="bg-[#1a1a2e]/60 border border-[#ffd700]/20 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-center gap-3 py-4 border-b border-[#2a2a3e]">
        <Trophy
          className="w-5 h-5 text-[#ffd700] animate-spin"
          style={{ animationDuration: "3s" }}
        />
        <h2
          className="text-xl tracking-widest bg-linear-to-r from-[#ffd700] via-white to-[#00d9ff] bg-clip-text text-transparent"
          style={{
            fontFamily: "var(--font-orbitron), sans-serif",
            fontWeight: 800,
          }}
        >
          LEADERBOARD
        </h2>
        <Trophy
          className="w-5 h-5 text-[#ffd700] animate-spin"
          style={{ animationDuration: "3s" }}
        />
      </div>

      <div
        className="grid grid-cols-[3rem_1fr_5rem_4rem] px-4 py-2 text-xs text-[#8b8b9a] uppercase tracking-wider border-b border-[#2a2a3e]/50"
        style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
      >
        <span>#</span>
        <span>Player</span>
        <span className="text-right">Score</span>
        <span className="text-right">Streak</span>
      </div>

      <div className="divide-y divide-[#2a2a3e]/30">
        {MOCK_LEADERBOARD.map((player) => {
          const rankStyle = RANK_STYLES[player.rank];
          const isTop3 = player.rank <= 3;

          return (
            <motion.div
              key={player.rank}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: player.rank * 0.05 }}
              className="grid grid-cols-[3rem_1fr_5rem_4rem] items-center px-4 py-3 hover:bg-[#ffd700]/5 transition-colors"
            >
              <span
                className="text-lg font-bold"
                style={{
                  fontFamily: "var(--font-orbitron), sans-serif",
                  color: rankStyle?.color ?? "#8b8b9a",
                  textShadow: isTop3
                    ? `0 0 10px ${rankStyle?.glow}`
                    : undefined,
                }}
              >
                {rankStyle?.label ?? player.rank}
              </span>

              <span
                className="text-base truncate"
                style={{
                  fontFamily: "var(--font-rajdhani), sans-serif",
                  fontWeight: 600,
                  color: isTop3 ? "#00d9ff" : "#ffffff",
                }}
              >
                {player.name}
              </span>

              <span
                className="text-right text-base font-bold"
                style={{
                  fontFamily: "var(--font-orbitron), sans-serif",
                  color: "#ffd700",
                }}
              >
                {player.score.toLocaleString()}
              </span>

              <span
                className="text-right text-sm flex items-center justify-end gap-1"
                style={{
                  fontFamily: "var(--font-orbitron), sans-serif",
                  color: player.streak >= 5 ? "#ffd700" : "#8b8b9a",
                }}
              >
                {player.streak >= 5 && (
                  <Flame className="w-3.5 h-3.5 text-[#ffd700]" />
                )}
                {player.streak}
              </span>
            </motion.div>
          );
        })}
      </div>

      <div className="flex items-center justify-center gap-2 py-3 border-t border-[#2a2a3e] text-xs text-[#8b8b9a]">
        <Users className="w-3.5 h-3.5" />
        <span style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}>
          {MOCK_LEADERBOARD.length} players competing
        </span>
      </div>
    </div>
  );
}

function ActiveGameView({
  burner,
  game,
  currentQuestionIndex,
  setCurrentQuestionIndex,
  onMatchComplete,
  onRefreshGame,
  suiClient,
}: {
  burner: Ed25519Keypair | null;
  game: ArenaGame;
  currentQuestionIndex: number;
  setCurrentQuestionIndex: React.Dispatch<React.SetStateAction<number>>;
  onMatchComplete: (gameId: string) => void;
  onRefreshGame: () => Promise<void>;
  suiClient: ReturnType<typeof useSuiClient>;
}) {
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [sendingIndex, setSendingIndex] = useState<number | null>(null);
  const [showResult, setShowResult] = useState<{
    correct: boolean;
    points: number;
  } | null>(null);

  const currentQuestion = game.questions[currentQuestionIndex];

  const handleAnswer = useCallback(
    async (index: number) => {
      if (sendingIndex !== null || showResult) return;

      if (!burner) {
        toast.error("Wallet is initialising, please wait...");
        return;
      }

      if (!currentQuestion) {
        toast.error("No question available from Oracle.");
        return;
      }

      if (currentQuestion.options.length < 4) {
        toast.error("Oracle payload has incomplete options.");
        return;
      }

      setSendingIndex(index);

      try {
        const tx = new Transaction();
        tx.moveCall({
          target: `${PACKAGE_ID}::${MODULE_NAME}::${SUBMIT_ANSWER_FN}`,
          arguments: [
            tx.object(game.onchain_game_id),
            tx.object("0x6"),
            tx.pure.u64(index),
          ],
        });

        const kindBytes = await tx.build({
          client: suiClient,
          onlyTransactionKind: true,
        });

        const sponsorRes = await fetch("/api/sponsor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            txBytes: toBase64(kindBytes),
            sender: burner.toSuiAddress(),
          }),
        });

        if (!sponsorRes.ok) {
          const err = await sponsorRes
            .json()
            .catch(() => ({ error: "Sponsor request failed" }));
          throw new Error(err.error || `HTTP ${sponsorRes.status}`);
        }

        const { txBytes: signedBytes, sponsorSignature } =
          await sponsorRes.json();
        const txBytesArray = fromBase64(signedBytes);
        const { signature: userSignature } =
          await burner.signTransaction(txBytesArray);

        await suiClient.executeTransactionBlock({
          transactionBlock: txBytesArray,
          signature: [userSignature, sponsorSignature],
        });

        const correct = index === currentQuestion.correct_index;
        const points = correct ? 100 + streak * 25 : 0;

        setShowResult({ correct, points });
        setScore((prev) => prev + points);
        setStreak((prev) => (correct ? prev + 1 : 0));

        toast.success("Answer submitted via sponsored transaction.");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to submit answer",
        );
      } finally {
        setSendingIndex(null);
      }
    },
    [
      burner,
      currentQuestion,
      game.onchain_game_id,
      sendingIndex,
      showResult,
      streak,
      suiClient,
    ],
  );

  useEffect(() => {
    if (!showResult) return;

    const timer = setTimeout(() => {
      setShowResult(null);
      setCurrentQuestionIndex((prev) => {
        const next = prev + 1;
        if (next >= game.questions.length) {
          toast("Match complete. Returning to lobby...");
          onMatchComplete(game.id);
          void onRefreshGame();
          return 0;
        }
        return next;
      });
    }, 2200);

    return () => clearTimeout(timer);
  }, [
    game.id,
    game.questions.length,
    onMatchComplete,
    onRefreshGame,
    setCurrentQuestionIndex,
    showResult,
  ]);

  if (!currentQuestion) {
    return (
      <div className="flex-1 grid place-items-center px-6 text-center">
        <div className="max-w-xl rounded-2xl border border-[#00d9ff]/40 bg-[#0d1122]/80 p-6">
          <p
            className="text-[#ffd700] text-xl"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            Oracle game exists but no question payload is available.
          </p>
        </div>
      </div>
    );
  }

  const optionTexts = Array.from(
    { length: 4 },
    (_, i) => currentQuestion.options[i] ?? "N/A",
  );

  return (
    <div
      className="flex-1 flex flex-col select-none"
      style={{ touchAction: "manipulation" }}
    >
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-[#101327]/90 backdrop-blur-sm border-b border-[#2a2a3e]">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span
              className="text-[10px] uppercase tracking-widest text-[#8b8b9a]"
              style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
            >
              Score
            </span>
            <span
              className="text-xl font-bold text-[#ffd700]"
              style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
            >
              {score}
            </span>
          </div>
          <div className="w-px h-8 bg-[#2a2a3e]" />
          <div className="flex flex-col">
            <span
              className="text-[10px] uppercase tracking-widest text-[#8b8b9a]"
              style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
            >
              Streak
            </span>
            <span
              className="text-xl font-bold text-[#00d9ff]"
              style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
            >
              {streak}🔥
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#00d9ff]/10 border border-[#00d9ff]/30">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #00d9ff, #ffd700)" }}
          >
            <Brain className="w-3.5 h-3.5 text-[#0a0a0f]" />
          </div>
          <span
            className="text-xs font-bold text-[#00d9ff] tracking-wider"
            style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
          >
            LIVE ORACLE
          </span>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 py-3">
        {game.questions.map((_, i) => (
          <div
            key={i}
            className="w-2.5 h-2.5 rounded-full transition-colors duration-300"
            style={{
              background:
                i < currentQuestionIndex
                  ? "#ffd700"
                  : i === currentQuestionIndex
                    ? "#00d9ff"
                    : "#2a2a3e",
              boxShadow:
                i === currentQuestionIndex ? "0 0 8px #00d9ff" : undefined,
            }}
          />
        ))}
        <span
          className="ml-2 text-xs text-[#8b8b9a]"
          style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
        >
          Question {currentQuestionIndex + 1} / {game.questions.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {!showResult && (
          <motion.div
            key={`q-${currentQuestion.id}-${currentQuestionIndex}`}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="px-4 pb-3 text-center"
          >
            <span
              className="inline-block text-[10px] uppercase tracking-widest px-3 py-1 rounded-full bg-[#00d9ff]/10 text-[#00d9ff] border border-[#00d9ff]/20 mb-2"
              style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
            >
              Oracle Prompt
            </span>
            <p
              className="text-xl sm:text-3xl font-bold text-white leading-tight"
              style={{ fontFamily: "var(--font-rajdhani), sans-serif" }}
            >
              {currentQuestion.question_text}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showResult ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center gap-4 p-6"
            style={{
              background: showResult.correct
                ? "radial-gradient(circle at center, rgba(0,230,118,0.15) 0%, transparent 70%)"
                : "radial-gradient(circle at center, rgba(255,23,68,0.15) 0%, transparent 70%)",
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
            >
              {showResult.correct ? (
                <CheckCircle className="w-24 h-24 text-[#00e676]" />
              ) : (
                <XCircle className="w-24 h-24 text-[#ff1744]" />
              )}
            </motion.div>
            {showResult.correct ? (
              <motion.span
                initial={{ scale: 0.5 }}
                animate={{ scale: [0.5, 1.3, 1] }}
                transition={{ duration: 0.5 }}
                className="text-5xl font-black text-[#00e676]"
                style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
              >
                +{showResult.points}
              </motion.span>
            ) : (
              <span
                className="text-5xl font-black text-[#ff1744]"
                style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
              >
                REJECTED
              </span>
            )}

            <div className="w-full max-w-xs h-1 rounded-full bg-[#2a2a3e] mt-4 overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{
                  background: showResult.correct ? "#00e676" : "#ff1744",
                }}
                initial={{ width: "100%" }}
                animate={{ width: "0%" }}
                transition={{ duration: 2.2, ease: "linear" }}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`grid-${currentQuestion.id}-${currentQuestionIndex}`}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-4"
          >
            {ANSWER_COLORS.map((color) => {
              const isThisSending = sendingIndex === color.index;
              const isSending = sendingIndex !== null;
              const isDisabled = isSending && !isThisSending;
              const answerLabel = optionTexts[color.index];

              return (
                <motion.button
                  key={color.id}
                  whileTap={!isSending ? { scale: 0.92 } : undefined}
                  onClick={() => void handleAnswer(color.index)}
                  disabled={isSending || answerLabel === "N/A"}
                  className="relative rounded-2xl border-4 border-white/20 overflow-hidden
                             flex flex-col items-center justify-center gap-2
                             min-h-[calc(45dvh/2)] sm:min-h-45 transition-opacity duration-200 cursor-pointer"
                  style={{
                    background: isThisSending ? color.active : color.hex,
                    opacity: isDisabled || answerLabel === "N/A" ? 0.4 : 1,
                    pointerEvents: isDisabled ? "none" : "auto",
                  }}
                >
                  <div
                    className="absolute inset-0 pointer-events-none opacity-10"
                    style={{
                      background:
                        "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
                    }}
                  />

                  <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/40 rounded-tl-md" />
                  <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr-md" />
                  <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl-md" />
                  <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/40 rounded-br-md" />

                  <span className="relative z-10">
                    {isThisSending ? (
                      <span className="flex flex-col items-center gap-2">
                        <Loader2 className="w-8 h-8 text-white animate-spin" />
                        <span
                          className="text-sm font-bold text-white/90"
                          style={{
                            fontFamily: "var(--font-orbitron), sans-serif",
                          }}
                        >
                          Signing...
                        </span>
                      </span>
                    ) : (
                      <span className="flex flex-col items-center gap-1 px-3">
                        <span
                          className="text-xl sm:text-2xl font-black text-white drop-shadow-lg text-center"
                          style={{
                            fontFamily: "var(--font-orbitron), sans-serif",
                            textShadow: "0 2px 10px rgba(0,0,0,0.5)",
                          }}
                        >
                          {answerLabel}
                        </span>
                        <span
                          className="text-[11px] sm:text-xs text-white/90 font-semibold tracking-[0.25em] uppercase"
                          style={{
                            fontFamily: "var(--font-orbitron), sans-serif",
                          }}
                        >
                          {color.label}
                        </span>
                      </span>
                    )}
                  </span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
