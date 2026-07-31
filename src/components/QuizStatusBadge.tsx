import { CalendarClock, CircleCheck, CircleSlash, PauseCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { statusLabel, type QuizStatus } from "@/lib/format";

const STYLE: Record<QuizStatus, { cls: string; Icon: typeof CircleCheck }> = {
  open: { cls: "bg-success/15 text-success ring-success/25", Icon: CircleCheck },
  upcoming: { cls: "bg-gold/20 text-gold-foreground ring-gold/35", Icon: CalendarClock },
  paused: { cls: "bg-destructive/12 text-destructive ring-destructive/25", Icon: PauseCircle },
  closed: { cls: "bg-muted text-muted-foreground ring-border", Icon: CircleSlash },
};

/** Huy hiệu trạng thái cuộc thi: icon + màu để nhận biết nhanh, không chỉ chữ. */
export function QuizStatusBadge({ status, className }: { status: QuizStatus; className?: string }) {
  const { cls, Icon } = STYLE[status] ?? STYLE.closed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[0.7rem] font-bold uppercase tracking-wide ring-1 ring-inset",
        cls,
        className,
      )}
    >
      <Icon className="size-3.5" strokeWidth={2.6} />
      {statusLabel[status]}
    </span>
  );
}
