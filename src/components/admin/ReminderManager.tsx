import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BellRing, ClipboardCopy, Download, FileSpreadsheet, MailPlus, PartyPopper } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { downloadCsv, downloadExcel, type ExportRow } from "@/lib/export";
import { normalizeKey } from "@/lib/csv";
import { buildContactList, buildReminderMessage, formatDeadline } from "@/lib/reminder";


/** Danh sách nhân viên chưa tham gia một cuộc thi, dùng để nhắc nhở. */
export function ReminderManager() {
  const [quizId, setQuizId] = useState("");
  const [keyword, setKeyword] = useState("");

  const quizzesQuery = useQuery({
    queryKey: ["admin-quiz-titles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, end_time")
        .order("start_time");
      if (error) throw error;
      return data;
    },
  });

  const pendingQuery = useQuery({
    queryKey: ["admin-pending-employees", quizId],
    enabled: Boolean(quizId),
    queryFn: async () => {
      const [{ data: employees, error: empError }, { data: results, error: resError }] = await Promise.all([
        supabase
          .from("employees")
          .select("id, full_name, position, unit_name, phone")
          .eq("is_active", true)
          .order("full_name")
          .limit(2000),
        supabase.from("results").select("employee_id, score, total").eq("quiz_id", quizId).limit(5000),
      ]);

      if (empError) throw empError;
      if (resError) throw resError;
      const joined = new Set((results ?? []).map((r) => r.employee_id).filter(Boolean) as string[]);
      return {
        total: employees?.length ?? 0,
        joined: joined.size,
        pending: (employees ?? []).filter((e) => !joined.has(e.id)),
      };
    },
  });

  const pending = pendingQuery.data?.pending ?? [];
  const rows = useMemo(() => {
    const key = normalizeKey(keyword);
    if (!key) return pending;
    return pending.filter(
      (e) => normalizeKey(e.full_name).includes(key) || normalizeKey(e.unit_name ?? "").includes(key),
    );
  }, [pending, keyword]);

  const quiz = (quizzesQuery.data ?? []).find((q) => q.id === quizId);
  const quizTitle = quiz?.title ?? "";
  const deadline = formatDeadline(quiz?.end_time ?? null);

  function exportRows(): ExportRow[] {
    return rows.map((e, i) => ({
      STT: i + 1,
      "Họ và tên": e.full_name,
      "Chức vụ": e.position ?? "",
      "Đơn vị": e.unit_name ?? "",
      "Điện thoại": e.phone ?? "",
      "Cuộc thi": quizTitle,
      "Hạn chót": deadline,
      "Nội dung nhắc": buildReminderMessage(e, quizTitle, deadline),
      "Trạng thái": "Chưa tham gia",
    }));
  }

  async function handleExport(kind: "csv" | "xlsx") {
    if (rows.length === 0) return toast.error("Không có dữ liệu để tải xuống.");
    const name = `nhac-nho-chua-thi-${new Date().toISOString().slice(0, 10)}.${kind}`;
    if (kind === "csv") downloadCsv(exportRows(), name);
    else await downloadExcel(exportRows(), name, "Chua tham gia");
    await logAudit({
      action: "export",
      entity: "employee",
      entityLabel: `Danh sách nhắc nhở (${rows.length} người)`,
      details: { quizId, count: rows.length },
    });
    toast.success(`Đã tải xuống danh sách ${rows.length} nhân viên.`);
  }

  /** Sao chép danh sách liên hệ để dán thẳng vào Zalo nhóm hoặc Outlook. */
  async function handleCopy() {
    if (rows.length === 0) return toast.error("Không có dữ liệu để sao chép.");
    const text = buildContactList(rows);
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`Đã sao chép ${rows.length} liên hệ vào bộ nhớ tạm.`);
    } catch {
      toast.error("Trình duyệt chặn sao chép — hãy dùng nút tải CSV.");
    }
  }


  return (
    <AdminSection
      title="Nhắc nhở tham gia"
      description={
        quizId && pendingQuery.data
          ? `${pendingQuery.data.joined}/${pendingQuery.data.total} nhân viên đã dự thi · còn ${pendingQuery.data.pending.length} người chưa tham gia`
          : "Chọn một cuộc thi để đối chiếu danh sách nhân viên với kết quả đã nộp."
      }
      toolbar={
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={quizId} onValueChange={setQuizId}>
            <SelectTrigger className="rounded-full sm:w-72">
              <SelectValue placeholder="Chọn cuộc thi" />
            </SelectTrigger>
            <SelectContent>
              {(quizzesQuery.data ?? []).map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Lọc theo tên hoặc đơn vị..."
            className="rounded-full sm:w-64"
          />
        </div>
      }
      actions={
        <>
          <Button variant="outline" className="rounded-full" disabled={rows.length === 0} onClick={() => void handleExport("csv")}>
            <Download className="size-4" /> CSV
          </Button>
          <Button variant="outline" className="rounded-full" disabled={rows.length === 0} onClick={() => void handleExport("xlsx")}>
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
        </>
      }
    >
      {!quizId ? (
        <EmptyState
          icon={BellRing}
          title="Chưa chọn cuộc thi"
          description="Chọn cuộc thi ở phía trên để xem ai chưa tham gia và xuất danh sách nhắc nhở."
        />
      ) : (
        <QueryState
          isLoading={pendingQuery.isLoading}
          isError={pendingQuery.isError}
          error={pendingQuery.error}
          isFetching={pendingQuery.isFetching}
          onRetry={() => void pendingQuery.refetch()}
          isEmpty={rows.length === 0}
          skeleton={<ListSkeleton rows={6} height="h-14" />}
          empty={
            <EmptyState
              icon={PartyPopper}
              title={keyword ? "Không có nhân viên phù hợp" : "Tất cả nhân viên đã tham gia"}
              description={keyword ? "Thử từ khoá khác." : "Không còn ai cần nhắc nhở cho cuộc thi này."}
            />
          }
        >
          <div className="card-elevated divide-y divide-border overflow-hidden">
            {rows.map((e, i) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{e.full_name}</p>
                  <p className="type-meta truncate">
                    {[e.position, e.unit_name].filter(Boolean).join(" · ") || "Chưa cập nhật đơn vị"}
                  </p>
                </div>
                <span className="status-pill bg-warning/15 text-warning-foreground">Chưa thi</span>
              </div>
            ))}
          </div>
        </QueryState>
      )}
    </AdminSection>
  );
}
