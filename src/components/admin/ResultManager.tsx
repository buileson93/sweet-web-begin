import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { downloadXlsx } from "@/lib/xlsxIo";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Inbox, RotateCcw, Search, SearchX, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useServerFn } from "@tanstack/react-start";
import { listExamEvents, restoreResult } from "@/lib/integrity.functions";
import { listPaginatedResults } from "@/lib/adminStats.functions";
import { describeExamEvent } from "@/lib/integrity";
import { formatDateTime as fmtDateTime } from "@/lib/format";

function IntegrityCell({ sessionId, score }: { sessionId: string | null; score: number | null }) {
  const [open, setOpen] = useState(false);
  const runList = useServerFn(listExamEvents);
  const events = useQuery({
    queryKey: ["exam-events", sessionId],
    enabled: open && Boolean(sessionId),
    queryFn: () => runList({ data: { sessionId: sessionId as string } }),
  });

  const value = score ?? 0;
  const tone =
    value === 0
      ? "text-muted-foreground"
      : value >= 6
        ? "text-destructive"
        : "text-warning-foreground";

  if (!sessionId) return <span className="text-muted-foreground">—</span>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1 font-mono font-semibold ${tone}`}
        >
          <ShieldAlert className="size-4" />
          {value}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 text-sm">
        <p className="mb-2 font-semibold">Sự kiện liêm chính</p>
        {events.isLoading ? (
          <p className="type-meta">Đang tải...</p>
        ) : events.data && events.data.length ? (
          <ul className="max-h-60 space-y-1 overflow-y-auto">
            {events.data.map((e) => (
              <li key={e.id} className="border-b border-border/60 pb-1">
                <div className="flex justify-between gap-2">
                  <span>{describeExamEvent(e.kind, e.detail)}</span>
                  <span className="font-mono text-muted-foreground">+{e.weight}</span>
                </div>
                <p className="type-meta text-muted-foreground">{fmtDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="type-meta">Không có sự kiện nào được ghi nhận.</p>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ResultManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const [quizId, setQuizId] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: quizzes = [] } = useQuery({
    queryKey: ["admin-quizzes-lite"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const listResults = useServerFn(listPaginatedResults);

  const resultsQuery = useQuery({
    queryKey: ["admin-results", quizId, keyword, page],
    queryFn: () => listResults({ data: { quizId: quizId as any, keyword, page, pageSize } }),
  });

  const { items: rows = [], total = 0 } = resultsQuery.data ?? {};
  const totalPages = Math.ceil(total / pageSize);


  const runRestore = useServerFn(restoreResult);
  const [restoreTarget, setRestoreTarget] = useState<{ id: string; name: string } | null>(null);
  const [restoreReason, setRestoreReason] = useState("");

  const restore = useMutation({
    mutationFn: async (payload: { resultId: string; reason: string }) =>
      runRestore({ data: payload }),
    onSuccess: () => {
      toast.success("Đã phục hồi bài thi và ghi vào nhật ký.");
      setRestoreTarget(null);
      setRestoreReason("");
      void qc.invalidateQueries({ queryKey: ["admin-results"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: { id: string; candidate_name: string }) => {
      const { error } = await supabase.from("results").delete().eq("id", row.id);
      if (error) throw error;
      await logAudit({
        action: "delete",
        entity: "result",
        entityId: row.id,
        entityLabel: row.candidate_name,
      });
    },
    onSuccess: () => {
      toast.success("Đã xoá kết quả.");
      void qc.invalidateQueries({ queryKey: ["admin-results"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function exportExcel() {
    const data = [
      [
        "Họ tên",
        "Năm sinh",
        "Đơn vị",
        "Cuộc thi",
        "Điểm",
        "Tổng câu",
        "Thời gian",
        "Nộp lúc",
        "Trạng thái",
      ],
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
    await downloadXlsx([{ name: "KetQua", data }], "ket-qua-thi.xlsx");
  }

  return (
    <AdminSection
      title="Kết quả dự thi"
      description={
        resultsQuery.isLoading ? "Đang tải..." : `${total} lượt thi trên toàn hệ thống`
      }
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={quizId} onValueChange={(v) => { setQuizId(v); setPage(1); }}>
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
              onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
            />
          </div>
        </div>
      }
      actions={
        <Button
          variant="outline"
          className="rounded-full"
          onClick={exportExcel}
          disabled={!rows.length}
        >
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
            <EmptyState
              icon={Inbox}
              title="Chưa có kết quả"
              description="Kết quả sẽ hiện ngay khi thí sinh nộp bài."
            />
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
                <th className="px-4 py-3 font-semibold">Liêm chính</th>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Nộp lúc</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border transition-colors hover:bg-secondary/40"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold">{r.candidate_name}</p>
                    <p className="type-meta">{r.birth_year}</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-muted-foreground">{r.unit}</td>
                  <td className="max-w-[240px] px-4 py-3 text-muted-foreground">{r.quiz_title}</td>
                  <td className="px-4 py-3 font-mono font-bold">
                    {r.score}/{r.total}
                    {r.disqualified && (
                      <span className="ml-2 text-xs font-normal text-destructive">huỷ</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <IntegrityCell sessionId={r.session_id} score={r.integrity_score} />
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {formatSeconds(r.time_seconds)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDateTime(r.submitted_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.disqualified && canEdit ? (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label="Phục hồi bài thi"
                        onClick={() => {
                          setRestoreReason("");
                          setRestoreTarget({ id: r.id, name: r.candidate_name });
                        }}
                      >
                        <RotateCcw className="size-4" />
                      </Button>
                    ) : null}
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

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between px-4">
            <p className="type-meta">
              Trang {page} / {totalPages} (tổng {total} bản ghi)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                <ChevronLeft className="mr-1 size-4" /> Trước
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Sau <ChevronRight className="ml-1 size-4" />
              </Button>
            </div>
          </div>
        )}
      </QueryState>

      <Dialog open={Boolean(restoreTarget)} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Phục hồi bài thi</DialogTitle>
            <DialogDescription>
              Bỏ trạng thái huỷ cho bài thi của {restoreTarget?.name}. Thao tác được ghi vào nhật ký
              hệ thống.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Lý do phục hồi (bắt buộc, tối thiểu 5 ký tự)..."
            value={restoreReason}
            onChange={(e) => setRestoreReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => setRestoreTarget(null)}
            >
              Huỷ
            </Button>
            <Button
              className="rounded-full"
              disabled={restoreReason.trim().length < 5 || restore.isPending}
              onClick={() =>
                restoreTarget &&
                restore.mutate({ resultId: restoreTarget.id, reason: restoreReason.trim() })
              }
            >
              Xác nhận phục hồi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}
