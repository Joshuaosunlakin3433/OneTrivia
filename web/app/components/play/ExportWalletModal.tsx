"use client";

import { useState } from "react";
import { CheckCircle, Copy, Eye, ShieldAlert, X } from "lucide-react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

type ExportWalletModalProps = {
  burner: Ed25519Keypair | null;
  burnerAddress: string | null;
  onClose: () => void;
};

export function ExportWalletModal({
  burner,
  burnerAddress,
  onClose,
}: ExportWalletModalProps) {
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

        <div className="flex gap-3 p-3 rounded-xl bg-(--error-red)/10 border border-(--error-red)/30 mb-5">
          <ShieldAlert className="w-5 h-5 text-(--error-red) shrink-0 mt-0.5" />
          <p className="text-xs text-(--cyber-muted) leading-relaxed">
            If you win, funds are sent here. Export this key to a real wallet
            (like <strong className="text-white">OneWallet</strong>) to claim
            them.
          </p>
        </div>

        <div className="mb-4">
          <span className="text-[10px] uppercase tracking-widest text-(--cyber-muted) font-orbitron">
            Public Address
          </span>
          <div className="mt-1.5 flex items-center gap-2 p-3 rounded-lg bg-(--cyber-black) border border-(--cyber-grid)">
            <code className="text-xs font-mono text-(--cyber-accent) break-all flex-1 select-all">
              {burnerAddress ?? "..."}
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
                  {privateKey ?? "..."}
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
