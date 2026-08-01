import { Activity, Gauge, RefreshCw, Timer } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DuelNetStats } from "@/hooks/useDuelChannel";

function tone(value: number | null, warn: number, bad: number) {
  if (value === null) return "text-muted-foreground";
  if (value >= bad) return "text-destructive";
  if (value >= warn) return "text-warning";
  return "text-success";
}

/** Widget nhỏ hiển thị sức khoẻ realtime: ping, số lần kết nối lại, độ trễ sự kiện. */
export function NetStatsWidget({
  stats,
  className,
  onOpenLog,
}: {
  stats: DuelNetStats;
  className?: string;
  onOpenLog?: () => void;
}) {
  const items = [
    {
      icon: Gauge,
      label: "Ping",
      value: stats.ping === null ? "—" : `${stats.ping}ms`,
      hint: `Trung bình ${stats.avgPing ?? "—"}ms`,
      tone: tone(stats.ping, 400, 900),
    },
    {
      icon: RefreshCw,
      label: "Kết nối lại",
      value: String(stats.reconnects),
      hint: `Gói bỏ qua: ${stats.dropped}`,
      tone: tone(stats.reconnects, 1, 3),
    },
    {
      icon: Timer,
      label: "Trễ sự kiện",
      value: stats.eventLag === null ? "—" : `${stats.eventLag}ms`,
      hint: `Lệch đồng hồ ${stats.skew}ms`,
      tone: tone(stats.eventLag, 500, 1200),
    },
  ];

  return (
    <div className={cn("flex flex-wrap items-stretch gap-1.5", className)}>
      {items.map((it) => (
        <Tooltip key={it.label}>
          <TooltipTrigger asChild>
        <div className="flex min-w-[74px] flex-1 cursor-help items-center gap-1.5 rounded-xl border bg-card/80 px-2 py-1 backdrop-blur">
          <it.icon className={cn("size-3.5 shrink-0", it.tone)} />
          <span className="min-w-0">
            <span className={cn("block font-mono text-xs font-bold tabular-nums leading-tight", it.tone)}>
              {it.value}
            </span>
            <span className="block text-[9px] uppercase tracking-wide text-muted-foreground">
              {it.label}
            </span>
          </span>
        </div>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-semibold">{it.label}</p>
            <p>{it.hint}</p>
          </TooltipContent>
        </Tooltip>
      ))}
      {onOpenLog ? (
        <button
          type="button"
          onClick={onOpenLog}
          aria-label="Xem nhật ký sự cố của ván này"
          className="flex items-center gap-1 rounded-xl border bg-card/80 px-2 py-1 text-[10px] font-semibold text-muted-foreground transition hover:text-primary"
        >
          <Activity className="size-3.5" />
          <span className="hidden sm:inline">Nhật ký</span>
        </button>
      ) : null}
    </div>
  );
}
