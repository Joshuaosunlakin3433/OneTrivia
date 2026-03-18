"use client";

export function CyberpunkGrid() {
  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
      style={{
        backgroundImage: `
          linear-gradient(var(--cyber-grid) 1px, transparent 1px),
          linear-gradient(90deg, var(--cyber-grid) 1px, transparent 1px)
        `,
        backgroundSize: "30px 30px",
      }}
    />
  );
}
