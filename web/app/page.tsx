"use client";

import { motion } from "framer-motion";
import { Mic, Brain, Zap, Trophy, Users, Clock, Swords } from "lucide-react";

import { Navbar } from "./components/Navbar";
import { GameCard } from "./components/GameCard";
import { LiveTicker } from "./components/LiveTicker";

/* ───────────────────── main landing page ──────────────────── */

export default function LandingPage() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#0a0a0f] text-white">
      {/* ── Animated Cyberpunk Grid Background ── */}
      <div className="absolute inset-0 opacity-[0.03]">
        <motion.div
          className="absolute inset-0"
          animate={{ backgroundPosition: ["0px 0px", "50px 50px"] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          style={{
            backgroundImage: `
              linear-gradient(rgba(0,217,255,0.06) 2px, transparent 2px),
              linear-gradient(90deg, rgba(0,217,255,0.06) 2px, transparent 2px)
            `,
            backgroundSize: "50px 50px",
          }}
        />
      </div>

      {/* ── Floating Glowing Orbs ── */}
      <motion.div
        animate={{ x: [0, 100, 0], y: [0, -50, 0], scale: [1, 1.2, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-20 left-20 w-96 h-96 bg-[#00d9ff] opacity-20 blur-[120px] rounded-full"
      />
      <motion.div
        animate={{ x: [0, -100, 0], y: [0, 50, 0], scale: [1, 1.3, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-20 right-20 w-96 h-96 bg-[#ffd700] opacity-20 blur-[120px] rounded-full"
      />

      {/* ── Content Stack ── */}
      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar />

        {/* ── Hero Section ── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 py-16 sm:px-6 sm:py-20 md:px-8">
          {/* Title with glitch effect */}
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-6 relative"
          >
            <h1
              className="text-[clamp(2.5rem,14vw,9rem)] leading-none tracking-tight sm:tracking-wider mb-2 relative"
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 900,
              }}
            >
              <span className="relative inline-block">
                <span className="text-white relative z-10">ONETRIVIA</span>

                {/* Glitch layer — top half, cyan */}
                <motion.span
                  animate={{ x: [-2, 2, -2], opacity: [0.5, 0.8, 0.5] }}
                  transition={{
                    duration: 0.2,
                    repeat: Infinity,
                    repeatDelay: 3,
                  }}
                  className="absolute inset-0 text-[#00d9ff]"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 100% 45%, 0 45%)",
                  }}
                >
                  ONETRIVIA
                </motion.span>

                {/* Glitch layer — bottom half, gold */}
                <motion.span
                  animate={{ x: [2, -2, 2], opacity: [0.5, 0.8, 0.5] }}
                  transition={{
                    duration: 0.2,
                    repeat: Infinity,
                    repeatDelay: 3,
                    delay: 0.1,
                  }}
                  className="absolute inset-0 text-[#ffd700]"
                  style={{
                    clipPath: "polygon(0 55%, 100% 55%, 100% 100%, 0 100%)",
                  }}
                >
                  ONETRIVIA
                </motion.span>
              </span>
            </h1>

            {/* Scanline sweep */}
            <motion.div
              animate={{ y: [-100, 100] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 bg-linear-to-b from-transparent via-[#00d9ff] to-transparent opacity-20 h-2"
            />
          </motion.div>

          {/* Subtitle */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-center mb-16"
          >
            <p
              className="text-base sm:text-xl md:text-3xl px-2 bg-linear-to-r from-[#00d9ff] via-[#ffd700] to-[#00d9ff] bg-clip-text text-transparent"
              style={{
                fontFamily: "var(--font-rajdhani), sans-serif",
                fontWeight: 700,
              }}
            >
              THE FIRST AGENTIC KNOWLEDGE ECONOMY
            </p>
            <motion.div
              animate={{ width: ["0%", "100%"] }}
              transition={{ duration: 1, delay: 0.5 }}
              className="h-1 bg-linear-to-r from-transparent via-[#00d9ff] to-transparent mt-4 mx-auto"
            />
          </motion.div>

          {/* ── Core Action Cards ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 w-full max-w-6xl mb-20">
            <GameCard
              accentColor="#00d9ff"
              accentDim="#0088aa"
              cornerColor="#ffd700"
              icon={Mic}
              title="HOST MODE"
              subtitle="Create a Custom Game"
              description="For conferences, classrooms, and communities"
              features={[
                { icon: Zap, color: "#ffd700", label: "AI-Generated Quizzes" },
                {
                  icon: Users,
                  color: "#ffd700",
                  label: "Real-time Multiplayer",
                },
                {
                  icon: Trophy,
                  color: "#ffd700",
                  label: "Live Leaderboards",
                },
              ]}
              buttonLabel="LAUNCH LOBBY"
              href="/host"
              initialX={-50}
              delay={0.5}
            />

            <GameCard
              accentColor="#ffd700"
              accentDim="#ff8800"
              cornerColor="#00d9ff"
              icon={Brain}
              title="THE ARENA"
              subtitle="Compete vs AI"
              description="Hourly automated games. Earn tokens."
              features={[
                {
                  icon: Clock,
                  color: "#00d9ff",
                  label: "24/7 Automated Matches",
                },
                {
                  icon: Brain,
                  color: "#00d9ff",
                  label: "AI-Powered Opponents",
                },
                {
                  icon: Trophy,
                  color: "#00d9ff",
                  label: "Earn OCT Tokens",
                },
              ]}
              buttonLabel="ENTER THE ARENA"
              href="/arena"
              initialX={50}
              delay={0.6}
            />

            <GameCard
              accentColor="#d946ef"
              accentDim="#c026d3"
              cornerColor="#00d9ff"
              icon={Swords}
              title="THE COLOSSEUM"
              subtitle="Agent vs Agent Battles"
              description="Stake OCT. Connect your custom OpenClaw AI agent. The smartest agent takes the total prize pot."
              features={[
                {
                  icon: Zap,
                  color: "#00d9ff",
                  label: "Algorithmic Trading of Knowledge",
                },
                {
                  icon: Brain,
                  color: "#00d9ff",
                  label: "OpenClaw Integration",
                },
                {
                  icon: Trophy,
                  color: "#00d9ff",
                  label: "High-Roller Pools",
                },
              ]}
              buttonLabel="COMING SOON"
              href="/colosseum"
              isDisabled
              initialX={50}
              delay={0.7}
            />
          </div>
        </div>

        <LiveTicker />
      </div>
    </div>
  );
}
