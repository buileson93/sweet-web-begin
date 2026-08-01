import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, GraduationCap, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getOrgWeakTopicsFn } from "@/lib/tower.functions";
import { MASTERY_LABEL, type Mastery } from "@/lib/tower/topics";
import { cn } from "@/lib/utils";

type Report = Awaited<ReturnType<typeof getOrgWeakTopicsFn>>;

const TONE: Record<Mastery, string> = {
  moi: "text-muted-foreground",
  "dang-hoc": "text-destructive",
  kha: "text-amber-600 dark:text-amber-400",
  "thanh-thao": "text-emerald-600 dark:text-emerald-400",
};

/**
 * Báo cáo chủ đề yếu toàn đơn vị — chỉ đọc, phân trang phía máy chủ.
 * Dùng để chọn nội dung tập huấn; không ảnh hưởng kết quả hay xếp hạng kỳ thi.
 */
export function TopicReport() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getOrgWeakTopicsFn({ data: { page, pageSize: 20 } })
      .then((res) => alive && setData(res))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Không tải được báo cáo."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page]);

  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / (data?.pageSize ?? 20)));

  return (
    <section className="space-y-4 rounded-2xl border bg-card/70 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <GraduationCap className="size-5 text-primary" />
        <div>
          <h3 className="text-sm font-semibold">Chủ đề cần tập huấn</h3>
          <p className="type-meta">
            Xếp từ yếu nhất, tính trên dữ liệu ôn tập — không lấy từ điểm thi.
          </p>
        </div>
      </div>

      {loading && !data ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      ) : !data?.rows.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Chưa có dữ liệu ôn tập theo chủ đề. Hãy gắn thẻ chủ đề cho câu hỏi.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-muted-foreground">
              <tr>
                <th className="py-2">Chủ đề</th>
                <th className="py-2">Người học</th>
                <th className="py-2">Điểm TB</th>
                <th className="py-2">Tỉ lệ đúng</th>
                <th className="py-2">Mức</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.tag} className="border-t">
                  <td className="py-2 font-medium">{r.tag}</td>
                  <td className="py-2 tabular-nums">{r.learners}</td>
                  <td className="py-2 tabular-nums">{r.avgRating}</td>
                  <td className="py-2 tabular-nums">{r.accuracy}%</td>
                  <td className={cn("py-2", TONE[r.mastery])}>{MASTERY_LABEL[r.mastery]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="type-meta tabular-nums">
            {page}/{totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </section>
  );
}
