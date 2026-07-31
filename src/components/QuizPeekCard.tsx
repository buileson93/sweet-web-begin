import { createPortal } from "react-dom";
import { Award, Flame, ListChecks, Repeat, Target, Timer, Trophy, Zap } from "lucide-react";

import { QuizStatusBadge } from "@/components/QuizStatusBadge";
import { quizTheme } from "@/lib/quizTheme";
import type { QuizStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export type QuizPeek = {
  id: string;
  title: string;
  status: QuizStatus;
  question_count: number;
  duration_minutes: number;
  pass_percent?: number | null;
  x: number;
  y: number;
};

/** Thẻ giới thiệu nhanh cuộc thi, hiện khi rê chuột giữ lâu — giống màn chọn nhân vật. */
export function QuizPeekCard({ peek }: { peek: QuizPeek | null }) {
  if (!peek || typeof document === "undefined") return null;
  const theme = quizTheme(peek.title);
  const width = 288;
  const left = Math.min(Math.max(12, peek.x), (typeof window !== "undefined" ? window.innerWidth : 1024) - width - 12);
  const top = Math.max(12, peek.y);

  const stats = [
    { Icon: ListChecks, label: "Số câu", value: `${peek.question_count}` },
    { Icon: Timer, label: "Thời lượng", value: `${peek.duration_minutes} phút` },
    { Icon: Target, label: "Ngưỡng đạt", value: `${peek.pass_percent ?? 50}%` },
    { Icon: Repeat, label: "Lượt thi", value: "Không giới hạn" },
  ];

  const rewards = [
    { Icon: Zap, text: "Chấm điểm ngay sau mỗi câu" },
    { Icon: Flame, text: "Thưởng chuỗi combo, nhân đôi điểm" },
    { Icon: Trophy, text: "Ghi danh bảng xếp hạng khi đạt" },
    { Icon: Award, text: "Săn danh hiệu combo & chuyên cần" },
  ];

  return createPortal(
    <div
      className="animate-pop pointer-events-none fixed z-[95] w-72 overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl backdrop-blur"
      style={{ left, top }}
      role="tooltip"
    >
      <div className={cn("h-1 w-full", theme.bar)} />
      <div className="flex items-start gap-2.5 p-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", theme.chip)}>
          <theme.Icon className="size-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 font-heading text-sm font-extrabold leading-tight">{peek.title}</p>
          <p className={cn("type-meta mt-0.5 font-semibold", theme.text)}>{theme.label}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px bg-border">
        {stats.map((s) => (
          <span key={s.label} className="flex items-center gap-2 bg-card px-3 py-2">
            <s.Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={2.4} />
            <span className="min-w-0">
              <span className="type-meta block text-muted-foreground">{s.label}</span>
              <span className="block truncate text-xs font-bold">{s.value}</span>
            </span>
          </span>
        ))}
      </div>

      <div className="space-y-1.5 p-3">
        <p className="type-meta font-bold uppercase tracking-wide text-muted-foreground">Tham gia được gì</p>
        {rewards.map((r) => (
          <span key={r.text} className="flex items-center gap-2 text-xs font-medium">
            <r.Icon className={cn("size-3.5 shrink-0", theme.text)} strokeWidth={2.6} />
            {r.text}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border px-3 py-2">
        <span className="type-meta font-semibold text-muted-foreground">Trạng thái</span>
        <QuizStatusBadge status={peek.status} />
      </div>
    </div>,
    document.body,
  );
}
