import { Crown, Medal, Sparkles, Trophy } from "lucide-react";

import { formatDurationOf } from "@/lib/format";
import { cn } from "@/lib/utils";

export type PodiumRow = {
  id: string;
  candidate_name: string;
  unit?: string | null;
  score: number;
  total: number;
  time_seconds: number;
  time_ms?: number | null;
};

function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.slice(-2).join(" ");
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const last = parts.at(-1) ?? "";
  const first = parts.at(0) ?? "";
  return (first.charAt(0) + last.charAt(0)).toUpperCase();
}

/** Bục vinh danh 3 hạng đầu — tông pastel tươi sáng, có hiệu ứng hover tôn vinh quán quân. */
export function Podium({ rows, className }: { rows: PodiumRow[]; className?: string }) {
  if (rows.length === 0) {
    return (
      <p className={cn("type-muted rounded-2xl bg-secondary/60 px-4 py-6 text-center", className)}>
        Chưa có kết quả nào được ghi nhận.
      </p>
    );
  }

  // Thứ tự hiển thị: hạng 2 – hạng 1 – hạng 3
  const order = [rows[1], rows[0], rows[2]];
  const tone = [
    {
      step: "h-20 bg-[oklch(0.94_0.035_250)] border-[oklch(0.86_0.06_250)]",
      avatar: "bg-[oklch(0.9_0.05_250)] text-[oklch(0.35_0.09_250)]",
      value: "text-[oklch(0.42_0.1_250)]",
    },
    {
      step: "h-32 bg-[oklch(0.95_0.09_92)] border-gold",
      avatar: "surface-gold champion-halo",
      value: "text-[oklch(0.48_0.12_80)]",
    },
    {
      step: "h-16 bg-[oklch(0.94_0.04_160)] border-[oklch(0.85_0.07_160)]",
      avatar: "bg-[oklch(0.9_0.06_160)] text-[oklch(0.36_0.08_160)]",
      value: "text-[oklch(0.4_0.09_160)]",
    },
  ];

  return (
    <div className={cn("flex items-end justify-center gap-2 pt-16", className)}>
      {order.map((row, i) => {
        if (!row) return <span key={i} className="w-full" aria-hidden />;
        const rank = i === 1 ? 1 : i === 0 ? 2 : 3;
        return (
          <div
            key={row.id}
            className={cn(
              "podium-step group relative flex w-full min-w-0 flex-col items-center gap-2",
              rank === 1 && "champion-zone z-30",
            )}
          >
            <div className="relative">
              {rank === 1 ? (
                <>
                  {/* Nhà vô địch nâng cúp khi rê chuột */}
                  <span className="trophy-raise pointer-events-none absolute -top-14 left-1/2 -translate-x-1/2">
                    <Trophy className="size-8 text-gold drop-shadow-md" aria-hidden />
                  </span>
                  {[0, 1, 2].map((k) => (
                    <Sparkles
                      key={k}
                      aria-hidden
                      className="spark pointer-events-none absolute size-3 text-gold"
                      style={{
                        left: `${18 + k * 26}%`,
                        top: "10%",
                        animationDelay: `${k * 0.22}s`,
                      }}
                    />
                  ))}
                </>
              ) : null}
              {rank === 1 ? (
                <Crown
                  className="animate-bob absolute -top-6 left-1/2 size-5 -translate-x-1/2 text-gold drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-125"
                  aria-hidden
                />
              ) : (
                <Medal
                  className="absolute -top-4 left-1/2 size-4 -translate-x-1/2 text-muted-foreground/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  "font-heading grid place-items-center rounded-full font-extrabold transition-transform duration-300 group-hover:scale-110",
                  rank === 1 ? "size-14 text-lg" : "size-11 text-sm",
                  tone[i].avatar,
                )}
              >
                {initials(row.candidate_name)}
              </span>
            </div>
            <div
              className={cn(
                "animate-bar relative flex w-full flex-col items-center justify-center gap-0.5 rounded-t-2xl border-t-4 px-1",
                tone[i].step,
                rank === 1 && "overflow-visible",
              )}
              style={{ animationDelay: `${i * 0.12}s` }}
            >
              {rank === 1 ? (
                <span className="pointer-events-none absolute inset-x-0 -top-6 bottom-0" aria-hidden>
                  {/* Pháo hoa nổ trên cột quán quân */}
                  {[
                    { x: "-2.2rem", y: "-2.4rem", c: "var(--color-gold)", d: "0s" },
                    { x: "2.4rem", y: "-2rem", c: "var(--color-primary)", d: "0.25s" },
                    { x: "0rem", y: "-3.2rem", c: "var(--color-accent)", d: "0.5s" },
                    { x: "-1.4rem", y: "-3rem", c: "var(--color-primary)", d: "0.8s" },
                    { x: "1.6rem", y: "-3.4rem", c: "var(--color-gold)", d: "1.05s" },
                  ].map((p, k) => (
                    <span
                      key={k}
                      className="firework-dot left-1/2 top-2"
                      style={
                        {
                          "--fx": p.x,
                          "--fy": p.y,
                          background: p.c,
                          animationDelay: p.d,
                        } as React.CSSProperties
                      }
                    />
                  ))}
                  {/* Bọt champagne sủi lên */}
                  {[0, 1, 2, 3, 4].map((k) => (
                    <span
                      key={`b${k}`}
                      className="champagne-bubble"
                      style={{
                        left: `${14 + k * 18}%`,
                        bottom: "18%",
                        width: `${3 + (k % 3)}px`,
                        height: `${3 + (k % 3)}px`,
                        animationDelay: `${k * 0.35}s`,
                      }}
                    />
                  ))}
                  {/* Nút chai bật ra */}
                  <span className="cork-pop absolute left-[12%] top-3 text-sm">🍾</span>
                </span>
              ) : null}
              <span className={cn("font-heading text-xl font-extrabold tabular-nums", tone[i].value)}>{row.score}</span>
              <span className="font-mono text-[10px] text-muted-foreground">{formatDurationOf(row)}</span>
            </div>
            <span className="w-full truncate text-center text-[11px] font-bold text-foreground">
              {row.candidate_name}
            </span>
            {rank === 1 ? (
              <span className="champion-banner champion-glow relative z-30 inline-flex w-max max-w-[min(14rem,90vw)] items-center gap-1 whitespace-nowrap rounded-2xl bg-gold px-2.5 py-1 text-center text-[9px] leading-tight font-extrabold uppercase tracking-wide text-gold-foreground shadow-lg ring-2 ring-background">
                <Trophy className="size-3 shrink-0" aria-hidden />
                <span className="truncate">{shortName(row.candidate_name)} là nhà vô địch</span>
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
