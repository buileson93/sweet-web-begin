import { lazy, Suspense, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { Crown, Sparkles } from "lucide-react";

import { AvatarBubble } from "@/components/player/AvatarBubble";
import type { PodiumPlayer } from "@/components/player/OfficePodium3D";
import { getTopPlayers } from "@/lib/player.functions";
import { cn } from "@/lib/utils";

const OfficePodium3D = lazy(() => import("@/components/player/OfficePodium3D"));

/**
 * Sân khấu vinh danh: người dẫn đầu bảng xếp hạng đứng bằng nhân vật 3D
 * trong không gian văn phòng. Trên máy yếu/thiết bị không dựng được 3D thì
 * vẫn có danh sách vòng tròn phía dưới.
 */
export function PodiumStage({
  className,
  fallback = [],
}: {
  className?: string;
  /** Dùng khi chưa ai tạo hồ sơ nhân vật: lấy tạm top bảng kết quả. */
  fallback?: PodiumPlayer[];
}) {
  const runTop = useServerFn(getTopPlayers);
  const [ready, setReady] = useState(false);
  const query = useQuery({
    queryKey: ["top-players", "podium"],
    queryFn: () => runTop({ data: { limit: 3 } }),
    staleTime: 60_000,
  });

  const fromProfiles: PodiumPlayer[] = (query.data ?? []).map((p) => ({
    employeeId: p.employeeId,
    displayName: p.displayName,
    unit: p.unit,
    level: p.level,
    xp: p.xp,
    examsPassed: p.examsPassed,
    avatarUrl: p.avatarUrl,
    avatarImage: p.avatarImage,
  }));

  const players = fromProfiles.length > 0 ? fromProfiles : fallback.slice(0, 3);

  if (query.isLoading) return <div className={cn("h-72 animate-pulse rounded-2xl bg-secondary", className)} />;
  if (players.length === 0) return null;

  return (
    <section className={cn("overflow-hidden rounded-2xl border border-border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h2 className="font-heading inline-flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight">
          <Crown className="size-4 text-gold" /> Sân khấu vinh danh
        </h2>
        <Link
          to="/nhan-vat"
          className="type-meta inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 font-bold hover:text-foreground"
        >
          <Sparkles className="size-3.5" /> Nhân vật của tôi
        </Link>
      </div>

      <div className="relative h-72 w-full sm:h-96" onPointerEnter={() => setReady(true)}>
        <Suspense fallback={<div className="size-full animate-pulse bg-secondary" />}>
          {ready || typeof window !== "undefined" ? <OfficePodium3D players={players} /> : null}
        </Suspense>
      </div>

      <ul className="flex flex-wrap items-center justify-center gap-4 border-t border-border px-4 py-3">
        {players.map((p, i) => (
          <li key={p.employeeId} className="flex items-center gap-2">
            <AvatarBubble name={p.displayName} avatarImage={p.avatarImage} size="sm" level={p.level} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">{p.displayName}</span>
              <span className="type-meta block truncate">Hạng {i + 1} · {p.xp} EXP</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
