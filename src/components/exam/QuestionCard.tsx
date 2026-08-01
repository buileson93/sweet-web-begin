import { ArrowLeft, ArrowRight, Frown, Send, ThumbsUp, Wand2, Zap } from "lucide-react";

import { QuestionInput } from "@/components/exam/QuestionInput";
import { RichText } from "@/components/RichText";
import { Button } from "@/components/ui/button";
import type { ExamQuestion, ExamSettings } from "@/lib/exam.server";
import { KIND_LABEL, type AnswerValue } from "@/lib/questionKinds";
import { questionImageSrc } from "@/lib/questionImage";
import { cn } from "@/lib/utils";

/** Thẻ câu hỏi: đề bài, ảnh minh hoạ, phương án, trợ giúp và điều hướng desktop. */
export function QuestionCard({
  question,
  settings,
  current,
  total,
  value,
  removed,
  disabled,
  feedback,
  feedbackInfo,
  instant,
  fiftyBusy,
  fiftyLeft,
  fiftyUsed,
  x2Left,
  x2Busy,
  x2Active,
  onX2,
  onFifty,
  onAnswer,
  onConfirm,
  onPrev,
  onNext,
  onSubmit,
}: {
  question: ExamQuestion;
  settings: ExamSettings;
  current: number;
  total: number;
  value: AnswerValue | undefined;
  removed: number[];
  disabled: boolean;
  feedback: "correct" | "wrong" | null;
  /** Đáp án đúng + giải thích do máy chủ trả về (chế độ chấm ngay). */
  feedbackInfo?: { correctText: string; explanation: string } | null;
  instant: boolean;
  fiftyBusy: boolean;
  fiftyLeft: number;
  fiftyUsed: boolean;
  /** Số lượt X2 còn lại trong lượt thi. */
  x2Left: number;
  x2Busy: boolean;
  /** Câu đang xem có đang được nhân đôi điểm không. */
  x2Active: boolean;
  onX2: () => void;
  onFifty: () => void;
  onAnswer: (value: AnswerValue) => void;
  /** Chốt đáp án cho câu cần nhiều thao tác (chế độ chấm ngay). */
  onConfirm?: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const last = current === total - 1;

  return (
    <section
      className="card-elevated animate-rise rounded-2xl p-4 sm:p-6"
      key={current}
      data-tour="exam-question"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="type-eyebrow text-accent">
          Câu {current + 1} / {total}
        </p>
        <span className="type-meta rounded-full bg-secondary px-2 py-0.5 font-semibold">
          {KIND_LABEL[question.kind]}
        </span>
        <span className="type-meta rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent">
          {question.points} điểm
        </span>
      </div>
      <h1 className="mt-2 text-lg font-bold leading-snug sm:text-xl">
        <RichText>{question.question}</RichText>
      </h1>

      {questionImageSrc(question.imageUrl) ? (
        <img
          src={questionImageSrc(question.imageUrl)!}
          alt={question.imageAlt || `Hình minh hoạ câu ${current + 1}`}
          loading="lazy"
          className="mt-4 max-h-56 w-full rounded-xl border border-border object-contain sm:max-h-72"
        />
      ) : null}

      <div key={current} data-tour="exam-options">
        <QuestionInput
          kind={question.kind}
          options={question.options}
          optionImages={question.optionImages}
          matchLeft={question.matchLeft}
          value={value}
          removed={removed}
          disabled={disabled}
          feedback={feedback}
          onChange={onAnswer}
        />
      </div>

      {instant && feedback ? (
        <div
          className={cn(
            "animate-rise mt-4 space-y-1.5 rounded-xl px-3 py-2.5 text-sm",
            feedback === "correct"
              ? "bg-success/12 text-success"
              : "bg-destructive/12 text-destructive",
          )}
        >
          <p className="flex items-center gap-1.5 font-semibold">
            {feedback === "correct" ? (
              <>
                <ThumbsUp className="size-4" /> Chính xác!
              </>
            ) : (
              <>
                <Frown className="size-4" /> Chưa đúng.
              </>
            )}
          </p>
          {feedback === "wrong" && feedbackInfo?.correctText ? (
            <p className="rounded-lg bg-success/12 px-2.5 py-1.5 text-success">
              <span className="font-semibold">Đáp án đúng: </span>
              <RichText inline>{feedbackInfo.correctText}</RichText>
            </p>
          ) : null}
          {feedbackInfo?.explanation ? (
            <p className="rounded-lg bg-secondary/70 px-2.5 py-1.5 text-muted-foreground">
              <span className="font-semibold text-foreground">Giải thích: </span>
              <RichText inline>{feedbackInfo.explanation}</RichText>
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Câu nhiều đáp án/điền/nối/sắp xếp: chấm khi thí sinh tự chốt */}
      {instant && !feedback && question.kind !== "single" && question.kind !== "true_false" ? (
        <Button className="mt-4 rounded-full" disabled={value === undefined} onClick={onConfirm}>
          <Send className="size-4" />
          Chốt đáp án
        </Button>
      ) : null}




      {/* Vật phẩm trợ giúp */}
      <div className="mt-4 flex flex-wrap gap-2">
          <Button
            variant={x2Active ? "default" : "outline"}
            size="sm"
            className={cn("rounded-full", x2Active && "shadow-[var(--shadow-gold)]")}
            disabled={x2Busy || disabled || (x2Left <= 0 && !x2Active)}
            onClick={onX2}
            title="Nhân đôi điểm câu này, cộng dồn với điểm thưởng combo"
          >
            <Zap className="size-4" />
            {x2Active ? "Đang X2 câu này" : `X2 điểm (${x2Left})`}
          </Button>
        </div>
      {settings.allowFiftyFifty || settings.allowSkip ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {settings.allowFiftyFifty ? (
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              disabled={
                fiftyBusy ||
                fiftyUsed ||
                fiftyLeft <= 0 ||
                (question.kind !== "single" && question.kind !== "true_false")
              }
              onClick={onFifty}
            >
              <Wand2 className="size-4" />
              50:50 ({fiftyLeft})
            </Button>
          ) : null}
          {settings.allowSkip ? (
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              disabled={last}
              onClick={onNext}
            >
              Bỏ qua câu này
              <ArrowRight className="size-4" />
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Điều hướng cho desktop — mobile dùng thanh cố định dưới màn hình */}
      <div className="mt-6 hidden items-center justify-between gap-3 lg:flex">
        <Button variant="outline" disabled={current === 0} onClick={onPrev}>
          <ArrowLeft className="size-4" />
          Câu trước
        </Button>
        {last ? (
          <Button onClick={onSubmit}>
            <Send className="size-4" />
            Nộp bài
          </Button>
        ) : (
          <Button onClick={onNext}>
            Câu tiếp
            <ArrowRight className="size-4" />
          </Button>
        )}
      </div>
    </section>
  );
}
