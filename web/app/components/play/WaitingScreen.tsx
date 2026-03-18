"use client";

import { motion } from "framer-motion";
import { Eye } from "lucide-react";

type WaitingScreenProps = {
  onSimulate: () => void;
  hasActiveGame: boolean;
};

export function WaitingScreen({
  onSimulate,
  hasActiveGame,
}: WaitingScreenProps) {
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
              Tap the button below to begin...
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
              Waiting for next question...
            </p>
          </>
        )}
      </div>

      {process.env.NODE_ENV === "development" && !hasActiveGame && (
        <button
          onClick={onSimulate}
          className="mt-8 px-6 py-2 rounded-lg border border-(--cyber-grid) text-(--cyber-muted)
                     text-sm font-orbitron hover:border-(--cyber-accent) hover:text-(--cyber-accent)
                     transition-colors"
        >
          Simulate Question -&gt;
        </button>
      )}
    </div>
  );
}
