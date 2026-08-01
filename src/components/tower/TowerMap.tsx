import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crown, Flame, HelpCircle, Skull, Store, Swords, type LucideIcon } from "lucide-react";

import { bossAt } from "@/lib/tower/bosses";
import { COLS, FLOORS, type MapNode, reachableAt, ROOM_META, type RoomKind } from "@/lib/tower/map";
import { ROOM_RULES } from "@/lib/tower/rooms";
import { cn } from "@/lib/utils";

/** Toạ độ ngang (%) của một cột trên lưới. */
const xOf = (col: number) => 10 + (col * 80) / (COLS - 1);

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
  map: MapNode[][];
  /** Tầng đang đứng, đánh số từ 1. */
  floor: number;
  /** Chỉ số nút đã chọn ở từng tầng đã đi qua. */
  trail: number[];
  /** Có đang cho chọn phòng ở tầng hiện tại hay không. */
  canPick: boolean;
  /** Nhận chỉ số nút (theo mảng của tầng), không phải thứ tự trong danh sách chọn. */
  onPick?: (nodeIndex: number) => void;
  /** Chế độ xem trước trước khi vào tháp: không tô tầng hiện tại. */
  preview?: boolean;
  className?: string;
};

/**
 * Bản đồ roguelike phân nhánh: 12 tầng xếp từ dưới lên trên một lưới cột cố định,
 * các nút nối nhau bằng đường cong sinh từ chính đồ thị (không có đường "trang trí").
 *
 * Chỉ những nút nối tới từ nút đang đứng mới bấm được — đúng luật lối đi của
 * Slay the Spire. Nút đã đi qua sáng và có dấu ✓, nút bỏ lỡ mờ xám.
 *
 * Thao tác: chạm/di chuột để xem mô tả ở khung dưới; bàn phím ← → chọn, Enter để vào.
 */
function TowerMapBase({ map, floor, trail, canPick, onPick, preview = false, className }: Props) {
  const rows = useMemo(() => map.slice(0, FLOORS).map((nodes, fi) => ({ f: fi + 1, nodes })), [map]);
  const from = floor <= 1 ? null : (trail[floor - 2] ?? null);
  const reachable = useMemo(
    () => (canPick ? reachableAt(map, floor, from) : []),
    [canPick, map, floor, from],
  );

  const [cursor, setCursor] = useState(0);
  const [hint, setHint] = useState<{ floor: number; index: number } | null>(null);
  const nodeRefs = useRef<Record<number, HTMLButtonElement | null>>({});

  useEffect(() => {
    setCursor(0);
    setHint(null);
  }, [floor, canPick]);

  const focusNode = useCallback((nodeIndex: number | undefined) => {
    if (nodeIndex === undefined) return;
    nodeRefs.current[nodeIndex]?.focus();
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!canPick || !reachable.length) return;
      const last = reachable.length - 1;
      const move = (to: number) => {
        e.preventDefault();
        setCursor(to);
        focusNode(reachable[to]);
      };
      if (e.key === "ArrowRight" || e.key === "ArrowDown") move(Math.min(last, cursor + 1));
      else if (e.key === "ArrowLeft" || e.key === "ArrowUp") move(Math.max(0, cursor - 1));
      else if (e.key === "Home") move(0);
      else if (e.key === "End") move(last);
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const target = reachable[cursor];
        if (target !== undefined) onPick?.(target);
      }
    },
    [canPick, cursor, focusNode, onPick, reachable],
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
        {rows.map(({ f, nodes }) => {
          const state = preview ? "future" : f < floor ? "past" : f === floor ? "current" : "future";
          const takenIndex = trail[f - 1];
          const upper = map[f] ?? [];

          return (
            <li key={f} className="tower-map__floor relative">
              {/* Đường nối lên tầng trên — vẽ đúng theo cạnh của đồ thị, không thêm đường ảo. */}
              {upper.length ? (
                <svg
                  aria-hidden
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                  className="pointer-events-none h-9 w-full sm:h-11"
                >
                  {nodes.flatMap((node, ni) =>
                    node.next.map((ui) => {
                      const x = xOf(node.col);
                      const ux = xOf(upper[ui]!.col);
                      const walked = takenIndex === ni && trail[f] === ui;
                      const onTrail = takenIndex === ni;
                      return (
                        <path
                          key={`${ni}-${ui}`}
                          d={`M ${x} 100 C ${x} 62, ${ux} 38, ${ux} 0`}
                          fill="none"
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                          strokeWidth={walked ? 2.2 : onTrail || state === "current" ? 1.6 : 1.1}
                          className={cn(
                            walked
                              ? "tower-link stroke-primary"
                              : state === "current" && onTrail
                                ? "tower-link stroke-primary/70"
                                : state === "past"
                                  ? "stroke-primary/15 [stroke-dasharray:3_5]"
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
                  {nodes.map((node, i) => {
                    const meta = ROOM_META[node.kind];
                    const tone = NODE_TONE[node.kind];
                    const boss = node.kind === "boss" ? bossAt(f) : undefined;
                    const taken = state === "past" && takenIndex === i;
                    const skipped = state === "past" && !taken;
                    const active = state === "current" && canPick && reachable.includes(i);
                    const blocked = state === "current" && canPick && !active;
                    const label = boss ? boss.name : meta.label;
                    const Icon = NODE_ICON[node.kind];
                    const order = reachable.indexOf(i);

                    return (
                      <button
                        key={`${node.kind}-${node.col}-${i}`}
                        ref={(el) => {
                          nodeRefs.current[i] = el;
                        }}
                        type="button"
                        disabled={!active}
                        tabIndex={active ? (order === cursor ? 0 : -1) : -1}
                        role={active ? "option" : undefined}
                        aria-selected={active ? order === cursor : undefined}
                        onClick={() => onPick?.(i)}
                        onFocus={() => {
                          if (active) setCursor(Math.max(0, order));
                          setHint({ floor: f, index: i });
                        }}
                        onPointerEnter={() => setHint({ floor: f, index: i })}
                        onPointerDown={() => setHint({ floor: f, index: i })}
                        title={`Tầng ${f} · ${label} — ${boss ? boss.rule : ROOM_RULES[node.kind].rule}`}
                        aria-label={`Tầng ${f}, ${label}${taken ? ", đã hoàn thành" : ""}${blocked ? ", không nối tới lối đi hiện tại" : ""}`}
                        style={{ left: `${xOf(node.col)}%` }}
                        className={cn(
                          "group absolute top-1/2 -translate-x-1/2 -translate-y-1/2 touch-manipulation",
                          "grid size-10 place-items-center rounded-full border-2 backdrop-blur-[1px] transition-all duration-300 sm:size-12",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                          tone.ring,
                          tone.fill,
                          state === "future" && "opacity-45",
                          blocked && "opacity-25 grayscale",
                          taken && cn("opacity-100 ring-2 ring-primary/70", tone.glow),
                          skipped && "opacity-20 grayscale",
                          node.kind === "boss" && state !== "past" && cn(tone.glow, "tower-node__spark"),
                          active && cn("cursor-pointer hover:scale-115 active:scale-95", tone.glow),
                          active && order === cursor && "scale-110 ring-2 ring-primary",
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
                  <div className="h-11 sm:h-13" />
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
            <p className="type-meta">{hintBoss ? hintBoss.rule : ROOM_RULES[hinted.kind].rule}</p>
          </>
        ) : (
          <p className="type-meta">
            {canPick
              ? "Chỉ vào được phòng nối với nút bạn đang đứng. Chạm để xem luật phòng, chạm lần nữa để vào. Bàn phím: ← → chọn, Enter để vào."
              : "Chạm vào nút bất kỳ để xem luật của phòng đó. Nút mờ có dấu ✓ là chặng đã hoàn thành."}
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
        Tầng 4 · 8 · 12 là trùm, mọi lối đi đều hội tụ; tầng ngay trước đó luôn là lửa trại để chuẩn bị.
      </p>
    </div>
  );
}

export const TowerMap = memo(TowerMapBase);
