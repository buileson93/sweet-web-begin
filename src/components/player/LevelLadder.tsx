import { Check, Lock, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { LEVEL_TIERS } from "@/lib/xp";

/** Bảng 10 cấp bậc dựng sẵn kèm phần thưởng, làm nổi cấp hiện tại. */
export function LevelLadder({ level, className }: { level: number; className?: string }) {
  const current = Math.max(1, Math.floor(level || 1));

  return (
    <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
      {LEVEL_TIERS.map((tier) => {
        const unlocked = current >= tier.level;
        const isCurrent = Math.min(current, LEVEL_TIERS.length) === tier.level;
        return (
          <div
            key={tier.level}
            className={cn(
              "flex items-center gap-3 rounded-xl border p-3 transition-all duration-200",
              unlocked ? "border-primary/25 bg-secondary/50" : "border-border/60 opacity-70",
              isCurrent && "border-primary/60 shadow-[var(--shadow-lift)]",
            )}
          >
            <span
              className={cn(
                "grid size-10 shrink-0 place-items-center rounded-full font-heading text-sm font-extrabold",
                tier.tone,
              )}
            >
              {tier.level}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-extrabold">{tier.title}</p>
              <p className="truncate text-xs text-muted-foreground">{tier.reward}</p>
            </div>
            {isCurrent ? (
              <Sparkles aria-label="Cấp bậc hiện tại" className="size-4 shrink-0 text-primary" />
            ) : unlocked ? (
              <Check aria-label="Đã mở khoá" className="size-4 shrink-0 text-primary/70" />
            ) : (
              <Lock aria-label="Chưa mở khoá" className="size-4 shrink-0 text-muted-foreground" />
            )}
          </div>
        );
      })}
    </div>
  );
}
