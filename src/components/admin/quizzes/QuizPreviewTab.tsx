import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Eye, ImageIcon, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ListSkeleton, QueryState } from "@/components/ui-kit";
import { previewQuiz } from "@/lib/quizAdmin.functions";
import { DIFFICULTY_LABEL, KIND_LABEL } from "@/lib/questionKinds";

/** Tab "Xem trước": sinh thử một đề theo cấu hình ĐÃ LƯU (không tạo phiên thi, không lộ đáp án). */
export function QuizPreviewTab({ quizId }: { quizId: string | null }) {
  const runPreview = useServerFn(previewQuiz);
  const query = useQuery({
    queryKey: ["quiz-preview", quizId],
    enabled: Boolean(quizId),
    queryFn: () => runPreview({ data: { quizId: quizId! } }),
  });

  if (!quizId) {
    return <p className="type-meta">Lưu cuộc thi trước để xem thử đề sẽ ra.</p>;
  }

  const data = query.data;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Đề mẫu sinh theo cấu hình đã lưu. Bấm làm mới để bốc một đề khác.
        </p>
        <Button size="sm" variant="outline" className="rounded-full" onClick={() => void query.refetch()}>
          <RefreshCw className="size-3.5" /> Bốc đề khác
        </Button>
      </div>

      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        isEmpty={Boolean(data && data.items.length === 0)}
        skeleton={<ListSkeleton rows={5} height="h-12" />}
        empty={<p className="type-meta">Ngân hàng chưa có câu hỏi nào để bốc đề.</p>}
      >
        {data && (
          <>
            <p className="type-meta">
              <Eye className="mr-1 inline size-3.5" />
              {data.items.length}/{data.questionCount} câu · kho {data.poolSize} câu
            </p>
            <ol className="mt-2 space-y-2">
              {data.items.map((item) => (
                <li key={item.id} className="rounded-lg border border-border p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="status-pill bg-secondary text-secondary-foreground">Câu {item.order}</span>
                    <span className="status-pill bg-secondary text-muted-foreground">{KIND_LABEL[item.kind]}</span>
                    <span className="status-pill bg-secondary text-muted-foreground">
                      {DIFFICULTY_LABEL[item.difficulty]}
                    </span>
                    <span className="status-pill bg-secondary text-muted-foreground">{item.points} điểm</span>
                    {item.hasImage && <ImageIcon className="size-3.5 text-muted-foreground" />}
                    {item.tags.map((t) => (
                      <span key={t} className="status-pill bg-accent/10 text-accent">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm">{item.question}</p>
                </li>
              ))}
            </ol>
          </>
        )}
      </QueryState>
    </div>
  );
}
