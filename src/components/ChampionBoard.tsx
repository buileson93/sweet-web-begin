import { Crown, Flame, Zap } from "lucide-react";

import { rankChampions, type ChampionRow } from "@/lib/champions";
import { cn } from "@/lib/utils";

/**
 * Bảng vô địch riêng: tôn vinh người kiếm nhiều điểm nhờ chuỗi đúng liên tiếp
 * và nhân đôi điểm (khác bảng xếp hạng chính xếp theo tỉ lệ đúng).
 */
export function ChampionBoard({ rows, className }: { rows: ChampionRow[]; className?: string }) {
  const champions = rankChampions(rows, 10);
  if (champions.length === 0) return null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-2xl border border-gold/40 bg-[linear-gradient(140deg,color-mix(in_oklab,var(--color-gold)_16%,transparent),transparent_60%)] p-4",
        className,
      )}
    >
      <Crown aria-hidden className="animate-float pointer-events-none absolute -right-5 -top-5 size-24 text-gold/15" />
      <header className="relative mb-3">
        <h2 className="font-heading inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
          <Crown className="size-4 text-gold" /> Bảng vô địch điểm thưởng
        </h2>
        <p className="type-meta mt-0.5">Xếp theo điểm kiếm thêm từ chuỗi đúng liên tiếp và nhân đôi điểm.</p>
      </header>

      <ol className="relative space-y-1.5">
        {champions.map((c, i) => (
          <li
            key={c.id}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-transparent px-2 py-1.5",
              i === 0 && "border-gold/50 bg-gold/10",
            )}
          >
            <span
              className={cn(
                "font-mono grid size-6 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold",
                i === 0 ? "surface-gold" : "bg-secondary text-muted-foreground",
              )}
            >
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{c.candidate_name}</span>
              <span className="type-meta block truncate">{c.unit || "Chưa rõ đơn vị"}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              <Flame className="size-3" /> {c.bestStreak}
            </span>
            <span className="font-mono inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">
              <Zap className="size-3" /> +{c.bonusPoints}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
