"use client";

import { ConnectButton } from "@mysten/dapp-kit";
import Image from "next/image";
import Link from "next/link";

export function Navbar() {
  return (
    <nav className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:py-4 md:px-8 md:py-6 border-b border-[#00d9ff]/10 bg-[#0a0a0f]/50 backdrop-blur-md">
      <Link
        href="/#hero"
        className="flex min-w-0 items-center gap-2"
        aria-label="Go to OneTrivia home hero section"
      >
        <Image
          src="/onetrivia%20logo.png"
          alt="OneTrivia logo"
          className="h-8 w-8 object-contain sm:h-10 sm:w-10 md:h-12 md:w-12"
          width={48}
          height={48}
        />
        <span
          className="truncate text-base font-bold tracking-wider sm:text-lg md:text-2xl"
          style={{ fontFamily: "var(--font-orbitron), sans-serif" }}
        >
          ONETRIVIA
        </span>
      </Link>

      <div className="origin-right scale-[0.86] sm:scale-100">
        <ConnectButton />
      </div>
    </nav>
  );
}
