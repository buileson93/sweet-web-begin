import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, Inbox, Search, SearchX, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { formatDateTime, formatSeconds } from "@/lib/format";


export function ResultManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const [quizId, setQuizId] = useState("all");
  const [keyword, setKeyword] = useState("");

  const { data: quizzes = [] } = useQuery({
    queryKey: ["admin-quizzes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id, title").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const resultsQuery = useQuery({
    queryKey: ["admin-results", quizId],
    queryFn: async () => {
      let query = supabase.from("results").select("*").order("submitted_at", { ascending: false }).limit(1000);
      if (quizId !== "all") query = query.eq("quiz_id", quizId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
  const results = resultsQuery.data ?? [];


  const rows = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return results.filter(
      (r) => !kw || r.candidate_name.toLowerCase().includes(kw) || (r.unit ?? "").toLowerCase().includes(kw),
    );
  }, [results, keyword]);

  const remove = useMutation({
    mutationFn: async (row: { id: string; candidate_name: string }) => {
      const { error } = await supabase.from("results").delete().eq("id", row.id);
      if (error) throw error;
      await logAudit({ action: "delete", entity: "result", entityId: row.id, entityLabel: row.candidate_name });
    },
    onSuccess: () => {
      toast.success("Đã xoá kết quả.");
      void qc.invalidateQueries({ queryKey: ["admin-results"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = [
      ["Họ tên", "Năm sinh", "Đơn vị", "Cuộc thi", "Điểm", "Tổng câu", "Thời gian", "Nộp lúc", "Trạng thái"],
      ...rows.map((r) => [
        r.candidate_name,
        r.birth_year,
        r.unit,
        r.quiz_title,
        r.score,
        r.total,
        formatSeconds(r.time_seconds),
        formatDateTime(r.submitted_at),
        r.disqualified ? "Huỷ (gian lận)" : "Hợp lệ",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "KetQua");
    XLSX.writeFile(wb, "ket-qua-thi.xlsx");
  }

  return (
    <AdminSection
      title="Kết quả dự thi"
      description={resultsQuery.isLoading ? "Đang tải..." : `${rows.length} / ${results.length} lượt thi`}
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={quizId} onValueChange={setQuizId}>
            <SelectTrigger className="rounded-full sm:w-56">
              <SelectValue placeholder="Tất cả cuộc thi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả cuộc thi</SelectItem>
              {quizzes.map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="relative sm:w-56">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-10"
              placeholder="Tìm thí sinh, đơn vị..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        </div>
      }
      actions={
        <Button variant="outline" className="rounded-full" onClick={exportExcel} disabled={!rows.length}>
          <Download className="size-4" /> Xuất Excel
        </Button>
      }
    >
      <QueryState
        isLoading={resultsQuery.isLoading}
        isError={resultsQuery.isError}
        error={resultsQuery.error}
        isFetching={resultsQuery.isFetching}
        onRetry={() => void resultsQuery.refetch()}
        isEmpty={rows.length === 0}
        skeleton={<ListSkeleton rows={5} height="h-14" />}
        empty={
          keyword.trim() ? (
            <EmptyState
              icon={SearchX}
              title="Không có kết quả phù hợp"
              description="Thử từ khoá khác hoặc chọn cuộc thi khác."
              action={
                <Button variant="outline" className="rounded-full" onClick={() => setKeyword("")}>
                  Xoá tìm kiếm
                </Button>
              }
            />
          ) : (
            <EmptyState icon={Inbox} title="Chưa có kết quả" description="Kết quả sẽ hiện ngay khi thí sinh nộp bài." />
          )
        }
      >
        <div className="card-elevated overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Thí sinh</th>
                <th className="px-4 py-3 font-semibold">Đơn vị</th>
                <th className="px-4 py-3 font-semibold">Cuộc thi</th>
                <th className="px-4 py-3 font-semibold">Điểm</th>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Nộp lúc</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.candidate_name}</p>
                    <p className="type-meta">{r.birth_year}</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-muted-foreground">{r.unit}</td>
                  <td className="max-w-[240px] px-4 py-3 text-muted-foreground">{r.quiz_title}</td>
                  <td className="px-4 py-3 font-mono font-bold">
                    {r.score}/{r.total}
                    {r.disqualified && <span className="ml-2 text-xs font-normal text-destructive">huỷ</span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{formatSeconds(r.time_seconds)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDateTime(r.submitted_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label="Xoá kết quả"
                      hidden={!canEdit}
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm("Xoá kết quả này?")) remove.mutate(r);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </AdminSection>
  );
}

