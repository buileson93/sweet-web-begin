import { Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ExamQuestion } from "@/lib/exam.server";
import { isAnswered, type AnswerValue } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

/** Lưới câu hỏi: cột phải trên desktop, bảng bật/tắt trên mobile. */
export function QuestionMap({
  questions,
  answers,
  feedback,
  current,
  open,
  onSelect,
  onSubmit,
}: {
  questions: ExamQuestion[];
  answers: Record<string, AnswerValue>;
  feedback: Record<string, "correct" | "wrong">;
  current: number;
  open: boolean;
  onSelect: (index: number) => void;
  onSubmit: () => void;
}) {
  return (
    <aside
      className={cn(
        "card-elevated h-fit rounded-2xl p-3 lg:sticky lg:top-20 lg:block",
        open ? "block" : "hidden",
      )}
      data-tour="exam-nav"
    >
      <p className="type-meta mb-2 font-semibold text-foreground">Danh sách câu hỏi</p>
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10 lg:grid-cols-5">
        {questions.map((item, i) => {
          const done = isAnswered(item.kind, answers[String(i)]);
          const fb = feedback[String(i)];

          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              className={cn(
                "aspect-square rounded-lg border text-xs font-semibold transition-all hover:scale-105",
                i === current
                  ? "border-accent bg-accent text-accent-foreground"
                  : fb === "correct"
                    ? "border-success/40 bg-success/20 text-success"
                    : fb === "wrong"
                      ? "border-destructive/40 bg-destructive/15 text-destructive"
                      : done
                        ? "border-success/40 bg-success/15 text-success"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary",
              )}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      <Button className="mt-3 hidden w-full lg:flex" variant="secondary" onClick={onSubmit}>
        <Send className="size-4" />
        Nộp bài
      </Button>
    </aside>
  );
}
