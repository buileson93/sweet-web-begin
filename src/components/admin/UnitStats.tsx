import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { downloadXlsx } from "@/lib/xlsxIo";
import { useMemo, useState } from "react";
import { Building2, Download, Inbox } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { getUnitStats, type UnitStatRow } from "@/lib/unitStats.functions";

export function UnitStats() {
  const [quizId, setQuizId] = useState("all");
  const fetchUnitStats = useServerFn(getUnitStats);

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
    queryFn: () => fetchUnitStats({ data: { quizId: quizId as any } }),
  });

  const rows = query.data || [];

  const distributionQuery = useQuery({
    queryKey: ["admin-distribution", quizId],
    queryFn: async () => {
      let q = supabase
        .from("results")
        .select("score, total, disqualified")
        .eq("disqualified", false);
      if (quizId !== "all") q = q.eq("quiz_id", quizId);
      const { data, error } = await q.limit(50000);
      if (error) throw error;
      return data;
    },
  });

  const distribution = useMemo(() => {
    const buckets = [0, 0, 0, 0, 0];
    for (const r of distributionQuery.data ?? []) {
      if (!r.total) continue;
      const pct = (r.score / r.total) * 100;
      const i = pct < 50 ? 0 : pct < 65 ? 1 : pct < 80 ? 2 : pct < 90 ? 3 : 4;
      buckets[i] += 1;
    }
    return [
      { range: "Dưới 50%", count: buckets[0], fail: true },
      { range: "50–64%", count: buckets[1], fail: false },
      { range: "65–79%", count: buckets[2], fail: false },
      { range: "80–89%", count: buckets[3], fail: false },
      { range: "90–100%", count: buckets[4], fail: false },
    ];
  }, [distributionQuery.data]);


  const chartRows = useMemo(() => rows.slice(0, 12), [rows]);

  async function exportExcel() {
    const data = [
      ["Đơn vị", "Lượt thi", "Số thí sinh", "Điểm TB (%)", "Tỉ lệ đạt (%)", "Cao nhất (%)"],
      ...rows.map((r) => [r.unit, r.attempts, r.candidates, r.avgPercent, r.passRate, r.best]),
    ];
    await downloadXlsx([{ name: "ThongKeDonVi", data }], "thong-ke-don-vi.xlsx");
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
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-elevated p-4">
            <p className="type-eyebrow mb-3 text-muted-foreground">Điểm trung bình & tỉ lệ đạt theo đơn vị</p>
            <div className="h-[clamp(15rem,45dvh,20rem)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="unit" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip
                    formatter={(v: number, n: string) => [`${v}%`, n]}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="avgPercent" name="Điểm TB" fill="var(--primary)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="passRate" name="Tỉ lệ đạt" fill="var(--accent)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {rows.length > chartRows.length ? (
              <p className="type-meta mt-2">Biểu đồ hiển thị 12 đơn vị có điểm cao nhất.</p>
            ) : null}
          </div>

          <div className="card-elevated p-4">
            <p className="type-eyebrow mb-3 text-muted-foreground">Phân bố điểm (số lượt thi)</p>
            <div className="h-[clamp(15rem,45dvh,20rem)] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={distribution} margin={{ left: -20, right: 8, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: number) => [`${v} lượt`, "Số lượt"]}
                    contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                  <Bar dataKey="count" name="Số lượt" radius={[6, 6, 0, 0]}>
                    {distribution.map((d) => (
                      <Cell key={d.range} fill={d.fail ? "var(--destructive)" : "var(--primary)"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="type-meta mt-2">Dữ liệu rà soát đồng bộ: bao gồm tất cả thí sinh dự thi (đạt & chưa đạt). Điểm dưới 50% không vào bảng xếp hạng công khai.</p>
          </div>
        </div>

        <div className="card-elevated mt-4 overflow-x-auto">
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
