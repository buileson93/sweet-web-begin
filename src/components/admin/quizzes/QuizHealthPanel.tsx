import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";

import { analyzeQuizHealth, type PoolStats } from "@/lib/quizHealth";
import { DIFFICULTY_LABEL, type Blueprint } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

type Props = {
  pool: PoolStats;
  questionCount: number;
  blueprint: Blueprint;
  loading?: boolean;
};

/** Bảng "Sức khoẻ ngân hàng đề": đối chiếu kho hiện có với yêu cầu của đề. */
export function QuizHealthPanel({ pool, questionCount, blueprint, loading }: Props) {
  const health = analyzeQuizHealth({ questionCount, blueprint, pool });
  const tagRows = Object.entries(pool.tags).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">Sức khoẻ ngân hàng đề</p>
        {loading ? (
          <span className="type-meta">Đang tính...</span>
        ) : health.hasBlocker ? (
          <span className="status-pill bg-destructive/10 text-destructive">Chưa đủ điều kiện xuất bản</span>
        ) : (
          <span className="status-pill bg-success/10 text-success">Sẵn sàng xuất bản</span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-secondary p-3">
          <p className="type-meta">Kho hiện có</p>
          <p className="font-heading text-lg font-bold">{pool.total} câu</p>
          <p className="text-xs text-muted-foreground">
            Dễ {pool.easy} · Trung bình {pool.medium} · Khó {pool.hard}
          </p>
        </div>
        <div className="rounded-lg bg-secondary p-3">
          <p className="type-meta">Đề yêu cầu</p>
          <p className="font-heading text-lg font-bold">{questionCount} câu</p>
          <p className="text-xs text-muted-foreground">
            Công thức: Dễ {Number(blueprint.easy ?? 0)} · TB {Number(blueprint.medium ?? 0)} · Khó{" "}
            {Number(blueprint.hard ?? 0)}
            {health.blueprintTotal > 0 ? ` (tổng ${health.blueprintTotal})` : " (bốc ngẫu nhiên)"}
          </p>
        </div>
      </div>

      {tagRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tagRows.slice(0, 12).map(([tag, count]) => (
            <span key={tag} className="status-pill bg-secondary text-muted-foreground">
              {tag}: {count}
            </span>
          ))}
        </div>
      )}

      <ul className="space-y-2">
        {health.issues.map((issue, i) => {
          const Icon = issue.level === "red" ? ShieldAlert : issue.level === "yellow" ? AlertTriangle : Info;
          return (
            <li
              key={i}
              className={cn(
                "flex gap-2 rounded-lg p-2.5 text-xs leading-relaxed",
                issue.level === "red" && "bg-destructive/10 text-destructive",
                issue.level === "yellow" && "bg-warning/10 text-warning-foreground",
                issue.level === "info" && "bg-secondary text-muted-foreground",
              )}
            >
              <Icon className="mt-0.5 size-3.5 shrink-0" />
              <span>{issue.message}</span>
            </li>
          );
        })}
        {!health.issues.some((i) => i.level !== "info") && (
          <li className="flex gap-2 rounded-lg bg-success/10 p-2.5 text-xs text-success">
            <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Kho đủ {pool.total} câu cho đề {questionCount} câu — mức {DIFFICULTY_LABEL.medium} chiếm phần lớn.
            </span>
          </li>
        )}
      </ul>
    </div>
  );
}
