"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { CyberpunkGrid } from "./CyberpunkGrid";

export function InvalidGameScreen() {
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
