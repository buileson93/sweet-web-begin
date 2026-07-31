import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { QuizAudienceTab } from "@/components/admin/quizzes/QuizAudienceTab";
import { QuizHealthPanel } from "@/components/admin/quizzes/QuizHealthPanel";
import { QuizPreviewTab } from "@/components/admin/quizzes/QuizPreviewTab";
import { TagBlueprintEditor } from "@/components/admin/quizzes/TagBlueprintEditor";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/format";
import { getQuizPoolStats } from "@/lib/quizAdmin.functions";
import { emptyPool } from "@/lib/quizHealth";
import type { QuizRow } from "@/components/admin/quizzes/types";

const emptyForm = {
  title: "",
  description: "",
  intro_markdown: "",
  start_time: "",
  end_time: "",
  is_active: true,
  status: "draft" as "draft" | "published" | "closed",
  question_count: 20,
  duration_minutes: 20,
  shuffle_options: true,
  shuffle_questions: true,
  pass_percent: 50,
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
  bp_tags: {} as Record<string, number>,
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: QuizRow | null;
};

export function QuizFormDialog({ open, onOpenChange, editing }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ ...emptyForm });
  const [audience, setAudience] = useState<string[]>([]);
  const [tab, setTab] = useState("info");
  const runPoolStats = useServerFn(getQuizPoolStats);

  useEffect(() => {
    if (!open) return;
    setTab("info");
    if (!editing) {
      setForm({ ...emptyForm });
      setAudience([]);
      return;
    }
    setForm({
      title: editing.title,
      description: editing.description ?? "",
      intro_markdown: editing.intro_markdown ?? "",
      start_time: toLocalInputValue(editing.start_time),
      end_time: toLocalInputValue(editing.end_time),
      is_active: editing.is_active,
      status: (editing.status as typeof emptyForm.status) ?? "draft",
      question_count: editing.question_count,
      duration_minutes: editing.duration_minutes,
      shuffle_options: editing.shuffle_options,
      shuffle_questions: editing.shuffle_questions ?? true,
      pass_percent: editing.pass_percent ?? 50,
      room_password: editing.room_password ?? "",
      max_attempts: editing.max_attempts ?? 0,
      allow_fifty_fifty: editing.allow_fifty_fifty ?? false,
      allow_skip: editing.allow_skip ?? false,
      streak_bonus: editing.streak_bonus ?? true,
      show_question_map: editing.show_question_map ?? true,
      negative_marking: Number(editing.negative_marking ?? 0),
      bp_easy: Number(editing.blueprint?.easy ?? 0),
      bp_medium: Number(editing.blueprint?.medium ?? 0),
      bp_hard: Number(editing.blueprint?.hard ?? 0),
      bp_tags: (editing.blueprint?.tags ?? {}) as Record<string, number>,
    });
  }, [open, editing]);

  const unitsQuery = useQuery({
    queryKey: ["units", "audience"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("id, name").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const audienceQuery = useQuery({
    queryKey: ["quiz-audiences", editing?.id],
    enabled: open && Boolean(editing?.id),
    queryFn: async () => {
      const { data, error } = await supabase.from("quiz_audiences").select("unit_id").eq("quiz_id", editing!.id);
      if (error) throw error;
      return data.map((r) => r.unit_id);
    },
  });

  useEffect(() => {
    if (audienceQuery.data) setAudience(audienceQuery.data);
  }, [audienceQuery.data]);

  const poolQuery = useQuery({
    queryKey: ["quiz-pool-stats", editing?.id],
    enabled: open && Boolean(editing?.id),
    queryFn: () => runPoolStats({ data: { quizId: editing!.id } }),
  });
  const pool = poolQuery.data ?? emptyPool();

  const attemptsQuery = useQuery({
    queryKey: ["quiz-attempts-count", editing?.id],
    enabled: open && Boolean(editing?.id),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("results")
        .select("id", { count: "exact", head: true })
        .eq("quiz_id", editing!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const attempts = attemptsQuery.data ?? 0;

  const blueprint = useMemo(
    () => ({
      easy: Number(form.bp_easy) || 0,
      medium: Number(form.bp_medium) || 0,
      hard: Number(form.bp_hard) || 0,
      tags: form.bp_tags,
    }),
    [form.bp_easy, form.bp_medium, form.bp_hard, form.bp_tags],
  );

  const blockPublish = pool.total < (Number(form.question_count) || 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        intro_markdown: form.intro_markdown.trim(),
        start_time: fromLocalInputValue(form.start_time),
        end_time: fromLocalInputValue(form.end_time),
        is_active: form.is_active,
        status: form.status,
        question_count: Number(form.question_count) || 20,
        duration_minutes: Number(form.duration_minutes) || 20,
        shuffle_options: form.shuffle_options,
        shuffle_questions: form.shuffle_questions,
        pass_percent: Math.min(100, Math.max(0, Number(form.pass_percent) || 0)),
        room_password: form.room_password.trim() || null,
        max_attempts: Number(form.max_attempts) > 0 ? Number(form.max_attempts) : null,
        allow_fifty_fifty: form.allow_fifty_fifty,
        allow_skip: form.allow_skip,
        streak_bonus: form.streak_bonus,
        show_question_map: form.show_question_map,
        negative_marking: Number(form.negative_marking) || 0,
        blueprint,
      };

      if (!payload.title) throw new Error("Vui lòng nhập tên cuộc thi.");
      if (payload.status === "published" && blockPublish) {
        throw new Error("Ngân hàng câu hỏi chưa đủ — không thể xuất bản cuộc thi.");
      }

      let quizId = editing?.id ?? "";
      if (editing) {
        const { error } = await supabase.from("quizzes").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("quizzes").insert(payload).select("id").single();
        if (error) throw error;
        quizId = data.id;
      }

      // Đồng bộ đối tượng dự thi
      const current = audienceQuery.data ?? [];
      const removed = current.filter((id) => !audience.includes(id));
      const added = audience.filter((id) => !current.includes(id));
      if (removed.length) {
        const { error } = await supabase
          .from("quiz_audiences")
          .delete()
          .eq("quiz_id", quizId)
          .in("unit_id", removed);
        if (error) throw error;
      }
      if (added.length) {
        const { error } = await supabase
          .from("quiz_audiences")
          .insert(added.map((unit_id) => ({ quiz_id: quizId, unit_id })));
        if (error) throw error;
      }

      await logAudit({
        action: editing ? "update" : "create",
        entity: "quiz",
        entityId: quizId,
        entityLabel: payload.title,
        details: { ...payload, audiences: audience.length },
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Đã cập nhật cuộc thi." : "Đã tạo cuộc thi mới.");
      onOpenChange(false);
      void qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSave() {
    if (editing && attempts > 0 && editing.question_count !== Number(form.question_count)) {
      const ok = confirm(
        `Đã có ${attempts} lượt thi — thay đổi số câu sẽ khiến kết quả cũ và mới không so sánh được. Vẫn tiếp tục?`,
      );
      if (!ok) return;
    }
    save.mutate();
  }

  const tagSuggestions = Object.keys(pool.tags).sort();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa cuộc thi" : "Tạo cuộc thi"}</DialogTitle>
          <DialogDescription>Thời gian nhập theo giờ Việt Nam (UTC+7).</DialogDescription>
        </DialogHeader>

        {editing && attempts > 0 && (
          <div className="flex gap-2 rounded-xl bg-warning/10 p-3 text-xs text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>
              Cuộc thi đã có <strong>{attempts}</strong> lượt thi. Thay đổi cấu hình (nhất là số câu, thời lượng, điểm
              đạt) sẽ khiến kết quả cũ và mới không so sánh được.
            </span>
          </div>
        )}

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="info">Thông tin</TabsTrigger>
            <TabsTrigger value="paper">Đề thi</TabsTrigger>
            <TabsTrigger value="rules">Luật chơi</TabsTrigger>
            <TabsTrigger value="audience">Đối tượng</TabsTrigger>
            <TabsTrigger value="preview">Xem trước</TabsTrigger>
          </TabsList>

          {/* ---------- Thông tin ---------- */}
          <TabsContent value="info" className="space-y-4">
            <div className="space-y-2">
              <Label>Tên cuộc thi</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Mô tả ngắn</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Hướng dẫn / nội quy riêng</Label>
              <Textarea
                rows={5}
                value={form.intro_markdown}
                onChange={(e) => setForm({ ...form, intro_markdown: e.target.value })}
                placeholder="Hiển thị trước khi thí sinh bấm bắt đầu, kèm ô cam kết làm bài trung thực."
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
            </div>

            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">Trạng thái soạn thảo</p>
              <p className="text-xs text-muted-foreground">
                Cuộc thi ở trạng thái <strong>Nháp</strong> không hiện ở trang chủ và không cho bắt đầu thi.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(
                  [
                    { value: "draft", label: "Nháp" },
                    { value: "published", label: "Đã xuất bản" },
                    { value: "closed", label: "Đã đóng" },
                  ] as const
                ).map((s) => (
                  <Button
                    key={s.value}
                    size="sm"
                    variant={form.status === s.value ? "default" : "outline"}
                    className="rounded-full"
                    disabled={s.value === "published" && blockPublish}
                    onClick={() => setForm({ ...form, status: s.value })}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              {blockPublish && (
                <p className="mt-2 text-xs text-destructive">
                  Chưa thể xuất bản: ngân hàng có {pool.total} câu, cần {form.question_count} câu.
                </p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl bg-secondary p-3">
              <div>
                <p className="text-sm font-semibold">Kích hoạt</p>
                <p className="text-xs text-muted-foreground">Cho phép thí sinh vào thi trong khung giờ.</p>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            </div>
          </TabsContent>

          {/* ---------- Đề thi ---------- */}
          <TabsContent value="paper" className="space-y-4">
            <QuizHealthPanel
              pool={pool}
              questionCount={Number(form.question_count) || 0}
              blueprint={blueprint}
              loading={poolQuery.isFetching}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Số câu mỗi lượt thi</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.question_count}
                  onChange={(e) => setForm({ ...form, question_count: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">(kho hiện có {pool.total} câu)</p>
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
            </div>

            <div className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold">Công thức bốc đề theo độ khó</p>
              <p className="text-xs text-muted-foreground">
                Số câu lấy cho từng mức. Còn thiếu bao nhiêu, hệ thống bốc ngẫu nhiên phần còn lại.
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Dễ (kho {pool.easy})</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.bp_easy}
                    onChange={(e) => setForm({ ...form, bp_easy: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Trung bình (kho {pool.medium})</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.bp_medium}
                    onChange={(e) => setForm({ ...form, bp_medium: Number(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Khó (kho {pool.hard})</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.bp_hard}
                    onChange={(e) => setForm({ ...form, bp_hard: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>

            <TagBlueprintEditor
              value={form.bp_tags}
              onChange={(next) => setForm({ ...form, bp_tags: next })}
              suggestions={tagSuggestions}
            />
          </TabsContent>

          {/* ---------- Luật chơi ---------- */}
          <TabsContent value="rules" className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Điểm đạt (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={5}
                  value={form.pass_percent}
                  onChange={(e) => setForm({ ...form, pass_percent: Number(e.target.value) })}
                />
                <p className="text-xs text-muted-foreground">Ví dụ 50 = phải đúng từ 50% số câu trở lên.</p>
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
                <p className="text-xs text-muted-foreground">
                  Ví dụ: 0.25 = sai một câu 1 điểm bị trừ 0,25 điểm.
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {[
                { key: "shuffle_questions" as const, title: "Xáo trộn câu hỏi", desc: "Mỗi lượt thi một đề khác nhau." },
                { key: "shuffle_options" as const, title: "Xáo trộn phương án", desc: "Thứ tự đáp án khác nhau." },
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
                  <Switch
                    checked={form[item.key]}
                    onCheckedChange={(v) => setForm({ ...form, [item.key]: v })}
                  />
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ---------- Đối tượng ---------- */}
          <TabsContent value="audience">
            <QuizAudienceTab
              quizId={editing?.id ?? null}
              units={unitsQuery.data ?? []}
              selected={audience}
              onChange={setAudience}
            />
          </TabsContent>

          {/* ---------- Xem trước ---------- */}
          <TabsContent value="preview">
            <QuizPreviewTab quizId={editing?.id ?? null} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
