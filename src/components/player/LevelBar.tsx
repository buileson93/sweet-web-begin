import { Sparkles, Star, TrendingUp } from "lucide-react";

import { cn } from "@/lib/utils";

export type LevelBarData = {
  level: number;
  title: string;
  into: number;
  need: number;
  percent: number;
  gained?: number;
  leveledUp?: boolean;
};

/** Thanh kinh nghiệm và cấp độ theo phong cách gamification. */
export function LevelBar({ data, className }: { data: LevelBarData; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Star className="size-4" strokeWidth={2.6} />
          </span>
          <span className="min-w-0">
            <span className="font-heading block text-sm font-extrabold">Cấp {data.level}</span>
            <span className="type-meta block truncate">{data.title}</span>
          </span>
        </span>
        {typeof data.gained === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold",
              data.leveledUp ? "bg-gold text-gold-foreground" : "bg-success/15 text-success",
            )}
          >
            {data.leveledUp ? <Sparkles className="size-3.5" /> : <TrendingUp className="size-3.5" />}
            +{data.gained} EXP
          </span>
        ) : null}
      </div>

      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out"
          style={{ width: `${Math.min(100, Math.max(2, data.percent))}%` }}
        />
      </div>
      <p className="type-meta mt-1.5 tabular-nums">
        {data.into}/{data.need} EXP tới cấp {data.level + 1}
        {data.leveledUp ? " · Vừa thăng cấp!" : ""}
      </p>
    </div>
  );
}
