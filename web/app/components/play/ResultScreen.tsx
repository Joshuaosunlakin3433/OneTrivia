"use client";

import { motion } from "framer-motion";
import { CheckCircle, XCircle } from "lucide-react";
import { AnswerResult } from "../../types/game";

type ResultScreenProps = {
  result: AnswerResult | null;
  score: number;
};

export function ResultScreen({ result, score }: ResultScreenProps) {
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
