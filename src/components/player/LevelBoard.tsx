import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Star, Trophy } from "lucide-react";

import { AvatarBubble } from "@/components/player/AvatarBubble";
import { getTopPlayers } from "@/lib/player.functions";
import { cachedFetch } from "@/lib/cache/ttlCache";
import { cn } from "@/lib/utils";

/** Bảng xếp hạng kinh nghiệm: càng thi nhiều, càng đúng nhiều thì cấp càng cao. */
export function LevelBoard({ className }: { className?: string }) {
  const runTop = useServerFn(getTopPlayers);
  const query = useQuery({
    queryKey: ["top-players"],
    // Bảng xếp hạng không cần realtime: dùng lại kết quả 60 giây, kể cả khi tải lại trang.
    queryFn: () => cachedFetch("vatm:top-players:10", 60_000, () => runTop({ data: { limit: 10 } })),
    staleTime: 60_000,
  });

  const rows = (query.data ?? []).slice(0, 6);
  if (query.isLoading) {
    return <div className={cn("h-24 animate-pulse rounded-2xl bg-secondary", className)} />;
  }
  if (rows.length === 0) return null;

  return (
    <section className={cn("rounded-2xl border border-border bg-card p-3", className)}>
      <h2 className="font-heading mb-2 inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-tight text-muted-foreground">
        <Trophy className="size-3.5 text-gold" /> Cấp độ người chơi
      </h2>
      <ol className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((p, i) => (
          <li key={p.employeeId} className="flex items-center gap-2 rounded-xl bg-secondary/50 px-2 py-1.5">
            <span className="font-mono w-4 text-right text-[11px] text-muted-foreground">{i + 1}</span>
            <AvatarBubble name={p.displayName} avatarUrl={p.avatarUrl} avatarImage={p.avatarImage} size="sm" />
            <span className="min-w-0 flex-1 truncate text-xs font-bold">{p.displayName}</span>
            <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-extrabold text-primary">
              <Star className="size-3" /> {p.level}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

