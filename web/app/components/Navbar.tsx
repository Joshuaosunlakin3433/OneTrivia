"use client";

import { ConnectButton } from "@mysten/dapp-kit";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between px-8 py-6 border-b border-[#00d9ff]/10 bg-[#0a0a0f]/50 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-[#00d9ff] rounded-sm flex items-center justify-center font-bold text-black rotate-45">
          <span className="-rotate-45">1</span>
        </div>
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
