"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { ANSWER_COLORS } from "../../constants";
import { ArenaQuestion } from "../../types/game";

type AnsweringScreenProps = {
  sendingIndex: number | null;
  onAnswer: (index: number) => void;
  currentQuestion: ArenaQuestion | null;
  questionIndex: number;
  totalQuestions: number;
};

export function AnsweringScreen({
  sendingIndex,
  onAnswer,
  currentQuestion,
  questionIndex,
  totalQuestions,
}: AnsweringScreenProps) {
  const isSending = sendingIndex !== null;
  const options = Array.from(
    { length: 4 },
    (_, i) => currentQuestion?.options[i] ?? "-",
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-4 pb-3">
        {totalQuestions > 0 && (
          <p className="text-[10px] uppercase tracking-widest text-center text-(--cyber-muted) font-orbitron mb-2">
            Question {questionIndex + 1} / {totalQuestions}
          </p>
        )}
        <div
          className="relative rounded-xl border border-(--cyber-accent)/40 px-4 py-3 overflow-hidden"
          style={{
            background: "rgba(0,217,255,0.06)",
            boxShadow: "0 0 24px rgba(0,217,255,0.08)",
          }}
        >
          <motion.div
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-(--cyber-accent) to-transparent"
          />
          <h2
            className="text-center text-lg sm:text-xl md:text-2xl font-bold leading-snug text-white"
            style={{
              fontFamily: "var(--font-rajdhani), sans-serif",
              textShadow: "0 0 20px rgba(0,217,255,0.25)",
            }}
          >
            {currentQuestion?.question_text ?? "Loading question..."}
          </h2>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-2 grid-rows-2 gap-3 p-4">
        {ANSWER_COLORS.map((color) => {
          const isThisSending = sendingIndex === color.index;
          const isDisabled = isSending && !isThisSending;
          const optionText = options[color.index];

          return (
            <motion.button
              key={color.id}
              whileTap={!isSending ? { scale: 0.92 } : undefined}
              onClick={() => onAnswer(color.index)}
              disabled={isSending}
              className="relative rounded-2xl border-4 border-white/20 overflow-hidden
                         flex flex-col items-center justify-center gap-2
                         min-h-36 transition-opacity duration-200"
              style={{
                background: isThisSending ? color.active : color.hex,
                opacity: isDisabled ? 0.4 : 1,
                pointerEvents: isDisabled ? "none" : "auto",
              }}
            >
              <div
                className="absolute inset-0 pointer-events-none opacity-10"
                style={{
                  background:
                    "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)",
                }}
              />

              <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-white/40 rounded-tl-md" />
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-white/40 rounded-tr-md" />
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-white/40 rounded-bl-md" />
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-white/40 rounded-br-md" />

              <span className="relative z-10 w-full px-3">
                {isThisSending ? (
                  <span className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 text-white animate-spin" />
                    <span className="text-base font-orbitron font-bold text-white/90">
                      Sending...
                    </span>
                  </span>
                ) : (
                  <span
                    className="block text-center font-orbitron font-black text-white drop-shadow-lg
                               leading-tight wrap-break-word hyphens-auto
                               text-base sm:text-lg md:text-xl"
                    style={{ textShadow: "0 2px 10px rgba(0,0,0,0.6)" }}
                  >
                    {optionText}
                  </span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
