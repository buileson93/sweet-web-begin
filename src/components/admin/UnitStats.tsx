import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, Download, Inbox } from "lucide-react";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  unit: string;
  attempts: number;
  candidates: number;
  avgPercent: number;
  passRate: number;
  best: number;
};

export function UnitStats() {
  const [quizId, setQuizId] = useState("all");

  const { data: quizzes = [] } = useQuery({
    queryKey: ["admin-quizzes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("id, title").order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const query = useQuery({
    queryKey: ["admin-unit-stats", quizId],
    queryFn: async () => {
      let q = supabase
        .from("results")
        .select("unit, candidate_name, score, total, passed, disqualified")
        .limit(5000);
      if (quizId !== "all") q = q.eq("quiz_id", quizId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo<Row[]>(() => {
    const map = new Map<string, { scores: number[]; names: Set<string>; passed: number }>();
    for (const r of query.data ?? []) {
      if (r.disqualified) continue;
      const unit = r.unit?.trim() || "(Chưa rõ đơn vị)";
      const entry = map.get(unit) ?? { scores: [], names: new Set<string>(), passed: 0 };
      entry.scores.push(r.total ? (r.score / r.total) * 100 : 0);
      entry.names.add(r.candidate_name);
      if (r.passed) entry.passed += 1;
      map.set(unit, entry);
    }
    return [...map.entries()]
      .map(([unit, e]) => ({
        unit,
        attempts: e.scores.length,
        candidates: e.names.size,
        avgPercent: Math.round(e.scores.reduce((a, b) => a + b, 0) / e.scores.length),
        passRate: Math.round((e.passed / e.scores.length) * 100),
        best: Math.round(Math.max(...e.scores)),
      }))
      .sort((a, b) => b.avgPercent - a.avgPercent);
  }, [query.data]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const data = [
      ["Đơn vị", "Lượt thi", "Số thí sinh", "Điểm TB (%)", "Tỉ lệ đạt (%)", "Cao nhất (%)"],
      ...rows.map((r) => [r.unit, r.attempts, r.candidates, r.avgPercent, r.passRate, r.best]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ThongKeDonVi");
    XLSX.writeFile(wb, "thong-ke-don-vi.xlsx");
  }

  return (
    <AdminSection
      title="Thống kê theo đơn vị"
      description={query.isLoading ? "Đang tải..." : `${rows.length} đơn vị có dữ liệu`}
      toolbar={
        <Select value={quizId} onValueChange={setQuizId}>
          <SelectTrigger className="rounded-full sm:w-64">
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
      }
      actions={
        <Button variant="outline" className="rounded-full" onClick={exportExcel} disabled={!rows.length}>
          <Download className="size-4" /> Xuất Excel
        </Button>
      }
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        isEmpty={rows.length === 0}
        skeleton={<ListSkeleton rows={5} height="h-12" />}
        empty={
          <EmptyState
            icon={Inbox}
            title="Chưa có dữ liệu thống kê"
            description="Thống kê sẽ xuất hiện sau khi có bài thi hợp lệ được nộp."
          />
        }
      >
        <div className="card-elevated overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Đơn vị</th>
                <th className="px-4 py-3 font-semibold">Lượt thi</th>
                <th className="px-4 py-3 font-semibold">Thí sinh</th>
                <th className="px-4 py-3 font-semibold">Điểm trung bình</th>
                <th className="px-4 py-3 font-semibold">Tỉ lệ đạt</th>
                <th className="px-4 py-3 font-semibold">Cao nhất</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.unit} className="border-t border-border transition-colors hover:bg-secondary/40">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2 font-semibold">
                      <Building2 className="size-4 text-accent" /> {r.unit}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{r.attempts}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{r.candidates}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-secondary">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${r.avgPercent}%` }} />
                      </div>
                      <span className="font-mono text-xs">{r.avgPercent}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono">{r.passRate}%</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{r.best}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>
    </AdminSection>
  );
}
