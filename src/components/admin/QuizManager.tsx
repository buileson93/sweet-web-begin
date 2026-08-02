import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarPlus, Copy, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { QuizFormDialog } from "@/components/admin/quizzes/QuizFormDialog";
import { QUIZ_STATUS_LABEL, type QuizRow } from "@/components/admin/quizzes/types";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { purgeQuizImages } from "@/lib/questionImages.functions";
import { duplicateQuiz } from "@/lib/quizAdmin.functions";
import { formatDateTime, quizStatus } from "@/lib/format";
import { cn } from "@/lib/utils";

export function QuizManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuizRow | null>(null);
  const runDuplicate = useServerFn(duplicateQuiz);

  const quizzesQuery = useQuery({
    queryKey: ["admin-quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").order("start_time", { ascending: false });
      if (error) throw error;
      return data as unknown as QuizRow[];
    },
  });
  const quizzes = quizzesQuery.data ?? [];

  // Đếm bằng `head: true` cho từng đề: nếu tải toàn bộ hàng thì PostgREST cắt ở 1000 dòng
  // nên các đề nằm sau sẽ bị báo nhầm là 0 câu.
  const countsQuery = useQuery({
    queryKey: ["question-counts", quizzes.map((q) => q.id).join(",")],
    enabled: quizzes.length > 0,
    queryFn: async () => {
      const pairs = await Promise.all(
        quizzes.map(async (q) => {
          const { count, error } = await supabase
            .from("questions")
            .select("id", { count: "exact", head: true })
            .eq("quiz_id", q.id)
            .eq("is_archived", false);
          if (error) throw error;
          return [q.id, count ?? 0] as const;
        }),
      );
      return Object.fromEntries(pairs) as Record<string, number>;
    },
  });
  const counts = countsQuery.data ?? {};
  // Chưa đếm xong (hoặc đếm lỗi) thì KHÔNG được coi là 0 câu, tránh báo nhầm
  // "Ngân hàng: 0 câu" và khoá nút Xuất bản.
  const countsReady = countsQuery.isSuccess;



  const toggleActive = useMutation({
    mutationFn: async (quiz: QuizRow) => {
      const { error } = await supabase.from("quizzes").update({ is_active: !quiz.is_active }).eq("id", quiz.id);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "quiz",
        entityId: quiz.id,
        entityLabel: quiz.title,
        details: { is_active: !quiz.is_active },
      });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin-quizzes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async (quiz: QuizRow) => {
      const next = quiz.status === "published" ? "closed" : "published";
      const { error } = await supabase.from("quizzes").update({ status: next }).eq("id", quiz.id);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "quiz",
        entityId: quiz.id,
        entityLabel: quiz.title,
        details: { status: next },
      });
      return next;
    },
    onSuccess: (next) => {
      toast.success(next === "published" ? "Đã xuất bản cuộc thi." : "Đã đóng cuộc thi.");
      void qc.invalidateQueries({ queryKey: ["admin-quizzes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clone = useMutation({
    mutationFn: async (quiz: QuizRow) => {
      const copyQuestions = confirm("Sao chép cả ngân hàng câu hỏi (kèm ảnh) sang bản sao?");
      return runDuplicate({ data: { quizId: quiz.id, copyQuestions } });
    },
    onSuccess: (res) => {
      toast.success(`Đã tạo bản sao (${res.copiedQuestions} câu hỏi). Bản sao đang ở trạng thái Nháp.`);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (quiz: QuizRow) => {
      // Câu hỏi bị xoá theo dây chuyền nên phải thu ảnh TRƯỚC khi xoá cuộc thi.
      try {
        await purgeQuizImages({ data: { quizId: quiz.id } });
      } catch {
        toast.warning("Chưa thu hồi được ảnh của cuộc thi; công việc dọn dẹp sẽ xử lý sau.");
      }
      const { error } = await supabase.from("quizzes").delete().eq("id", quiz.id);
      if (error) throw error;
      await logAudit({ action: "delete", entity: "quiz", entityId: quiz.id, entityLabel: quiz.title });
    },
    onSuccess: () => {
      toast.success("Đã xoá cuộc thi.");
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(quiz: QuizRow) {
    setEditing(quiz);
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <AdminSection
        title="Cuộc thi"
        description={quizzesQuery.isLoading ? "Đang tải..." : `${quizzes.length} cuộc thi`}
        actions={
          canEdit ? (
            <Button className="rounded-full" onClick={openCreate}>
              <Plus className="size-4" />
              Tạo cuộc thi
            </Button>
          ) : null
        }
      >
        <QueryState
          isLoading={quizzesQuery.isLoading}
          isError={quizzesQuery.isError}
          error={quizzesQuery.error}
          isFetching={quizzesQuery.isFetching}
          onRetry={() => void quizzesQuery.refetch()}
          isEmpty={quizzes.length === 0}
          skeleton={<ListSkeleton rows={4} height="h-40" />}
          empty={
            <EmptyState
              icon={CalendarPlus}
              title="Chưa có cuộc thi nào"
              description="Tạo cuộc thi đầu tiên rồi thêm câu hỏi vào ngân hàng."
              action={
                canEdit ? (
                  <Button className="rounded-full" onClick={openCreate}>
                    <Plus className="size-4" /> Tạo cuộc thi
                  </Button>
                ) : undefined
              }
            />
          }
        >
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {quizzes.map((quiz) => {
              const st = quizStatus(quiz);
              const bank = countsReady ? (counts[quiz.id] ?? 0) : null;
              const canPublish = bank === null || bank >= quiz.question_count;

              return (
                <div key={quiz.id} className="card-elevated flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="type-h3">{quiz.title}</h3>
                    <Switch
                      checked={quiz.is_active}
                      disabled={!canEdit}
                      onCheckedChange={() => toggleActive.mutate(quiz)}
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span
                      className={cn(
                        "status-pill",
                        quiz.status === "published"
                          ? "bg-success/10 text-success"
                          : quiz.status === "closed"
                            ? "bg-muted text-muted-foreground"
                            : "bg-warning/10 text-warning-foreground",
                      )}
                    >
                      {QUIZ_STATUS_LABEL[quiz.status ?? "draft"] ?? "Nháp"}
                    </span>
                    <StatusPill status={st} />
                    <span className="status-pill bg-secondary text-secondary-foreground">
                      {quiz.question_count} câu · {quiz.duration_minutes} phút
                    </span>
                    <span
                      className={cn(
                        "status-pill",
                        bank < quiz.question_count
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      Ngân hàng: {bank} câu
                    </span>
                  </div>
                  <p className="type-meta mt-3">
                    {formatDateTime(quiz.start_time)} → {formatDateTime(quiz.end_time)}
                  </p>
                  <div className={cn("mt-4 flex flex-wrap gap-2 pt-1", !canEdit && "hidden")}>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(quiz)}>
                      <Pencil className="size-3.5" /> Sửa
                    </Button>
                    <Button
                      size="sm"
                      variant={quiz.status === "published" ? "ghost" : "secondary"}
                      className="rounded-full"
                      disabled={quiz.status !== "published" && !canPublish}
                      title={
                        quiz.status !== "published" && !canPublish
                          ? `Ngân hàng chỉ có ${bank}/${quiz.question_count} câu`
                          : undefined
                      }
                      onClick={() => publish.mutate(quiz)}
                    >
                      <Upload className="size-3.5" /> {quiz.status === "published" ? "Đóng" : "Xuất bản"}
                    </Button>
                    <Button size="sm" variant="ghost" className="rounded-full" onClick={() => clone.mutate(quiz)}>
                      <Copy className="size-3.5" /> Nhân bản
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        if (confirm("Xoá cuộc thi này cùng toàn bộ câu hỏi và kết quả?")) remove.mutate(quiz);
                      }}
                    >
                      <Trash2 className="size-3.5" /> Xoá
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </QueryState>
      </AdminSection>

      <QuizFormDialog open={open} onOpenChange={setOpen} editing={editing} />
    </div>
  );
}
