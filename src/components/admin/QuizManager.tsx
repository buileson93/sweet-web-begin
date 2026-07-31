import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CalendarPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState, StatusPill } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { formatDateTime, fromLocalInputValue, quizStatus, toLocalInputValue } from "@/lib/format";
import { cn } from "@/lib/utils";


type QuizRow = {
  id: string;
  title: string;
  description: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  question_count: number;
  duration_minutes: number;
  shuffle_options: boolean;
  shuffle_questions: boolean;
  pass_score: number;
  room_password: string | null;
  max_attempts: number | null;
  allow_fifty_fifty: boolean;
  allow_skip: boolean;
  streak_bonus: boolean;
  show_question_map: boolean;
  negative_marking: number;
  blueprint: { easy?: number; medium?: number; hard?: number } | null;
};

const emptyForm = {
  title: "",
  description: "",
  start_time: "",
  end_time: "",
  is_active: true,
  question_count: 20,
  duration_minutes: 20,
  shuffle_options: true,
  shuffle_questions: true,
  pass_score: 0,
  room_password: "",
  max_attempts: 0,
  allow_fifty_fifty: false,
  allow_skip: false,
  streak_bonus: true,
  show_question_map: true,
  negative_marking: 0,
  bp_easy: 0,
  bp_medium: 0,
  bp_hard: 0,
};


export function QuizManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuizRow | null>(null);
  const [form, setForm] = useState({ ...emptyForm });

  const quizzesQuery = useQuery({
    queryKey: ["admin-quizzes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("quizzes").select("*").order("start_time", { ascending: false });
      if (error) throw error;
      return data as QuizRow[];
    },
  });
  const quizzes = quizzesQuery.data ?? [];


  const { data: counts = {} } = useQuery({
    queryKey: ["question-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("questions").select("quiz_id");
      if (error) throw error;
      return data.reduce<Record<string, number>>((acc, r) => {
        acc[r.quiz_id] = (acc[r.quiz_id] ?? 0) + 1;
        return acc;
      }, {});
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        start_time: fromLocalInputValue(form.start_time),
        end_time: fromLocalInputValue(form.end_time),
        is_active: form.is_active,
        question_count: Number(form.question_count) || 20,
        duration_minutes: Number(form.duration_minutes) || 20,
        shuffle_options: form.shuffle_options,
        shuffle_questions: form.shuffle_questions,
        pass_score: Number(form.pass_score) || 0,
        room_password: form.room_password.trim() || null,
        max_attempts: Number(form.max_attempts) > 0 ? Number(form.max_attempts) : null,
        allow_fifty_fifty: form.allow_fifty_fifty,
        allow_skip: form.allow_skip,
        streak_bonus: form.streak_bonus,
        show_question_map: form.show_question_map,
        negative_marking: Number(form.negative_marking) || 0,
        blueprint: {
          easy: Number(form.bp_easy) || 0,
          medium: Number(form.bp_medium) || 0,
          hard: Number(form.bp_hard) || 0,
        },
      };

      if (!payload.title) throw new Error("Vui lòng nhập tên cuộc thi.");
      const { error } = editing
        ? await supabase.from("quizzes").update(payload).eq("id", editing.id)
        : await supabase.from("quizzes").insert(payload);
      if (error) throw error;
      await logAudit({
        action: editing ? "update" : "create",
        entity: "quiz",
        entityId: editing?.id ?? null,
        entityLabel: payload.title,
        details: payload,
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật cuộc thi." : "Đã tạo cuộc thi mới.");
      setOpen(false);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

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

  const remove = useMutation({
    mutationFn: async (quiz: QuizRow) => {
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
    setForm({ ...emptyForm });
    setOpen(true);
  }

  function openEdit(quiz: QuizRow) {
    setEditing(quiz);
    setForm({
      title: quiz.title,
      description: quiz.description ?? "",
      start_time: toLocalInputValue(quiz.start_time),
      end_time: toLocalInputValue(quiz.end_time),
      is_active: quiz.is_active,
      question_count: quiz.question_count,
      duration_minutes: quiz.duration_minutes,
      shuffle_options: quiz.shuffle_options,
      shuffle_questions: quiz.shuffle_questions ?? true,
      pass_score: quiz.pass_score ?? 0,
      room_password: quiz.room_password ?? "",
      max_attempts: quiz.max_attempts ?? 0,
      allow_fifty_fifty: quiz.allow_fifty_fifty ?? false,
      allow_skip: quiz.allow_skip ?? false,
      streak_bonus: quiz.streak_bonus ?? true,
      show_question_map: quiz.show_question_map ?? true,
      negative_marking: Number(quiz.negative_marking ?? 0),
      bp_easy: Number(quiz.blueprint?.easy ?? 0),
      bp_medium: Number(quiz.blueprint?.medium ?? 0),
      bp_hard: Number(quiz.blueprint?.hard ?? 0),
    });
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
              const bank = counts[quiz.id] ?? 0;
              return (
                <div key={quiz.id} className="card-elevated flex flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="type-h3">{quiz.title}</h3>
                    <Switch checked={quiz.is_active} disabled={!canEdit} onCheckedChange={() => toggleActive.mutate(quiz)} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
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
                  <div className={cn("mt-4 flex gap-2 pt-1", !canEdit && "hidden")}>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => openEdit(quiz)}>
                      <Pencil className="size-3.5" /> Sửa
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


      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa cuộc thi" : "Tạo cuộc thi"}</DialogTitle>
            <DialogDescription>Thời gian nhập theo giờ Việt Nam (UTC+7).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tên cuộc thi</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mô tả</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Bắt đầu</Label>
                <Input
                  type="datetime-local"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Kết thúc</Label>
                <Input
                  type="datetime-local"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Số câu mỗi lượt thi</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.question_count}
                  onChange={(e) => setForm({ ...form, question_count: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Thời gian làm bài (phút)</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.duration_minutes}
                  onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Điểm đạt (số câu đúng, 0 = mặc định 50%)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.pass_score}
                  onChange={(e) => setForm({ ...form, pass_score: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Số lượt thi tối đa (0 = không giới hạn)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.max_attempts}
                  onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Mật khẩu phòng thi (tuỳ chọn)</Label>
                <Input
                  value={form.room_password}
                  onChange={(e) => setForm({ ...form, room_password: e.target.value })}
                  placeholder="Để trống nếu mở tự do"
                />
              </div>
              <div className="space-y-2">
                <Label>Trừ điểm khi sai (hệ số, 0 = không trừ)</Label>
                <Input
                  type="number"
                  step="0.25"
                  min={0}
                  value={form.negative_marking}
                  onChange={(e) => setForm({ ...form, negative_marking: Number(e.target.value) })}
                />
              </div>
            </div>

            {/* Công thức bốc đề theo độ khó */}
            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">Công thức bốc đề theo độ khó</p>
              <p className="text-xs text-muted-foreground">
                Số câu lấy cho từng mức. Còn thiếu bao nhiêu, hệ thống bốc ngẫu nhiên phần còn lại.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Dễ</Label>
                  <Input type="number" min={0} value={form.bp_easy} onChange={(e) => setForm({ ...form, bp_easy: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Trung bình</Label>
                  <Input type="number" min={0} value={form.bp_medium} onChange={(e) => setForm({ ...form, bp_medium: Number(e.target.value) })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Khó</Label>
                  <Input type="number" min={0} value={form.bp_hard} onChange={(e) => setForm({ ...form, bp_hard: Number(e.target.value) })} />
                </div>
              </div>
            </div>

            {/* Trải nghiệm thi */}
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: "shuffle_questions" as const, title: "Xáo trộn câu hỏi", desc: "Mỗi lượt thi một đề khác nhau." },
                { key: "allow_fifty_fifty" as const, title: "Trợ giúp 50:50", desc: "Tối đa 2 lần mỗi lượt thi." },
                { key: "allow_skip" as const, title: "Cho phép bỏ qua", desc: "Nút bỏ qua nhanh sang câu sau." },
                { key: "streak_bonus" as const, title: "Thưởng chuỗi đúng", desc: "Đúng liên tiếp từ 3 câu được cộng điểm." },
                { key: "show_question_map" as const, title: "Bản đồ câu hỏi", desc: "Hiện lưới số câu để nhảy nhanh." },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3 rounded-xl bg-secondary p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch checked={form[item.key]} onCheckedChange={(v) => setForm({ ...form, [item.key]: v })} />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
              <div>
                <p className="text-sm font-semibold">Xáo trộn phương án</p>
                <p className="text-xs text-muted-foreground">Mỗi thí sinh nhận thứ tự đáp án khác nhau.</p>
              </div>
              <Switch
                checked={form.shuffle_options}
                onCheckedChange={(v) => setForm({ ...form, shuffle_options: v })}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
              <div>
                <p className="text-sm font-semibold">Kích hoạt</p>
                <p className="text-xs text-muted-foreground">Cho phép thí sinh vào thi trong khung giờ.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
