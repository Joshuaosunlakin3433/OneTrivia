"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import Image from "next/image";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-8 py-6 border-b border-[#00d9ff]/10 bg-[#0a0a0f]/50 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <Image
          src="/onetrivia%20logo.png"
          alt="OneTrivia logo"
          className="w-12 h-12 object-contain"
          width={48}
          height={48}
        />
        <span
          className="text-2xl font-bold tracking-wider"
          style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
        >
          ONETRIVIA
        </span>
      </div>

      <ConnectButton />
    </nav>
  );
}
