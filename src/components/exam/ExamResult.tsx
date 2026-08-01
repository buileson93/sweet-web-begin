import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Flame,
  Loader2,
  Radio,
  RefreshCw,
  Sparkles,
  TrendingUp,
  XCircle,
} from "lucide-react";

import { Celebration } from "@/components/Celebration";
import { LevelBar } from "@/components/player/LevelBar";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeResults } from "@/hooks/useRealtimeResults";
import type { SubmitExamResult } from "@/lib/exam.server";
import { formatSeconds } from "@/lib/format";
import { questionImageSrc } from "@/lib/questionImage";
import { KIND_LABEL } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";
import { RichText } from "@/components/RichText";

/** Thứ hạng cập nhật trực tiếp khi có thí sinh khác nộp bài. */
function LiveRank({ result }: { result: SubmitExamResult }) {
  const queryKey = ["live-rank", result.quizId, result.score, result.timeSeconds];
  const { live } = useRealtimeResults({ queryKey, quizId: result.quizId });

  const rankQuery = useQuery({
    queryKey,
    staleTime: 10_000,
    queryFn: async () => {
      const base = supabase
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("disqualified", false);
      const [total, better] = await Promise.all([
        base.eq("quiz_id", result.quizId),
        supabase
          .from("results")
          .select("id", { count: "exact", head: true })
          .eq("disqualified", false)
          .eq("quiz_id", result.quizId)
          .or(
            `score.gt.${result.score},and(score.eq.${result.score},time_seconds.lt.${result.timeSeconds})`,
          ),
      ]);
      return { total: total.count ?? 0, rank: (better.count ?? 0) + 1 };
    },
  });

  return (
    <p
      className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground/85"
      aria-live="polite"
    >
      {live ? <Radio className="size-3.5 text-success" /> : null}
      {rankQuery.data
        ? `Hạng ${rankQuery.data.rank}/${rankQuery.data.total}`
        : "Đang tính thứ hạng..."}
    </p>
  );
}

export function ExamResult({
  result,
  onRetake,
  retaking,
}: {
  result: SubmitExamResult;
  onRetake: () => void;
  retaking?: boolean;
}) {
  const percent = Math.round((result.score / Math.max(1, result.total)) * 100);
  const wrong = result.review.filter((r) => !r.correct);
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? result.review : wrong;

  const celebrate = !result.disqualified && result.passed;

  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(2.5rem+env(safe-area-inset-bottom))]">
      {celebrate ? <Celebration /> : null}
      {/* Tóm tắt kết quả gọn trong một màn hình */}
      <div className={cn("surface-hero grid-pattern", celebrate && "animate-result-glow")}>
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
          <p className="type-meta text-primary-foreground/70">{result.quizTitle}</p>
          <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
            <div className="min-w-0">
              <h1 className="type-h2 text-primary-foreground">
                {result.disqualified
                  ? "Bài thi bị huỷ"
                  : result.passed
                    ? "Chúc mừng, bạn đã ĐẠT!"
                    : "Chưa đạt yêu cầu"}
              </h1>
              <p
                className={cn(
                  "mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
                  result.disqualified
                    ? "bg-destructive/25 text-destructive-foreground"
                    : result.passed
                      ? "bg-success/25 text-primary-foreground"
                      : "bg-warning/25 text-primary-foreground",
                )}
              >
                {result.disqualified || !result.passed ? (
                  <XCircle className="size-3.5" />
                ) : (
                  <CheckCircle2 className="size-3.5" />
                )}
                {result.disqualified
                  ? "Không tính vào bảng xếp hạng"
                  : `Đạt khi ≥ ${result.passPercent}% · thời gian ${formatSeconds(result.timeSeconds)}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground/85">
                  <Sparkles className="size-3.5 text-gold" />
                  {result.points} điểm thưởng / {result.maxPoints}
                </span>
                <span className="type-meta inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 py-1 text-primary-foreground/85">
                  <Flame className="size-3.5 text-warning" />
                  Chuỗi đúng dài nhất: {result.bestStreak}
                </span>
              </div>
              {result.improved ? (
                <p className="type-meta mt-2 inline-flex items-center gap-1.5 text-primary-foreground/85">
                  <TrendingUp className="size-3.5 text-success" />
                  Vượt kỷ lục cũ ({result.previousBestPercent}%) — tiếp tục phát huy!
                </p>
              ) : null}
            </div>
            <div className="shrink-0 rounded-2xl border border-primary-foreground/15 bg-primary-foreground/5 px-5 py-3 text-center">
              <p className="font-mono text-3xl font-extrabold leading-none sm:text-4xl">
                {result.score}
                <span className="text-lg text-primary-foreground/60">/{result.total}</span>
              </p>
              <p className="type-meta mt-1 text-primary-foreground/70">{percent}%</p>
            </div>
          </div>

          {result.xp ? (
            <LevelBar
              className="mt-4 border-primary-foreground/15 bg-primary-foreground/5 text-primary-foreground"
              data={{
                level: result.xp.level,
                title: result.xp.title,
                into: result.xp.into,
                need: result.xp.need,
                percent: result.xp.percent,
                gained: result.xp.gained,
                leveledUp: result.xp.leveledUp,
              }}
            />
          ) : null}



          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button
              className="h-10 flex-1 rounded-xl sm:flex-none"
              onClick={onRetake}
              disabled={retaking}
            >
              {retaking ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {result.passed ? "Thi lại để lên điểm" : "Thi lại ngay"}
            </Button>
            <Button asChild variant="secondary" className="h-10 flex-1 rounded-xl sm:flex-none">
              <a href="/bang-xep-hang">Bảng xếp hạng</a>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-10 rounded-xl border-primary-foreground/30 bg-transparent"
            >
              <a href="/lich-su">Lịch sử làm bài</a>
            </Button>
            {!result.disqualified && result.passed ? <LiveRank result={result} /> : null}
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <h2 className="type-h3">Xem lại đáp án</h2>
            <p className="type-meta">
              {wrong.length > 0
                ? `${wrong.length} câu cần ôn lại`
                : "Bạn trả lời đúng tất cả các câu."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 rounded-full"
            onClick={() => setShowAll((v) => !v)}
          >
            {showAll ? "Chỉ câu sai" : "Xem tất cả"}
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {visible.map((item, idx) => {
            const number = result.review.indexOf(item) + 1;
            return (
              <article key={idx} className="card-elevated animate-rise rounded-2xl p-4">
                <div className="flex items-start gap-2.5">
                  {item.correct ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  )}
                  <div className="min-w-0 text-sm font-semibold leading-relaxed">
                    <span className="mr-1">Câu {number}.</span>
                    <RichText inline>{item.question}</RichText>
                  </div>
                  <span className="type-meta shrink-0 rounded-full bg-secondary px-2 py-0.5">
                    {KIND_LABEL[item.kind]}
                  </span>
                  {!item.correct && (item.fraction ?? 0) > 0 ? (
                    <span className="type-meta shrink-0 rounded-full bg-warning/15 px-2 py-0.5 text-warning">
                      Đúng một phần {Math.round((item.fraction ?? 0) * 100)}%
                    </span>
                  ) : null}
                </div>
                {questionImageSrc(item.imageUrl) ? (
                  <img
                    src={questionImageSrc(item.imageUrl)!}
                    alt={item.imageAlt || `Hình minh hoạ câu ${number}`}
                    loading="lazy"
                    className="mt-3 max-h-48 w-full rounded-xl border border-border object-contain"
                  />
                ) : null}
                <div className="mt-3 space-y-1.5 text-sm">
                  <p
                    className={cn(
                      "rounded-lg border px-3 py-1.5",
                      item.correct
                        ? "border-success/50 bg-success/10 text-success"
                        : "border-destructive/50 bg-destructive/10 text-destructive",
                    )}
                  >
                    <span className="font-semibold">Bạn trả lời: </span>
                    {item.answered ? (
                      <RichText inline>{item.chosenText}</RichText>
                    ) : (
                      "(chưa trả lời)"
                    )}
                  </p>
                  {!item.correct ? (
                    <p className="rounded-lg border border-success/50 bg-success/10 px-3 py-1.5 text-success">
                      <span className="font-semibold">Đáp án đúng: </span>
                      <RichText inline>{item.correctText}</RichText>
                    </p>
                  ) : null}
                  {item.explanation ? (
                    <div className="rounded-lg border border-border bg-secondary/60 px-3 py-1.5 text-muted-foreground">
                      <span className="font-semibold text-foreground">Giải thích: </span>
                      <RichText inline>{item.explanation}</RichText>
                    </div>
                  ) : null}
                  {(item.optionExplanations ?? []).some((t) => t.trim()) ? (
                    <ul className="space-y-1 rounded-lg border border-border bg-card/60 px-3 py-2">
                      {item.options.map((opt, oi) =>
                        (item.optionExplanations?.[oi] ?? "").trim() ? (
                          <li key={oi} className="text-xs text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {String.fromCharCode(65 + oi)}. {opt}:{" "}
                            </span>
                            <RichText inline>{item.optionExplanations[oi]}</RichText>
                          </li>
                        ) : null,
                      )}
                    </ul>
                  ) : null}
                </div>
              </article>
            );
          })}
          {visible.length === 0 ? (
            <p className="type-muted rounded-2xl border border-dashed border-border p-6 text-center">
              Không có câu sai nào. Bấm “Xem tất cả” để ôn lại toàn bộ đề.
            </p>
          ) : null}
        </div>
      </main>
    </div>
  );
}
