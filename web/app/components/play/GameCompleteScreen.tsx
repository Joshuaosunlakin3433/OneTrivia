"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

type GameCompleteScreenProps = {
  score: number;
  totalQuestions: number;
};

export function GameCompleteScreen({
  score,
  totalQuestions,
}: GameCompleteScreenProps) {
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
