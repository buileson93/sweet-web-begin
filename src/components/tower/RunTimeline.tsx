import { Castle, Crown, Flame, Gem, HelpCircle, Skull, Store, Swords, Zap } from "lucide-react";

import type { RunEvent } from "@/lib/tower/engine";
import { cn } from "@/lib/utils";

const KIND_ICON: Record<RunEvent["kind"], typeof Swords> = {
  start: Castle,
  room: Swords,
  combat: Zap,
  relic: Gem,
  skip: Store,
  curse: Skull,
  campfire: Flame,
  event: HelpCircle,
  shop: Store,
  end: Crown,
};

const KIND_TONE: Record<RunEvent["kind"], string> = {
  start: "text-primary",
  room: "text-sky-500",
  combat: "text-amber-500",
  relic: "text-fuchsia-500",
  skip: "text-muted-foreground",
  curse: "text-destructive",
  campfire: "text-orange-500",
  event: "text-emerald-500",
  shop: "text-emerald-500",
  end: "text-yellow-500",
};

const mmss = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

/** Xem lại toàn bộ diễn biến một hành trình — dựng từ hạt và chuỗi lựa chọn. */
export function RunTimeline({ log, className }: { log: RunEvent[]; className?: string }) {
  if (!log.length) return <p className="type-meta">Chưa có diễn biến nào được ghi lại.</p>;

  return (
    <ol className={cn("relative space-y-2 border-l pl-4", className)}>
      {log.map((ev, i) => {
        const Icon = KIND_ICON[ev.kind] ?? Swords;
        return (
          <li key={`${ev.t}-${i}`} className="relative animate-fade-in" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
            <span
              className={cn(
                "absolute -left-[22px] grid size-4 place-items-center rounded-full border bg-background",
                KIND_TONE[ev.kind],
              )}
            >
              <Icon className="size-2.5" />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[11px] tabular-nums opacity-60">{mmss(ev.t)}</span>
              <span className="text-sm font-medium">{ev.label}</span>
              {typeof ev.hp === "number" && (
                <span className="type-meta">· {ev.hp} máu</span>
              )}
            </div>
            {ev.detail && <p className="type-meta">{ev.detail}</p>}
          </li>
        );
      })}
    </ol>
  );
}
