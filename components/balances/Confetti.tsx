"use client"

import { useMemo } from "react"

const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"]

/**
 * Lightweight, dependency-free confetti burst for the "all settled up" state.
 * Renders a handful of colored pieces that fall + spin once via CSS keyframes.
 */
export function Confetti({ pieces = 40 }: { pieces?: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }).map((_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 1.8 + Math.random() * 1.2,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 6,
        rotate: Math.random() * 360,
      })),
    [pieces]
  )

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {bits.map((b, i) => (
        <span
          key={i}
          style={{
            position: "absolute",
            top: "-12px",
            left: `${b.left}%`,
            width: `${b.size}px`,
            height: `${b.size * 0.4}px`,
            background: b.color,
            transform: `rotate(${b.rotate}deg)`,
            borderRadius: "1px",
            animation: `fs-confetti ${b.duration}s ${b.delay}s ease-in forwards`,
          }}
        />
      ))}
      <style>{`
        @keyframes fs-confetti {
          0% { opacity: 1; transform: translateY(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(320px) rotate(540deg); }
        }
      `}</style>
    </div>
  )
}
