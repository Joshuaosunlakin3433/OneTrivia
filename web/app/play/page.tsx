"use client";

import {
  Suspense,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import { useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { toBase64, fromBase64 } from "@mysten/sui/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { PACKAGE_ID, MODULE_NAME, SUBMIT_ANSWER_FN } from "../constants";
import { useBurnerWallet } from "../hooks/useBurnerWallet";
import {
  type ArenaGame,
  type AnswerResult,
  type GameState,
} from "../types/game";
import { CyberpunkGrid } from "../components/play/CyberpunkGrid";
import { LoadingScreen } from "../components/play/LoadingScreen";
import { InvalidGameScreen } from "../components/play/InvalidGameScreen";
import { ScoreBar } from "../components/play/ScoreBar";
import { WaitingScreen } from "../components/play/WaitingScreen";
import { AnsweringScreen } from "../components/play/AnsweringScreen";
import { ResultScreen } from "../components/play/ResultScreen";
import { GameCompleteScreen } from "../components/play/GameCompleteScreen";

export default function PlayPage() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <PlayContent />
    </Suspense>
  );
}

function PlayContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("game");

  if (!gameId) {
    return <InvalidGameScreen />;
  }

  return <GameController gameId={gameId} />;
}

function GameController({ gameId }: { gameId: string }) {
  const suiClient = useSuiClient();
  const { burner, burnerAddress } = useBurnerWallet();
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

  // Resolve the on-chain game object id: prefer active arena game, fall back to URL param
  const resolveGameObjectId = useCallback(() => {
    return activeGame?.onchain_game_id ?? gameId;
  }, [activeGame, gameId]);

  // Submit answer via sponsored transaction
  const submitAnswer = useCallback(
    async (index: number) => {
      if (sendingIndex !== null) return; // prevent double-tap

      if (!burner) {
        toast.error("Wallet is initialising, please wait...");
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
            tx.object(gameObjectId),
            tx.object("0x6"),
            tx.pure.u64(index),
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
        burnerAddress={burnerAddress}
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

function ScreenWrapper({ children }: { children: ReactNode }) {
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
