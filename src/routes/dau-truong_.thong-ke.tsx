import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Activity,
  ArrowLeft,
  Flame,
  Loader2,
  Percent,
  Swords,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { PageContainer, PageHero, SectionHeading } from "@/components/ui-kit";
import { arenaMyStats } from "@/lib/arena.functions";
import { getArenaToken } from "@/lib/arena/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dau-truong_/thong-ke")({
  component: ArenaStatsPage,
  head: () => ({
    meta: [
      { title: "Thống kê so tài — Hội thi trắc nghiệm VATM" },
      {
        name: "description",
        content:
          "Theo dõi biến động Elo, chuỗi thắng thua và lịch sử so tài 1vs1 của bạn theo thời gian.",
      },
      { property: "og:title", content: "Thống kê so tài — Hội thi trắc nghiệm VATM" },
      {
        property: "og:description",
        content: "Biểu đồ Elo, phong độ gần đây và toàn bộ lịch sử so tài của bạn.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Stats = Awaited<ReturnType<typeof arenaMyStats>>;

function ArenaStatsPage() {
  const navigate = useNavigate();
  const load = useServerFn(arenaMyStats);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getArenaToken();
    if (!token) {
      void navigate({ to: "/dau-truong" });
      return;
    }
    let alive = true;
    load({ data: { token } })
      .then((res) => alive && setStats(res))
      .catch((e) => alive && setError(e instanceof Error ? e.message : "Không tải được thống kê."));
    return () => {
      alive = false;
    };
  }, [load, navigate]);

  if (error)
    return (
      <PageContainer className="grid min-h-[50vh] place-items-center text-center">
        <div className="space-y-3">
          <p className="text-destructive">{error}</p>
          <Button variant="outline" onClick={() => void navigate({ to: "/dau-truong" })}>
            <ArrowLeft className="mr-2 size-4" /> Về đấu trường
          </Button>
        </div>
      </PageContainer>
    );

  if (!stats)
    return (
      <PageContainer className="grid min-h-[50vh] place-items-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </PageContainer>
    );

  const chartData = stats.timeline.map((p, i) => ({
    name: `#${i + 1}`,
    elo: p.elo,
    opponent: p.opponent,
    delta: p.delta,
  }));

  const cards = [
    { icon: TrendingUp, label: "Elo hiện tại", value: `${stats.elo}`, hint: `Đỉnh cao ${stats.peakElo}` },
    { icon: Percent, label: "Tỉ lệ thắng", value: `${stats.winRate}%`, hint: `${stats.wins}T · ${stats.draws}H · ${stats.losses}B` },
    { icon: Flame, label: "Chuỗi thắng", value: `${stats.currentStreak}`, hint: `Kỷ lục ${stats.bestStreak}` },
    { icon: Activity, label: "Sát thương TB", value: `${stats.avgDamage}`, hint: `${stats.games} ván so tài` },
  ];

  return (
    <PageContainer className="space-y-6 py-6">
      <PageHero
        title="Thống kê so tài"
        description={`${stats.displayName} · ${stats.unit} · Hạng ${stats.tier.icon} ${stats.tier.label}`}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-card p-4 text-center shadow-sm">
            <c.icon className="mx-auto size-5 text-primary" />
            <p className="mt-1 text-2xl font-black tabular-nums">{c.value}</p>
            <p className="text-xs font-medium">{c.label}</p>
            <p className="text-[11px] text-muted-foreground">{c.hint}</p>
          </div>
        ))}
      </div>

      <section className="space-y-2">
        <SectionHeading title="Biến động Elo" />
        {chartData.length > 1 ? (
          <div className="h-64 rounded-2xl border bg-card p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="eloFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={["dataMin - 20", "dataMax + 20"]} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, fontSize: 12 }}
                  formatter={(v: number) => [`${v}`, "Elo"]}
                  labelFormatter={(_l, payload) =>
                    `vs ${payload?.[0]?.payload?.opponent ?? ""}`
                  }
                />
                <Area
                  type="monotone"
                  dataKey="elo"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#eloFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Cần ít nhất 2 ván so tài để vẽ biểu đồ biến động.
          </p>
        )}
      </section>

      <section className="space-y-2">
        <SectionHeading title="Phong độ gần đây" />
        <div className="flex flex-wrap gap-1.5">
          {stats.form.length ? (
            stats.form.map((r, i) => (
              <span
                key={i}
                className={cn(
                  "grid size-9 place-items-center rounded-xl text-sm font-bold",
                  r === "win"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : r === "draw"
                      ? "bg-muted text-muted-foreground"
                      : "bg-rose-500/15 text-rose-600",
                )}
                title={r === "win" ? "Thắng" : r === "draw" ? "Hoà" : "Thua"}
              >
                {r === "win" ? "T" : r === "draw" ? "H" : "B"}
              </span>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">Chưa có ván nào.</p>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <SectionHeading title="Lịch sử so tài" />
        <ul className="space-y-1.5">
          {[...stats.timeline].reverse().map((p) => (
            <li
              key={`${p.duelId}-${p.at}`}
              className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2 text-sm"
            >
              <span
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs font-semibold",
                  p.result === "win"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : p.result === "draw"
                      ? "bg-muted text-muted-foreground"
                      : "bg-rose-500/15 text-rose-600",
                )}
              >
                {p.result === "win" ? "Thắng" : p.result === "draw" ? "Hoà" : "Thua"}
              </span>
              <span className="min-w-0 flex-1 truncate">vs {p.opponent}</span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                ❤️ {p.hp} · ⚔️ {p.damageDealt}
              </span>
              <span
                className={cn(
                  "w-12 text-right font-mono",
                  p.delta >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {p.delta >= 0 ? "+" : ""}
                {p.delta}
              </span>
              <Button asChild size="sm" variant="ghost" className="shrink-0">
                <Link to="/dau-truong/xem-lai/$duelId" params={{ duelId: p.duelId }}>
                  Xem lại
                </Link>
              </Button>
            </li>
          ))}
          {!stats.timeline.length ? (
            <li className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
              Chưa có ván so tài nào được ghi nhận.
            </li>
          ) : null}
        </ul>
      </section>

      <div className="text-center">
        <Button variant="outline" onClick={() => void navigate({ to: "/dau-truong" })}>
          <Swords className="mr-2 size-4" /> Về đấu trường
        </Button>
      </div>
    </PageContainer>
  );
}
