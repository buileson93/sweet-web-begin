import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Award, Download, FileSpreadsheet, Search, SearchX, Trophy, UserRound } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { normalizeKey } from "@/lib/csv";
import { downloadCsv, downloadExcel, type ExportRow } from "@/lib/export";
import { formatDateTime } from "@/lib/format";
import { PASS_PERCENT_DEFAULT, isPassed } from "@/lib/grading";
import { cn } from "@/lib/utils";

/** Ngưỡng đạt mặc định: 50% (đồng bộ với máy chủ chấm bài, xem isPassed). */

type ResultRow = {
  id: string;
  employee_id: string | null;
  candidate_name: string;
  unit: string | null;
  quiz_id: string;
  quiz_title: string;
  score: number;
  total: number;
  time_seconds: number;
  time_ms: number | null;
  disqualified: boolean;
  submitted_at: string;
};

type Achievement = {
  key: string;
  name: string;
  unit: string;
  attempts: number;
  passed: number;
  bestPercent: number;
  totalScore: number;
  lastAt: string;
  rows: ResultRow[];
};

function percentOf(r: ResultRow) {
  return r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
}

/** Lịch sử tham gia và thành tích theo từng nhân viên, phục vụ xuất báo cáo nhanh. */
export function EmployeeHistoryManager() {
  const [keyword, setKeyword] = useState("");
  const [selected, setSelected] = useState<Achievement | null>(null);

  const resultsQuery = useQuery({
    queryKey: ["admin-employee-history"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("results")
        .select(
          "id, employee_id, candidate_name, unit, quiz_id, quiz_title, score, total, time_seconds, time_ms, disqualified, submitted_at",
        )
        .order("submitted_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data as ResultRow[];
    },
  });

  const people = useMemo(() => {
    const map = new Map<string, Achievement>();
    for (const r of resultsQuery.data ?? []) {
      const key = r.employee_id ?? `name:${normalizeKey(r.candidate_name)}`;
      const cur =
        map.get(key) ??
        ({
          key,
          name: r.candidate_name,
          unit: r.unit ?? "",
          attempts: 0,
          passed: 0,
          bestPercent: 0,
          totalScore: 0,
          lastAt: r.submitted_at,
          rows: [],
        } satisfies Achievement);
      const pct = percentOf(r);
      cur.attempts += 1;
      cur.totalScore += r.score;
      if (!r.disqualified && isPassed(r.score, r.total, PASS_PERCENT_DEFAULT)) cur.passed += 1;
      cur.bestPercent = Math.max(cur.bestPercent, r.disqualified ? 0 : pct);
      if (r.submitted_at > cur.lastAt) cur.lastAt = r.submitted_at;
      cur.rows.push(r);
      map.set(key, cur);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.bestPercent - a.bestPercent || b.attempts - a.attempts,
    );
  }, [resultsQuery.data]);

  const rows = useMemo(() => {
    const kw = normalizeKey(keyword);
    if (!kw) return people;
    return people.filter(
      (p) => normalizeKey(p.name).includes(kw) || normalizeKey(p.unit).includes(kw),
    );
  }, [people, keyword]);

  function summaryRows(): ExportRow[] {
    return rows.map((p, i) => ({
      STT: i + 1,
      "Họ và tên": p.name,
      "Đơn vị": p.unit,
      "Số lượt thi": p.attempts,
      "Số lần đạt": p.passed,
      "Điểm cao nhất (%)": p.bestPercent,
      "Lần gần nhất": formatDateTime(p.lastAt),
    }));
  }

  function detailRows(p: Achievement): ExportRow[] {
    return p.rows.map((r, i) => ({
      STT: i + 1,
      "Họ và tên": p.name,
      "Đơn vị": p.unit,
      "Cuộc thi": r.quiz_title,
      Điểm: `${r.score}/${r.total}`,
      "Tỷ lệ (%)": percentOf(r),
      "Kết quả": r.disqualified
        ? "Huỷ"
        : isPassed(r.score, r.total, PASS_PERCENT_DEFAULT)
          ? "Đạt"
          : "Chưa đạt",
      "Thời gian làm": formatDurationOf(r),
      "Thời điểm nộp": formatDateTime(r.submitted_at),
    }));
  }

  async function exportData(kind: "csv" | "xlsx", data: ExportRow[], label: string) {
    if (data.length === 0) return toast.error("Không có dữ liệu để tải xuống.");
    const name = `${label}-${new Date().toISOString().slice(0, 10)}.${kind}`;
    if (kind === "csv") downloadCsv(data, name);
    else await downloadExcel(data, name, "ThanhTich");
    await logAudit({
      action: "export",
      entity: "result",
      entityLabel: `Báo cáo thành tích (${data.length} dòng)`,
      details: { count: data.length },
    });
    toast.success(`Đã tải xuống ${data.length} dòng dữ liệu.`);
  }

  return (
    <>
      <AdminSection
        title="Lịch sử & thành tích nhân viên"
        description={
          resultsQuery.isLoading
            ? "Đang tải..."
            : `${rows.length} nhân viên đã tham gia · nhấn vào một dòng để xem chi tiết`
        }
        toolbar={
          <div className="relative sm:w-72">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="rounded-full pl-10"
              placeholder="Tìm theo tên hoặc đơn vị..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>
        }
        actions={
          <>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={rows.length === 0}
              onClick={() => void exportData("csv", summaryRows(), "thanh-tich-nhan-vien")}
            >
              <Download className="size-4" /> CSV
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              disabled={rows.length === 0}
              onClick={() => void exportData("xlsx", summaryRows(), "thanh-tich-nhan-vien")}
            >
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
          </>
        }
      >
        <QueryState
          isLoading={resultsQuery.isLoading}
          isError={resultsQuery.isError}
          error={resultsQuery.error}
          isFetching={resultsQuery.isFetching}
          onRetry={() => void resultsQuery.refetch()}
          isEmpty={rows.length === 0}
          skeleton={<ListSkeleton rows={6} height="h-16" />}
          empty={
            <EmptyState
              icon={keyword ? SearchX : Trophy}
              title={keyword ? "Không tìm thấy nhân viên phù hợp" : "Chưa có lượt thi nào"}
              description={
                keyword
                  ? "Thử từ khoá khác."
                  : "Khi nhân viên hoàn thành bài thi, thành tích sẽ xuất hiện tại đây."
              }
            />
          }
        >
          <div className="card-elevated divide-y divide-border overflow-hidden">
            {rows.map((p, i) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full flex-wrap items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50"
              >
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">
                  {i + 1}
                </span>
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                  <UserRound className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.name}</span>
                  <span className="type-meta block truncate">
                    {p.unit || "Chưa cập nhật đơn vị"}
                  </span>
                </span>
                <span className="type-meta hidden sm:block">{p.attempts} lượt</span>
                <span
                  className={cn(
                    "status-pill",
                    p.passed > 0
                      ? "bg-success/15 text-success"
                      : "bg-warning/15 text-warning-foreground",
                  )}
                >
                  {p.passed > 0 ? `Đạt ${p.passed} cuộc thi` : "Chưa đạt"}
                </span>
                <span className="w-16 text-right font-mono text-sm font-bold text-primary">
                  {p.bestPercent}%
                </span>
                <span className="type-meta hidden w-40 text-right md:block">
                  {formatDateTime(p.lastAt)}
                </span>
              </button>
            ))}
          </div>
        </QueryState>
      </AdminSection>

      <Dialog open={Boolean(selected)} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="size-5 text-primary" /> {selected?.name}
            </DialogTitle>
            <DialogDescription>
              {selected?.unit || "Chưa cập nhật đơn vị"} · {selected?.attempts} lượt thi · điểm cao
              nhất {selected?.bestPercent}%
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {(selected?.rows ?? []).map((r) => {
              const pct = percentOf(r);
              return (
                <div key={r.id} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate font-semibold">{r.quiz_title}</p>
                    <span className="font-mono text-sm font-bold">
                      {r.score}/{r.total}
                    </span>
                  </div>
                  <div className="type-meta mt-1 flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "status-pill",
                        r.disqualified
                          ? "bg-destructive/12 text-destructive"
                          : isPassed(r.score, r.total, PASS_PERCENT_DEFAULT)
                            ? "bg-success/15 text-success"
                            : "bg-warning/15 text-warning-foreground",
                      )}
                    >
                      {r.disqualified
                        ? "Huỷ kết quả"
                        : isPassed(r.score, r.total, PASS_PERCENT_DEFAULT)
                          ? "Đạt"
                          : "Chưa đạt"}
                    </span>
                    <span>{pct}%</span>
                    <span>· {formatDurationOf(r)}</span>
                    <span>· {formatDateTime(r.submitted_at)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() =>
                selected &&
                void exportData(
                  "csv",
                  detailRows(selected),
                  `lich-su-${normalizeKey(selected.name).replace(/ /g, "-")}`,
                )
              }
            >
              <Download className="size-4" /> CSV
            </Button>
            <Button
              className="rounded-full"
              onClick={() =>
                selected &&
                void exportData(
                  "xlsx",
                  detailRows(selected),
                  `lich-su-${normalizeKey(selected.name).replace(/ /g, "-")}`,
                )
              }
            >
              <FileSpreadsheet className="size-4" /> Excel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
