import { AlertTriangle, CheckCircle2, Loader2, LogOut, Timer } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatSeconds } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Thanh trạng thái gọn: tên cuộc thi, tiến độ, đồng hồ, trạng thái lưu bài. */
export function ExamHeader({
  quizTitle,
  answeredCount,
  total,
  combo,
  showCombo,
  remaining,
  progress,
  saveStatus,
  lastSavedAt,
  onExit,
}: {
  quizTitle: string;
  answeredCount: number;
  total: number;
  combo: number;
  showCombo: boolean;
  remaining: number;
  progress: number;
  saveStatus: "idle" | "saving" | "saved" | "offline";
  lastSavedAt: Date | null;
  onExit: () => void;
}) {
  const lowTime = remaining <= 60;

  return (
    <header className="surface-hero sticky top-0 z-30 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Thoát bài thi"
          className="size-9 shrink-0 rounded-xl text-primary-foreground hover:bg-primary-foreground/15 hover:text-primary-foreground"
          onClick={onExit}
        >
          <LogOut className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-sm font-bold">{quizTitle}</p>
          <p className="text-[11px] text-primary-foreground/70">
            {answeredCount}/{total} câu
          </p>
        </div>
        {showCombo ? (
          <span className="shrink-0 rounded-full bg-accent px-2.5 py-1 font-heading text-xs font-extrabold text-accent-foreground">
            Combo x{combo}
          </span>
        ) : null}
        <div
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-base font-bold tabular-nums",
            lowTime
              ? "animate-pulse-ring bg-destructive text-destructive-foreground"
              : "bg-primary-foreground/10 text-primary-foreground",
          )}
        >
          <Timer className="size-4" />
          {formatSeconds(remaining)}
        </div>
      </div>
      <div className="mx-auto flex max-w-5xl items-center px-3 pb-1.5 sm:px-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            saveStatus === "offline"
              ? "bg-destructive/20 text-destructive-foreground"
              : "bg-primary-foreground/10 text-primary-foreground/80",
          )}
        >
          {saveStatus === "saving" ? (
            <Loader2 className="size-3 animate-spin" />
          ) : saveStatus === "offline" ? (
            <AlertTriangle className="size-3" />
          ) : (
            <CheckCircle2 className="size-3" />
          )}
          {saveStatus === "saving"
            ? "Đang lưu..."
            : saveStatus === "offline"
              ? "Mất kết nối — bài vẫn được giữ trên máy"
              : lastSavedAt
                ? "Đã lưu lúc " +
                  lastSavedAt.toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Bài làm được lưu tự động"}
        </span>
      </div>
      <Progress value={progress} className="h-1 rounded-none bg-primary-foreground/15" />
    </header>
  );
}
