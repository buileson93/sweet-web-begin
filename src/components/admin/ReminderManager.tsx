import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertCircle, BellRing, CheckCircle2, ClipboardCopy, Download, MailPlus, PartyPopper, Timer } from "lucide-react";
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
import { getDetailedParticipation } from "@/lib/adminStats.functions";


/** Danh sách nhân viên chưa tham gia một cuộc thi, dùng để nhắc nhở. */
export function ReminderManager() {
  const [quizId, setQuizId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "passed" | "failed" | "pending" | "none">("none");

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

  const runGetDetailed = useServerFn(getDetailedParticipation);

  const pendingQuery = useQuery({
    queryKey: ["admin-detailed-participation", quizId],
    enabled: Boolean(quizId),
    queryFn: () => runGetDetailed({ data: { quizId } }),
  });

  const allEmployees = pendingQuery.data ?? [];
  
  const stats = useMemo(() => {
    const counts = { total: allEmployees.length, passed: 0, failed: 0, pending: 0, none: 0 };
    allEmployees.forEach(e => {
      counts[e.status]++;
    });
    return counts;
  }, [allEmployees]);

  const rows = useMemo(() => {
    const key = normalizeKey(keyword);
    return allEmployees.filter(e => {
      const matchKeyword = !key || normalizeKey(e.fullName).includes(key) || normalizeKey(e.unit ?? "").includes(key);
      const matchStatus = filterStatus === "all" || e.status === filterStatus;
      return matchKeyword && matchStatus;
    });
  }, [allEmployees, keyword, filterStatus]);

  const quiz = (quizzesQuery.data ?? []).find((q) => q.id === quizId);
  const quizTitle = quiz?.title ?? "";
  const deadline = formatDeadline(quiz?.end_time ?? null);

  function exportRows(): ExportRow[] {
    return rows.map((e, i) => ({
      STT: i + 1,
      "Họ và tên": e.fullName,
      "Chức vụ": e.position ?? "",
      "Đơn vị": e.unit ?? "",
      "Điện thoại": e.phone ?? "",
      "Cuộc thi": quizTitle,
      "Hạn chót": deadline,
      "Nội dung nhắc": buildReminderMessage({ full_name: e.fullName }, quizTitle, deadline),
      "Trạng thái": e.status === "passed" ? "Đã đạt" : e.status === "failed" ? "Không đạt" : e.status === "pending" ? "Đang thi" : "Chưa tham gia",
      "Lượt nộp": e.submitted,
      "Điểm cao nhất": e.bestScore ?? ""
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
    const text = buildContactList(rows.map(r => ({ full_name: r.fullName, phone: r.phone })));
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
          ? `Đã đạt: ${stats.passed} · Không đạt (<50%): ${stats.failed} · Đang thi/Chưa nộp: ${stats.pending} · Chưa tham gia: ${stats.none}`
          : "Chọn một cuộc thi để xem chi tiết tiến độ dự thi của toàn bộ nhân viên."
      }
      toolbar={
        <div className="flex flex-col gap-2 lg:flex-row">
          <Select value={quizId} onValueChange={setQuizId}>
            <SelectTrigger className="rounded-full lg:w-72">
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
          <div className="flex gap-2">
            <Select value={filterStatus} onValueChange={(v: any) => setFilterStatus(v)}>
              <SelectTrigger className="rounded-full w-40">
                <SelectValue placeholder="Trạng thái" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tất cả ({stats.total})</SelectItem>
                <SelectItem value="none">Chưa thi ({stats.none})</SelectItem>
                <SelectItem value="failed">Không đạt ({stats.failed})</SelectItem>
                <SelectItem value="passed">Đã đạt ({stats.passed})</SelectItem>
                <SelectItem value="pending">Đang thi ({stats.pending})</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Lọc tên, đơn vị..."
              className="rounded-full w-48"
            />
          </div>
        </div>
      }
      actions={
        <>
          <Button className="rounded-full" disabled={rows.length === 0} onClick={() => void handleCopy()}>
            <ClipboardCopy className="size-4" /> Sao chép liên hệ
          </Button>
          <Button variant="outline" className="rounded-full" disabled={rows.length === 0} onClick={() => void handleExport("xlsx")} title="Excel kèm sẵn nội dung nhắc để trộn thư">
            <MailPlus className="size-4" /> Trộn thư
          </Button>
          <Button variant="outline" className="rounded-full" disabled={rows.length === 0} onClick={() => void handleExport("csv")}>
            <Download className="size-4" /> CSV
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
              <div key={e.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                <span className="w-8 shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold">{e.fullName}</p>
                    {e.bestScore && <span className="text-xs font-mono text-muted-foreground">({e.bestScore})</span>}
                  </div>
                  <p className="type-meta truncate">
                    {[e.position, e.unit, e.phone].filter(Boolean).join(" · ") || "Chưa cập nhật đơn vị"}
                  </p>
                </div>
                {e.status === "passed" && (
                  <span className="status-pill bg-success/15 text-success-foreground inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3" /> Đạt
                  </span>
                )}
                {e.status === "failed" && (
                  <span className="status-pill bg-destructive/15 text-destructive-foreground inline-flex items-center gap-1">
                    <AlertCircle className="size-3" /> {"<50%"}
                  </span>
                )}
                {e.status === "pending" && (
                  <span className="status-pill bg-info/15 text-info-foreground inline-flex items-center gap-1">
                    <Timer className="size-3" /> Đang thi
                  </span>
                )}
                {e.status === "none" && (
                  <span className="status-pill bg-warning/15 text-warning-foreground">Chưa thi</span>
                )}
              </div>
            ))}
          </div>
        </QueryState>
      )}
    </AdminSection>
  );
}
