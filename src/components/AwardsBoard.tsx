import { Crown, Flame, Gauge, Sparkles, TrendingUp, Zap } from "lucide-react";

import { computeAwards, type AwardKey, type AwardRow } from "@/lib/awards";
import { cn } from "@/lib/utils";

const STYLES: Record<AwardKey, { Icon: typeof Crown; ring: string; chip: string }> = {
  champion: { Icon: Crown, ring: "border-gold/60 bg-[oklch(0.97_0.05_92)]", chip: "surface-gold" },
  streak: { Icon: Flame, ring: "border-destructive/30 bg-destructive/5", chip: "bg-destructive text-destructive-foreground" },
  diligent: { Icon: Sparkles, ring: "border-primary/30 bg-primary/5", chip: "bg-primary text-primary-foreground" },
  speed: { Icon: Zap, ring: "border-accent/40 bg-accent/10", chip: "bg-accent text-accent-foreground" },
  points: { Icon: Gauge, ring: "border-success/40 bg-success/10", chip: "bg-success text-success-foreground" },
  progress: { Icon: TrendingUp, ring: "border-border bg-secondary", chip: "bg-secondary-foreground text-secondary" },
};

/** Bảng vinh danh nhiều hạng mục ngoài giải Vô địch. */
export function AwardsBoard({ rows, className }: { rows: AwardRow[]; className?: string }) {
  const awards = computeAwards(rows);
  if (awards.length === 0) return null;

  return (
    <section className={cn("stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3", className)}>
      {awards.map((a) => {
        const style = STYLES[a.key];
        return (
          <article
            key={a.key}
            className={cn(
              "group relative overflow-hidden rounded-2xl border p-4 transition-transform duration-300 hover:-translate-y-0.5",
              style.ring,
            )}
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-8 -top-8 size-24 rounded-full bg-foreground/5 transition-transform duration-500 group-hover:scale-125"
            />
            <div className="relative flex items-start gap-3">
              <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", style.chip)}>
                <style.Icon className="size-5" strokeWidth={2.4} />
              </span>
              <div className="min-w-0">
                <h3 className="font-heading text-sm font-extrabold uppercase tracking-tight">{a.title}</h3>
                <p className="type-meta">{a.description}</p>
              </div>
            </div>
            <div className="relative mt-3 flex items-end justify-between gap-3 border-t border-border/70 pt-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{a.name}</p>
                <p className="type-meta truncate">{a.unit}</p>
              </div>
              <span className="font-heading shrink-0 text-base font-extrabold text-primary">{a.value}</span>
            </div>
          </article>
        );
      })}
    </section>
  );
}
