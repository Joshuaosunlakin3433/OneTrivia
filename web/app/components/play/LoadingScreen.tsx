"use client";

import { Loader2 } from "lucide-react";

export function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-(--cyber-black)">
      <Loader2 className="w-10 h-10 text-(--cyber-accent) animate-spin" />
    </div>
  );
}
