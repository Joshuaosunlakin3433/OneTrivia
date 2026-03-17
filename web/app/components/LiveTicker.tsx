"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Trophy } from "lucide-react";

interface Winner {
  name: string;
  amount: number;
  token: string;
}

const recentWinners: Winner[] = [
  { name: "alex.one", amount: 500, token: "OCT" },
  { name: "crypto.one", amount: 750, token: "OCT" },
  { name: "gamer.one", amount: 1000, token: "OCT" },
  { name: "ninja.one", amount: 250, token: "OCT" },
  { name: "pixel.one", amount: 600, token: "OCT" },
];

export function LiveTicker() {
  const [nextGameTime, setNextGameTime] = useState(15 * 60);

  useEffect(() => {
    const interval = setInterval(() => {
      setNextGameTime((prev) => (prev <= 0 ? 60 * 60 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.8 }}
      className="relative bg-[#1a1a2e] border-t-4 border-[#00d9ff] py-6 overflow-hidden"
    >
      {/* Glowing sweep line */}
      <motion.div
        animate={{ x: ["-100%", "100%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        className="absolute top-0 left-0 right-0 h-1 bg-linear-to-r from-transparent via-[#00d9ff] to-transparent"
      />

      <div className="flex items-center gap-8 px-8">
        {/* Timer */}
        <div className="flex items-center gap-3 shrink-0">
          <Clock className="w-6 h-6 text-[#ffd700]" />
          <div>
            <p
              className="text-xs text-[#8b8b9a]"
              style={{
                fontFamily: "var(--font-rajdhani), sans-serif",
                fontWeight: 500,
              }}
            >
              NEXT AGENT GAME
            </p>
            <motion.p
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              className="text-2xl text-[#ffd700]"
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 900,
              }}
            >
              {formatTime(nextGameTime)}
            </motion.p>
          </div>
        </div>

        {/* Separator */}
        <div className="w-px h-12 bg-[#2a2a3e]" />

        {/* Scrolling winners */}
        <div className="flex-1 overflow-hidden">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="flex gap-8"
          >
            {[...recentWinners, ...recentWinners].map((winner, i) => (
              <div key={i} className="flex items-center gap-3 shrink-0">
                <Trophy className="w-5 h-5 text-[#ffd700]" />
                <p
                  className="text-lg whitespace-nowrap"
                  style={{
                    fontFamily: "var(--font-rajdhani), sans-serif",
                    fontWeight: 600,
                  }}
                >
                  <span className="text-[#00d9ff]">{winner.name}</span>
                  <span className="text-white"> won </span>
                  <span className="text-[#ffd700]">
                    {winner.amount} {winner.token}
                  </span>
                </p>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
