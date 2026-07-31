import { CloudCog, RefreshCw, Wifi, WifiOff } from "lucide-react";

import { cn } from "@/lib/utils";

export type DuelConnectionStatus = "live" | "syncing" | "retrying" | "offline";

export function ConnectionBadge({
  status,
  latency,
}: {
  status: DuelConnectionStatus;
  latency: number | null;
}) {
  const slow = latency !== null && latency >= 650;
  const bad = latency !== null && latency >= 1200;
  const meta =
    status === "offline"
      ? { label: "Đứt kết nối", icon: WifiOff, tone: "text-destructive" }
      : status === "retrying"
        ? { label: "Đang thử lại", icon: RefreshCw, tone: "text-warning" }
        : status === "syncing"
          ? { label: "Đang đồng bộ", icon: CloudCog, tone: "text-warning" }
          : { label: slow ? "Kết nối chậm" : "Realtime ổn định", icon: Wifi, tone: slow ? "text-warning" : "text-success" };
  const Icon = meta.icon;

  return (
    <div
      className={cn("flex items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-[10px] font-semibold", meta.tone)}
      title={bad ? "Độ trễ cao, nên chờ kết nối ổn định trước khi chốt đáp án" : meta.label}
      role="status"
    >
      <Icon className={cn("size-3", (status === "syncing" || status === "retrying") && "animate-spin")} />
      <span className="hidden sm:inline">{meta.label}</span>
      <span className="font-mono tabular-nums">{latency === null ? "—" : `${latency}ms`}</span>
    </div>
  );
}