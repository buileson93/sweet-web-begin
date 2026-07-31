import { useMemo } from "react";
import { cn } from "@/lib/utils";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--success))",
  "hsl(var(--warning))",
  "hsl(var(--accent))",
];

/**
 * Confetti ăn mừng khi hoàn thành bài thi.
 * Thuần CSS, không chặn tương tác, tự tắt khi người dùng bật reduced-motion.
 */
export function Celebration({ pieces = 60, className }: { pieces?: number; className?: string }) {
  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 1.2,
        duration: 2.6 + Math.random() * 1.8,
        size: 6 + Math.random() * 7,
        color: COLORS[i % COLORS.length],
        rotate: Math.random() * 360,
        round: i % 3 === 0,
      })),
    [pieces],
  );

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-50 overflow-hidden", className)}
    >
      {bits.map((b) => (
        <span
          key={b.id}
          className="confetti-piece absolute top-[-8%]"
          style={{
            left: `${b.left}%`,
            width: b.size,
            height: b.size * (b.round ? 1 : 1.7),
            background: b.color,
            borderRadius: b.round ? "9999px" : "2px",
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            transform: `rotate(${b.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

export default Celebration;
