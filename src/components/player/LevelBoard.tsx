import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Trophy } from "lucide-react";

import { getTopPlayers } from "@/lib/player.functions";
import { cn } from "@/lib/utils";

/** Bảng xếp hạng kinh nghiệm: càng thi nhiều, càng đúng nhiều thì cấp càng cao. */
export function LevelBoard({ className }: { className?: string }) {
  const runTop = useServerFn(getTopPlayers);
  const query = useQuery({
    queryKey: ["top-players"],
    queryFn: () => runTop({ data: { limit: 10 } }),
    staleTime: 60_000,
  });

  const rows = query.data ?? [];
  if (query.isLoading) {
    return <div className={cn("h-40 animate-pulse rounded-2xl bg-secondary", className)} />;
  }
  if (rows.length === 0) return null;

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4", className)}>
      <h2 className="font-heading mb-3 inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
        <Trophy className="size-4 text-gold" /> Cấp độ chinh phục bầu trời
      </h2>
      <ol className="space-y-2">
        {rows.map((p, i) => (
          <li key={p.employeeId} className="flex items-center gap-3">
            <span className="font-mono w-5 text-right text-xs text-muted-foreground">{i + 1}</span>
            {p.avatarImage ? (
              <img
                src={p.avatarImage}
                alt=""
                loading="lazy"
                className="size-9 shrink-0 rounded-full border border-border bg-secondary object-cover"
              />
            ) : (
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-xs font-bold">
                {p.displayName.trim().slice(0, 1).toUpperCase() || "?"}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold">{p.displayName}</span>
              <span className="type-meta block truncate">{p.unit || "Chưa rõ đơn vị"}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs font-extrabold text-primary">
              <Star className="size-3.5" /> {p.level}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
