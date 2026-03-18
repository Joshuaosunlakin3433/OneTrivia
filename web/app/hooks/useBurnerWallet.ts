"use client";

import { useMemo } from "react";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";

type UseBurnerWalletResult = {
  burner: Ed25519Keypair | null;
  burnerAddress: string | null;
};

const BURNER_STORAGE_KEY = "onetrivia_burner";

export function useBurnerWallet(): UseBurnerWalletResult {
  const burner = useMemo(() => {
    if (typeof window === "undefined") {
      return null;
    }

    const stored = window.localStorage.getItem(BURNER_STORAGE_KEY);

    if (stored) {
      const { secretKey } = decodeSuiPrivateKey(stored);
      return Ed25519Keypair.fromSecretKey(secretKey);
    }

    const keypair = new Ed25519Keypair();
    window.localStorage.setItem(BURNER_STORAGE_KEY, keypair.getSecretKey());
    return keypair;
  }, []);

  const burnerAddress = useMemo(() => {
    return burner?.toSuiAddress() ?? null;
  }, [burner]);

  return { burner, burnerAddress };
}
