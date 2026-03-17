"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export interface GameCardProps {
  accentColor: string;
  accentDim: string;
  cornerColor: string;
  icon: React.ElementType;
  title: string;
  subtitle: string;
  description: string;
  features: { icon: React.ElementType; color: string; label: string }[];
  buttonLabel: string;
  href: string;
  isDisabled?: boolean;
  initialX: number;
  delay: number;
}

export function GameCard({
  accentColor,
  accentDim,
  cornerColor,
  icon: Icon,
  title,
  subtitle,
  description,
  features,
  buttonLabel,
  href,
  isDisabled = false,
  initialX,
  delay,
}: GameCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: initialX }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay }}
      whileHover={{ scale: 1.02, y: -5 }}
      className="relative group"
    >
      {/* Outer glow */}
      <div
        className="absolute inset-0 opacity-20 blur-xl rounded-2xl group-hover:opacity-30 transition-opacity"
        style={{
          background: `linear-gradient(to bottom right, ${accentColor}, ${accentDim})`,
        }}
      />

      <div
        className="relative bg-[#1a1a2e] rounded-2xl p-10 overflow-hidden"
        style={{ border: `4px solid ${accentColor}` }}
      >
        {/* Animated shimmer overlay */}
        <motion.div
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 opacity-30"
          style={{
            background: `linear-gradient(to right, transparent, ${accentColor}, transparent)`,
          }}
        />

        <div className="relative z-10">
          {/* Icon circle */}
          <motion.div
            whileHover={{ rotate: [0, -10, 10, 0] }}
            transition={{ duration: 0.5 }}
            className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{
              background: `linear-gradient(to bottom right, ${accentColor}, ${accentDim})`,
              boxShadow: `0 0 40px ${accentColor}80`,
            }}
          >
            <Icon className="w-12 h-12 text-[#0a0a0f]" strokeWidth={2.5} />
          </motion.div>

          {/* Title */}
          <h2
            className="text-4xl text-center mb-3"
            style={{
              fontFamily: "var(--font-orbitron), sans-serif",
              fontWeight: 900,
              color: accentColor,
            }}
          >
            {title}
          </h2>

          {/* Subtitle */}
          <p
            className="text-xl text-white mb-2 text-center"
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontWeight: 600,
            }}
          >
            {subtitle}
          </p>

          {/* Description */}
          <p
            className="text-base text-[#8b8b9a] mb-8 text-center"
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              fontWeight: 500,
            }}
          >
            {description}
          </p>

          {/* Feature list */}
          <div className="space-y-3 mb-8">
            {features.map((f) => (
              <div key={f.label} className="flex items-center gap-3">
                <f.icon className="w-5 h-5" style={{ color: f.color }} />
                <span
                  className="text-sm text-white"
                  style={{
                    fontFamily: "var(--font-rajdhani), sans-serif",
                    fontWeight: 600,
                  }}
                >
                  {f.label}
                </span>
              </div>
            ))}
          </div>

          {/* CTA button wrapped in Link when active */}
          {isDisabled ? (
            <motion.button
              disabled
              aria-disabled="true"
              className="w-full rounded-xl py-5 text-center text-[#0a0a0f] opacity-50 cursor-not-allowed"
              style={{
                fontFamily: "var(--font-orbitron), sans-serif",
                fontWeight: 900,
                fontSize: "1.5rem",
                background: `linear-gradient(to right, ${accentColor}, ${accentDim})`,
                boxShadow: `0 0 30px ${accentColor}66`,
              }}
            >
              {buttonLabel}
            </motion.button>
          ) : (
            <Link href={href} className="block">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full rounded-xl py-5 text-center text-[#0a0a0f] cursor-pointer"
                style={{
                  fontFamily: "var(--font-orbitron), sans-serif",
                  fontWeight: 900,
                  fontSize: "1.5rem",
                  background: `linear-gradient(to right, ${accentColor}, ${accentDim})`,
                  boxShadow: `0 0 30px ${accentColor}66`,
                }}
              >
                {buttonLabel}
              </motion.button>
            </Link>
          )}
        </div>

        {/* Corner accents (opposite accent colour) */}
        <div
          className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4"
          style={{ borderColor: cornerColor }}
        />
        <div
          className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4"
          style={{ borderColor: cornerColor }}
        />
        <div
          className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4"
          style={{ borderColor: cornerColor }}
        />
        <div
          className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4"
          style={{ borderColor: cornerColor }}
        />
      </div>
    </motion.div>
  );
}
