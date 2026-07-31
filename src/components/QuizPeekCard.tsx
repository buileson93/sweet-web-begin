import { useEffect, useRef, useState } from "react";
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
  /** Quyền lợi do quản trị viên cấu hình; rỗng thì dùng danh sách mặc định. */
  rewards?: string[] | null;
  x: number;
  y: number;
};

const DEFAULT_REWARDS = [
  "Chấm điểm ngay sau mỗi câu",
  "Thưởng chuỗi combo, nhân đôi điểm",
  "Ghi danh bảng xếp hạng khi đạt",
  "Săn danh hiệu combo & chuyên cần",
];

const REWARD_ICONS = [Zap, Flame, Trophy, Award, Target, ListChecks];

/** Thẻ giới thiệu nhanh cuộc thi, hiện khi rê chuột giữ lâu — giống màn chọn nhân vật. */
export function QuizPeekCard({ peek }: { peek: QuizPeek | null }) {
  // Giữ lại nội dung cũ trong lúc chạy hiệu ứng ẩn để thẻ mờ dần thay vì biến mất đột ngột.
  const [shown, setShown] = useState<QuizPeek | null>(peek);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (peek) {
      setShown(peek);
      return;
    }
    timer.current = setTimeout(() => setShown(null), 200);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [peek]);

  if (!shown || typeof document === "undefined") return null;
  const theme = quizTheme(shown.title);
  const width = 288;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const left = Math.min(Math.max(12, shown.x), Math.max(12, vw - width - 12));
  const top = Math.min(Math.max(12, shown.y), Math.max(12, vh - 340));

  const stats = [
    { Icon: ListChecks, label: "Số câu", value: `${shown.question_count}` },
    { Icon: Timer, label: "Thời lượng", value: `${shown.duration_minutes} phút` },
    { Icon: Target, label: "Ngưỡng đạt", value: `${shown.pass_percent ?? 50}%` },
    { Icon: Repeat, label: "Lượt thi", value: "Không giới hạn" },
  ];

  const rewardLines = (shown.rewards ?? []).filter(Boolean);
  const rewards = (rewardLines.length ? rewardLines : DEFAULT_REWARDS)
    .slice(0, 6)
    .map((text, i) => ({ text, Icon: REWARD_ICONS[i % REWARD_ICONS.length] }));

  return createPortal(
    <div
      className="peek-card pointer-events-none fixed z-[95] w-72 overflow-hidden rounded-2xl border border-border bg-card/97 shadow-2xl backdrop-blur"
      data-open={peek ? "1" : "0"}
      style={{ left, top }}
      role="tooltip"
    >
      <div className={cn("h-1 w-full", theme.bar)} />
      <div className="flex items-start gap-2.5 p-3">
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", theme.chip)}>
          <theme.Icon className="size-5" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <p className="line-clamp-2 font-heading text-sm font-extrabold leading-tight">{shown.title}</p>
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
        <QuizStatusBadge status={shown.status} />
      </div>
    </div>,
    document.body,
  );
}
