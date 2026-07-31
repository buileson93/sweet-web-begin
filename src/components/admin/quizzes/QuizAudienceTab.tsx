import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Users } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { getQuizAudienceStats } from "@/lib/quizAdmin.functions";

type Unit = { id: string; name: string };

type Props = {
  quizId: string | null;
  units: Unit[];
  selected: string[];
  onChange: (next: string[]) => void;
};

/** Tab "Đối tượng": chọn đơn vị được dự thi. Để trống = toàn công ty. */
export function QuizAudienceTab({ quizId, units, selected, onChange }: Props) {
  const runStats = useServerFn(getQuizAudienceStats);
  const statsQuery = useQuery({
    queryKey: ["quiz-audience-stats", quizId],
    enabled: Boolean(quizId),
    queryFn: () => runStats({ data: { quizId: quizId! } }),
  });

  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((u) => u !== id) : [...selected, id]);
  }

  const stats = statsQuery.data;

  return (
    <div className="space-y-3">
      <div className="rounded-xl bg-secondary p-3">
        <p className="text-sm font-semibold">Ai được dự thi?</p>
        <p className="text-xs text-muted-foreground">
          Không chọn đơn vị nào nghĩa là <strong>toàn công ty</strong>. Nếu chọn, chỉ nhân viên thuộc các đơn vị đó mới
          bắt đầu được bài thi.
        </p>
      </div>

      {stats && (
        <div className="flex items-center gap-2 rounded-xl border border-border p-3 text-sm">
          <Users className="size-4 text-accent" />
          <span>
            Đối tượng: <strong>{stats.audienceCount}</strong> người — đã thi{" "}
            <strong>{stats.takenCount}</strong> ({stats.percent}%)
          </span>
        </div>
      )}
      {!quizId && <p className="type-meta">Lưu cuộc thi để xem số liệu đối tượng.</p>}

      <div className="grid max-h-72 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
        {units.map((u) => (
          <label
            key={u.id}
            className="flex cursor-pointer items-center gap-2 rounded-lg border border-border p-2.5 text-sm"
          >
            <Checkbox checked={selected.includes(u.id)} onCheckedChange={() => toggle(u.id)} />
            <span className="min-w-0 truncate">{u.name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
