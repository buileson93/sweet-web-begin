import { useMemo } from "react";

import { bossAt } from "@/lib/tower/bosses";
import { FLOORS, ROOM_META, type Room, type RoomKind } from "@/lib/tower/map";
import { cn } from "@/lib/utils";

/** Toạ độ ngang (%) của các nút theo số phòng của tầng. */
function columnsFor(count: number): number[] {
  if (count <= 1) return [50];
  if (count === 2) return [26, 74];
  return [16, 50, 84];
}

const NODE_TONE: Record<RoomKind, { ring: string; glow: string; fill: string }> = {
  combat: { ring: "border-sky-400/70", glow: "shadow-[0_0_18px_-4px_oklch(0.72_0.14_240)]", fill: "bg-sky-500/15" },
  elite: { ring: "border-rose-400/70", glow: "shadow-[0_0_18px_-4px_oklch(0.66_0.18_20)]", fill: "bg-rose-500/15" },
  event: { ring: "border-amber-400/70", glow: "shadow-[0_0_18px_-4px_oklch(0.78_0.15_80)]", fill: "bg-amber-500/15" },
  shop: { ring: "border-emerald-400/70", glow: "shadow-[0_0_18px_-4px_oklch(0.72_0.14_160)]", fill: "bg-emerald-500/15" },
  campfire: { ring: "border-orange-400/70", glow: "shadow-[0_0_18px_-4px_oklch(0.74_0.16_50)]", fill: "bg-orange-500/15" },
  boss: { ring: "border-yellow-300/80", glow: "shadow-[0_0_26px_-4px_oklch(0.85_0.17_92)]", fill: "bg-yellow-400/20" },
};

type Props = {
  map: Room[][];
  /** Tầng đang đứng, đánh số từ 1. */
  floor: number;
  /** Loại phòng đã đi qua ở từng tầng trước đó. */
  path: RoomKind[];
  /** Có đang cho chọn phòng ở tầng hiện tại hay không. */
  canPick: boolean;
  onPick: (index: number) => void;
  className?: string;
};

/**
 * Bản đồ leo tháp kiểu roguelike: 12 tầng xếp từ dưới lên, mỗi tầng là các nút
 * phòng nối nhau bằng đường dẫn. Tầng đã qua mờ đi và ghim đường đã chọn,
 * tầng hiện tại phát sáng và bấm được, tầng phía trên hé lộ dần.
 */
export function TowerMap({ map, floor, path, canPick, onPick, className }: Props) {
  const floors = useMemo(() => map.slice(0, FLOORS), [map]);

  return (
    <div
      className={cn(
        "tower-map relative overflow-hidden rounded-2xl border border-primary/25 p-3 sm:p-4",
        className,
      )}
    >
      <div aria-hidden className="tower-map__sky pointer-events-none absolute inset-0" />
      <div aria-hidden className="tower-map__stars pointer-events-none absolute inset-0" />

      <ol className="relative flex flex-col-reverse gap-0">
        {floors.map((rooms, fi) => {
          const f = fi + 1;
          const state = f < floor ? "past" : f === floor ? "current" : "future";
          const cols = columnsFor(rooms.length);
          const takenKind = path[f - 1];
          const upper = floors[fi + 1];
          const upperCols = upper ? columnsFor(upper.length) : [];

          return (
            <li key={f} className="relative">
              {/* Đường nối lên tầng trên */}
              {upper ? (
                <svg
                  aria-hidden
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none h-8 w-full sm:h-10"
                >
                  {cols.map((x) =>
                    upperCols.map((ux) => (
                      <line
                        key={`${x}-${ux}`}
                        x1={x}
                        y1="100"
                        x2={ux}
                        y2="0"
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={state === "past" ? 1 : 1.5}
                        strokeDasharray="3 4"
                        className={cn(
                          state === "past" ? "stroke-primary/50" : state === "current" ? "stroke-primary/70" : "stroke-foreground/15",
                        )}
                      />
                    )),
                  )}
                </svg>
              ) : null}

              <div className="relative flex items-center gap-2 py-1">
                <span
                  className={cn(
                    "font-mono w-8 shrink-0 text-right text-[11px] tabular-nums",
                    state === "current" ? "font-extrabold text-primary" : "text-muted-foreground/70",
                  )}
                >
                  T{f}
                </span>
                <div className="relative flex-1">
                  {rooms.map((room, i) => {
                    const meta = ROOM_META[room.kind];
                    const tone = NODE_TONE[room.kind];
                    const boss = room.kind === "boss" ? bossAt(f) : undefined;
                    const taken = state === "past" && takenKind === room.kind;
                    const active = state === "current" && canPick;
                    const label = boss ? boss.name : meta.label;

                    return (
                      <button
                        key={`${room.kind}-${i}`}
                        type="button"
                        disabled={!active}
                        onClick={() => onPick(i)}
                        title={`Tầng ${f} · ${label} — ${boss ? boss.rule : meta.desc}`}
                        aria-label={`Tầng ${f}, ${label}`}
                        style={{ left: `${cols[i]}%` }}
                        className={cn(
                          "group absolute top-1/2 -translate-x-1/2 -translate-y-1/2",
                          "grid size-10 place-items-center rounded-full border-2 text-base transition-all duration-300 sm:size-12 sm:text-lg",
                          tone.ring,
                          tone.fill,
                          state === "future" && "opacity-35 grayscale",
                          state === "past" && (taken ? "opacity-95" : "opacity-25 grayscale"),
                          taken && "ring-2 ring-primary/60",
                          active && cn("cursor-pointer hover:scale-115 hover:-rotate-3", tone.glow, "tower-node--live"),
                          !active && "cursor-default",
                        )}
                      >
                        <span className="transition-transform duration-300 group-hover:scale-110">{meta.icon}</span>
                        {active ? (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-full border-2 border-primary/50 tower-node__pulse"
                          />
                        ) : null}
                        {taken ? (
                          <span
                            aria-hidden
                            className="absolute -bottom-1 -right-1 grid size-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
                          >
                            ✓
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                  {/* Giữ chiều cao hàng */}
                  <div className="h-11 sm:h-13" />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <p className="type-meta relative mt-2 text-center text-foreground/60">
        Tầng 4 · 8 · 12 là trùm — tầng ngay trước đó luôn có lửa trại để chuẩn bị.
      </p>
    </div>
  );
}
