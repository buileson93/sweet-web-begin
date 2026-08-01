import { Flame, Gem, HeartPulse, Layers } from "lucide-react";

import { scoreBreakdown, type RunScoreInput } from "@/lib/tower/score";
import { cn } from "@/lib/utils";

const ICON: Record<string, typeof Flame> = {
  floors: Layers,
  hp: HeartPulse,
  relics: Gem,
  curses: Flame,
};

const BAR: Record<string, string> = {
  floors: "bg-primary",
  hp: "bg-emerald-500",
  relics: "bg-fuchsia-500",
  curses: "bg-destructive",
};

/** Đồ thị cột đơn giản: điểm hành trình đến từ đâu. */
export function ScoreSources({ input, className }: { input: RunScoreInput; className?: string }) {
  const { parts, total } = scoreBreakdown(input);
  const max = Math.max(1, ...parts.map((p) => p.value));

  return (
    <div className={cn("space-y-2", className)}>
      {parts.map((p) => {
        const Icon = ICON[p.key] ?? Layers;
        const pct = Math.round((p.value / max) * 100);
        return (
          <div key={p.key} className="space-y-1">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                <Icon className="size-3.5 opacity-70" /> {p.label}
              </span>
              <span className="font-mono tabular-nums">
                {p.value}
                <span className="ml-1 opacity-60">({total ? Math.round((p.value / total) * 100) : 0}%)</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-700", BAR[p.key] ?? "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="type-meta opacity-70">{p.hint}</p>
          </div>
        );
      })}
      <div className="flex items-center justify-between border-t pt-2 text-sm font-semibold">
        <span>Tổng điểm hành trình</span>
        <span className="font-mono tabular-nums">{total}</span>
      </div>
    </div>
  );
}
