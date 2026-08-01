import { useEffect, useRef, useState } from "react";
import { Heart, Shield } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  hp: number;
  max: number;
  shield: number;
  className?: string;
};

/**
 * Thanh máu hành trình: hiển thị máu hiện tại, phần khiên chồng lên, và nháy đỏ
 * khi vừa mất máu / nháy xanh khi vừa hồi máu để người chơi thấy rõ hậu quả mỗi câu.
 */
export function HpBar({ hp, max, shield, className }: Props) {
  const total = max || 1;
  const pct = Math.max(0, Math.min(100, (hp / total) * 100));
  const shieldPct = Math.max(0, Math.min(100 - pct, (shield / total) * 100));
  const low = pct <= 30;

  const prev = useRef(hp);
  const [flash, setFlash] = useState<"hit" | "heal" | null>(null);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    const diff = hp - prev.current;
    prev.current = hp;
    if (!diff) return;
    setFlash(diff < 0 ? "hit" : "heal");
    setDelta(diff);
    const t = window.setTimeout(() => {
      setFlash(null);
      setDelta(null);
    }, 900);
    return () => window.clearTimeout(t);
  }, [hp]);

  return (
    <div
      className={cn("flex min-w-0 items-center gap-2", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={hp}
      aria-label={`Máu ${hp} trên ${total}${shield > 0 ? `, khiên ${shield}` : ""}`}
    >
      <Heart
        className={cn(
          "size-4 shrink-0 text-destructive transition-transform",
          low && "animate-pulse",
          flash === "hit" && "scale-125",
        )}
      />
      <div
        className={cn(
          "relative h-3 w-24 flex-1 overflow-hidden rounded-full bg-muted transition-shadow sm:w-40 sm:flex-none",
          flash === "hit" && "shadow-[0_0_0_2px_var(--destructive)]",
          flash === "heal" && "shadow-[0_0_0_2px_oklch(0.72_0.14_160)]",
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            low ? "bg-gradient-to-r from-destructive to-orange-500" : "bg-gradient-to-r from-emerald-500 to-destructive",
          )}
          style={{ width: `${pct}%` }}
        />
        {shieldPct > 0 ? (
          <div
            aria-hidden
            className="absolute inset-y-0 rounded-full bg-sky-400/70"
            style={{ left: `${pct}%`, width: `${shieldPct}%` }}
          />
        ) : null}
      </div>
      <span className="type-meta shrink-0 tabular-nums">
        {hp}/{total}
      </span>
      {shield > 0 ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600">
          <Shield className="size-3" /> {shield}
        </span>
      ) : null}
      {delta ? (
        <span
          className={cn(
            "type-meta shrink-0 animate-fade-in font-bold tabular-nums",
            delta < 0 ? "text-destructive" : "text-emerald-600",
          )}
        >
          {delta > 0 ? `+${delta}` : delta}
        </span>
      ) : null}
    </div>
  );
}
