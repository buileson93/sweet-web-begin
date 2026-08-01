import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Flame, HelpCircle, Skull, Store, Swords, type LucideIcon } from "lucide-react";

import { bossAt } from "@/lib/tower/bosses";
import { FLOORS, ROOM_META, type Room, type RoomKind } from "@/lib/tower/map";
import { cn } from "@/lib/utils";

/** Toạ độ ngang (%) của các nút theo số phòng của tầng. */
function columnsFor(count: number): number[] {
  if (count <= 1) return [50];
  if (count === 2) return [26, 74];
  return [16, 50, 84];
}

const NODE_ICON: Record<RoomKind, LucideIcon> = {
  combat: Swords,
  elite: Skull,
  event: HelpCircle,
  shop: Store,
  campfire: Flame,
  boss: Crown,
};

const NODE_TONE: Record<RoomKind, { ring: string; glow: string; fill: string }> = {
  combat: { ring: "border-sky-400/70", glow: "shadow-[0_0_22px_-3px_oklch(0.72_0.14_240)]", fill: "bg-sky-500/15" },
  elite: { ring: "border-rose-400/70", glow: "shadow-[0_0_22px_-3px_oklch(0.66_0.18_20)]", fill: "bg-rose-500/15" },
  event: { ring: "border-amber-400/70", glow: "shadow-[0_0_22px_-3px_oklch(0.78_0.15_80)]", fill: "bg-amber-500/15" },
  shop: { ring: "border-emerald-400/70", glow: "shadow-[0_0_22px_-3px_oklch(0.72_0.14_160)]", fill: "bg-emerald-500/15" },
  campfire: { ring: "border-orange-400/70", glow: "shadow-[0_0_22px_-3px_oklch(0.74_0.16_50)]", fill: "bg-orange-500/15" },
  boss: { ring: "border-yellow-300/80", glow: "shadow-[0_0_30px_-3px_oklch(0.85_0.17_92)]", fill: "bg-yellow-400/20" },
};

const LEGEND: RoomKind[] = ["combat", "elite", "event", "shop", "campfire", "boss"];

type Props = {
  map: Room[][];
  /** Tầng đang đứng, đánh số từ 1. */
  floor: number;
  /** Loại phòng đã đi qua ở từng tầng trước đó. */
  path: RoomKind[];
  /** Có đang cho chọn phòng ở tầng hiện tại hay không. */
  canPick: boolean;
  onPick?: (index: number) => void;
  /** Chế độ xem trước trước khi vào tháp: không tô tầng hiện tại. */
  preview?: boolean;
  className?: string;
};

/**
 * Bản đồ leo tháp kiểu roguelike: 12 tầng xếp từ dưới lên, mỗi tầng là các nút
 * phòng nối nhau bằng đường dẫn cong có hiệu ứng chạy. Tầng đã qua mờ đi và
 * ghim đường đã chọn, tầng hiện tại phát sáng và bấm được, tầng phía trên hé lộ dần.
 *
 * Thao tác: chạm/di chuột vào nút để xem mô tả ở khung dưới bản đồ; bàn phím dùng
 * mũi tên Trái/Phải để đổi phòng, Enter hoặc Space để vào phòng.
 *
 * Hiệu năng: dữ liệu tầng được ghi nhớ theo bản đồ, mỗi tầng bật `content-visibility`
 * nên phần ngoài màn hình không tốn thời gian dựng hình khi đổi tầng.
 */
function TowerMapBase({ map, floor, path, canPick, onPick, preview = false, className }: Props) {
  const rows = useMemo(
    () =>
      map.slice(0, FLOORS).map((rooms, fi) => ({
        f: fi + 1,
        rooms,
        cols: columnsFor(rooms.length),
        upperCols: map[fi + 1] ? columnsFor(map[fi + 1]!.length) : [],
      })),
    [map],
  );

  const current = map[floor - 1] ?? [];
  const [cursor, setCursor] = useState(0);
  const [hint, setHint] = useState<{ floor: number; index: number } | null>(null);
  const nodeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    setCursor(0);
    setHint(null);
  }, [floor, canPick]);

  const focusNode = useCallback((i: number) => {
    nodeRefs.current[i]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!canPick || current.length < 1) return;
      const last = current.length - 1;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.min(last, cursor + 1);
        setCursor(next);
        focusNode(next);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const next = Math.max(0, cursor - 1);
        setCursor(next);
        focusNode(next);
      } else if (e.key === "Home") {
        e.preventDefault();
        setCursor(0);
        focusNode(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setCursor(last);
        focusNode(last);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPick?.(cursor);
      }
    },
    [canPick, cursor, current.length, focusNode, onPick],
  );

  const hinted = hint ? map[hint.floor - 1]?.[hint.index] : undefined;
  const hintBoss = hinted?.kind === "boss" && hint ? bossAt(hint.floor) : undefined;

  return (
    <div
      className={cn(
        "tower-map relative overflow-hidden rounded-2xl border border-primary/25 p-3 sm:p-4",
        className,
      )}
    >
      <div aria-hidden className="tower-map__sky pointer-events-none absolute inset-0" />
      <div aria-hidden className="tower-map__stars pointer-events-none absolute inset-0" />

      <ol
        className="relative flex flex-col-reverse gap-0"
        role={canPick ? "listbox" : undefined}
        aria-label={canPick ? `Chọn phòng cho tầng ${floor}` : "Bản đồ tháp"}
        onKeyDown={onKeyDown}
      >
        {rows.map(({ f, rooms, cols, upperCols }) => {
          const state = preview ? "future" : f < floor ? "past" : f === floor ? "current" : "future";
          const takenKind = path[f - 1];

          return (
            <li key={f} className="tower-map__floor relative">
              {/* Đường nối lên tầng trên: đường cong, tầng đã đi thì đậm và nét chạy */}
              {upperCols.length ? (
                <svg
                  aria-hidden
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none h-9 w-full sm:h-11"
                >
                  {cols.map((x, ci) =>
                    upperCols
                      .filter((ux) => Math.abs(ux - x) <= 40)
                      .map((ux) => {
                        const walked = state === "past" && takenKind === rooms[ci]?.kind;
                        return (
                          <path
                            key={`${x}-${ux}`}
                            d={`M ${x} 100 C ${x} 62, ${ux} 38, ${ux} 0`}
                            fill="none"
                            vectorEffect="non-scaling-stroke"
                            strokeLinecap="round"
                            strokeWidth={walked ? 2 : state === "current" ? 1.6 : 1.1}
                            className={cn(
                              walked
                                ? "tower-link stroke-primary"
                                : state === "current"
                                  ? "tower-link stroke-primary/60"
                                  : state === "past"
                                    ? "stroke-primary/20 [stroke-dasharray:3_5]"
                                    : "stroke-foreground/15 [stroke-dasharray:3_5]",
                            )}
                          />
                        );
                      }),
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
                    const skipped = state === "past" && !taken;
                    const active = state === "current" && canPick;
                    const label = boss ? boss.name : meta.label;
                    const Icon = NODE_ICON[room.kind];

                    return (
                      <button
                        key={`${room.kind}-${i}`}
                        ref={(el) => {
                          if (active) nodeRefs.current[i] = el;
                        }}
                        type="button"
                        disabled={!active}
                        tabIndex={active ? (cursor === i ? 0 : -1) : -1}
                        role={active ? "option" : undefined}
                        aria-selected={active ? cursor === i : undefined}
                        onClick={() => onPick?.(i)}
                        onFocus={() => {
                          if (active) setCursor(i);
                          setHint({ floor: f, index: i });
                        }}
                        onPointerEnter={() => setHint({ floor: f, index: i })}
                        onPointerDown={() => setHint({ floor: f, index: i })}
                        title={`Tầng ${f} · ${label} — ${boss ? boss.rule : meta.desc}`}
                        aria-label={`Tầng ${f}, ${label}${taken ? ", đã hoàn thành" : ""}`}
                        style={{ left: `${cols[i]}%` }}
                        className={cn(
                          "group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 touch-manipulation",
                          "grid size-11 place-items-center rounded-full border-2 backdrop-blur-[1px] transition-all duration-300 sm:size-12",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          tone.ring,
                          tone.fill,
                          state === "future" && "opacity-45",
                          taken && cn("opacity-100 ring-2 ring-primary/70", tone.glow),
                          skipped && "opacity-20 grayscale",
                          room.kind === "boss" && state !== "past" && cn(tone.glow, "tower-node__spark"),
                          active && cn("cursor-pointer hover:scale-115 active:scale-95", tone.glow),
                          active && cursor === i && "scale-110 ring-2 ring-primary",
                          !active && "cursor-default",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-5 transition-transform duration-300 group-hover:scale-110 sm:size-6",
                            meta.tone,
                          )}
                        />
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
                  <div className="h-12 sm:h-13" />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Khung mô tả phòng đang chạm/di chuột — thay cho tooltip khó dùng trên điện thoại */}
      <div
        aria-live="polite"
        className="relative mt-2 min-h-14 rounded-xl border border-primary/20 bg-background/70 p-2.5 backdrop-blur-sm"
      >
        {hinted && hint ? (
          <>
            <p className="text-sm font-semibold">
              Tầng {hint.floor} · {hintBoss ? hintBoss.name : ROOM_META[hinted.kind].label}
            </p>
            <p className="type-meta">{hintBoss ? hintBoss.rule : ROOM_META[hinted.kind].desc}</p>
          </>
        ) : (
          <p className="type-meta">
            {canPick
              ? "Chạm vào một nút để xem mô tả, chạm lần nữa để vào phòng. Bàn phím: ← → chọn, Enter để vào."
              : "Chạm vào nút bất kỳ để xem phòng đó làm gì. Nút mờ có dấu ✓ là chặng đã hoàn thành."}
          </p>
        )}
      </div>

      {/* Chú giải icon */}
      <ul className="relative mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
        {LEGEND.map((kind) => {
          const Icon = NODE_ICON[kind];
          return (
            <li key={kind} className="type-meta inline-flex items-center gap-1">
              <Icon className={cn("size-3.5", ROOM_META[kind].tone)} aria-hidden />
              {ROOM_META[kind].label}
            </li>
          );
        })}
      </ul>

      <p className="type-meta relative mt-2 text-center text-foreground/60">
        Tầng 4 · 8 · 12 là trùm — tầng ngay trước đó luôn có lửa trại để chuẩn bị.
      </p>
    </div>
  );
}

export const TowerMap = memo(TowerMapBase);
