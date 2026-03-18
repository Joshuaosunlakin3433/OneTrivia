"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { generateName, truncateAddress } from "../../utils/generateName";
import { ExportWalletModal } from "./ExportWalletModal";

type ScoreBarProps = {
  score: number;
  streak: number;
  burnerAddress: string | null;
  burner: Ed25519Keypair | null;
};

export function ScoreBar({
  score,
  streak,
  burnerAddress,
  burner,
}: ScoreBarProps) {
  const [showModal, setShowModal] = useState(false);
  const playerName = burnerAddress ? generateName(burnerAddress) : "...";
  const truncated = burnerAddress ? truncateAddress(burnerAddress) : "...";

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
