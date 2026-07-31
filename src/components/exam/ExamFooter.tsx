import { ArrowLeft, ArrowRight, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Thanh hành động cố định trên mobile: ưu tiên "Câu tiếp"/"Nộp bài". */
export function ExamFooter({
  current,
  total,
  onPrev,
  onNext,
  onSubmit,
  onToggleMap,
}: {
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onToggleMap: () => void;
}) {
  const last = current === total - 1;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-[calc(0.75rem+env(safe-area-inset-left))] pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-5xl items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-11 shrink-0 rounded-xl"
          aria-label="Câu trước"
          disabled={current === 0}
          onClick={onPrev}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          className="h-11 shrink-0 rounded-xl px-3 font-mono text-xs"
          onClick={onToggleMap}
          aria-label="Danh sách câu hỏi"
        >
          {current + 1}/{total}
        </Button>
        {last ? (
          <Button className="h-11 flex-1 rounded-xl" onClick={onSubmit}>
            <Send className="size-4" />
            Nộp bài
          </Button>
        ) : (
          <Button className="h-11 flex-1 rounded-xl" onClick={onNext}>
            Câu tiếp
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
