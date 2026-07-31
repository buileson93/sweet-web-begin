import { CalendarClock, CircleCheck, CircleSlash, PauseCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { statusLabel, type QuizStatus } from "@/lib/format";

const STYLE: Record<QuizStatus, { cls: string; dot: string; Icon: typeof CircleCheck }> = {
  open: {
    cls: "bg-success/18 text-success ring-success/35 shadow-[0_2px_10px_-4px_color-mix(in_oklab,var(--success)_60%,transparent)]",
    dot: "bg-success",
    Icon: CircleCheck,
  },
  upcoming: {
    cls: "bg-gold/25 text-gold-foreground ring-gold/45 shadow-[0_2px_10px_-4px_color-mix(in_oklab,var(--gold)_60%,transparent)]",
    dot: "bg-gold",
    Icon: CalendarClock,
  },
  paused: {
    cls: "bg-destructive/15 text-destructive ring-destructive/35",
    dot: "bg-destructive",
    Icon: PauseCircle,
  },
  closed: { cls: "bg-muted text-muted-foreground ring-border", dot: "bg-muted-foreground", Icon: CircleSlash },
};

/** Huy hiệu trạng thái cuộc thi: icon + màu để nhận biết nhanh, không chỉ chữ. */
export function QuizStatusBadge({ status, className }: { status: QuizStatus; className?: string }) {
  const { cls, dot, Icon } = STYLE[status] ?? STYLE.closed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.68rem] font-extrabold uppercase leading-none tracking-wide ring-1 ring-inset sm:px-2 sm:text-[0.7rem]",
        cls,
        className,
      )}
    >
      {status === "open" && <span className={cn("size-1.5 animate-pulse rounded-full", dot)} aria-hidden />}
      <Icon className="size-3.5 shrink-0" strokeWidth={2.8} />
      <span className="hidden xs:inline">{statusLabel[status]}</span>
      <span className="sr-only xs:hidden">{statusLabel[status]}</span>
    </span>
  );
}
