import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { questionImageSrc } from "@/lib/questionImage";
import {
  DIFFICULTIES,
  QUESTION_KINDS,
  type Difficulty,
  type QuestionKind,
} from "@/lib/questionKinds";

import { FillBlankEditor } from "./FillBlankEditor";
import { MatchingEditor } from "./MatchingEditor";
import { MultiChoiceEditor } from "./MultiChoiceEditor";
import { OrderingEditor } from "./OrderingEditor";
import { SingleChoiceEditor } from "./SingleChoiceEditor";
import { TrueFalseEditor } from "./TrueFalseEditor";
import type { QuestionFormState } from "./types";

/** Chọn bộ soạn đáp án theo loại câu hỏi. */
function AnswerEditor(props: {
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
}) {
  switch (props.form.kind) {
    case "fill_blank":
      return <FillBlankEditor {...props} />;
    case "matching":
      return <MatchingEditor {...props} />;
    case "multi":
      return <MultiChoiceEditor {...props} />;
    case "ordering":
      return <OrderingEditor {...props} />;
    case "true_false":
      return <TrueFalseEditor {...props} />;
    default:
      return <SingleChoiceEditor {...props} />;
  }
}

/** Hộp thoại soạn / sửa câu hỏi. */
export function QuestionForm({
  open,
  onOpenChange,
  editing,
  form,
  setForm,
  uploading,
  onAttachImage,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
  uploading: boolean;
  onAttachImage: (file: File) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const imageRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa câu hỏi" : "Thêm câu hỏi"}</DialogTitle>
          <DialogDescription>Chọn phương án đúng bằng nút bên trái.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nội dung câu hỏi</Label>
            <Textarea
              rows={3}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Ảnh minh hoạ (không bắt buộc)</Label>
            {questionImageSrc(form.image_url) ? (
              <div className="relative w-fit">
                <img
                  src={questionImageSrc(form.image_url)!}
                  alt="Ảnh minh hoạ câu hỏi"
                  className="max-h-48 rounded-xl border border-border object-contain"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Gỡ ảnh"
                  className="absolute -right-2 -top-2 size-7 rounded-full"
                  onClick={() => setForm((f) => ({ ...f, image_url: null }))}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div
                onPaste={(e) => {
                  const item = Array.from(e.clipboardData.items).find((i) =>
                    i.type.startsWith("image/"),
                  );
                  const file = item?.getAsFile();
                  if (!file) return;
                  e.preventDefault();
                  onAttachImage(file);
                }}
                className="flex flex-col items-start gap-2 rounded-2xl border border-dashed border-border p-4"
              >
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  disabled={uploading}
                  onClick={() => imageRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <ImagePlus className="size-4" />
                  )}
                  {uploading ? "Đang nén và tải lên..." : "Chọn ảnh"}
                </Button>
                <p className="type-meta">
                  Hoặc{" "}
                  <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    Ctrl/⌘ + V
                  </kbd>{" "}
                  để dán ảnh chụp màn hình trực tiếp từ clipboard.
                </p>
              </div>
            )}
            <p className="type-meta">
              Ảnh được tự động nén về WebP, cạnh dài tối đa 1280px để tiết kiệm dung lượng.
            </p>
            <input
              ref={imageRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onAttachImage(file);
              }}
            />
          </div>
          {/* Thuộc tính câu hỏi */}
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Loại câu hỏi</Label>
              <Select
                value={form.kind}
                onValueChange={(v) => {
                  const kind = v as QuestionKind;
                  setForm((f) => ({
                    ...f,
                    kind,
                    options:
                      kind === "true_false"
                        ? ["Đúng", "Sai"]
                        : f.options.length >= 2
                          ? f.options
                          : ["", "", "", ""],
                    correct_index: 0,
                    correct_indices: [],
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_KINDS.map((k) => (
                    <SelectItem key={k.value} value={k.value}>
                      {k.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Độ khó</Label>
              <Select
                value={form.difficulty}
                onValueChange={(v) => setForm({ ...form, difficulty: v as Difficulty })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Điểm</Label>
              <Input
                type="number"
                min={1}
                value={form.points}
                onChange={(e) => setForm({ ...form, points: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Số thứ tự</Label>
              <Input
                type="number"
                min={0}
                value={form.order_index}
                onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) })}
              />
              <p className="type-meta">
                Dùng khi cuộc thi tắt &quot;Xáo trộn câu hỏi&quot;: số nhỏ hiện trước.
              </p>
            </div>
          </div>

          <p className="type-meta">{QUESTION_KINDS.find((k) => k.value === form.kind)?.hint}</p>

          {/* Đáp án theo từng loại */}
          <AnswerEditor form={form} setForm={setForm} />

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Thẻ chủ đề (cách nhau bằng dấu phẩy)</Label>
              <Input
                value={form.tags}
                placeholder="an toàn bay, khí tượng"
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Giải thích đáp án (hiện khi xem lại)</Label>
              <Textarea
                rows={2}
                value={form.explanation}
                onChange={(e) => setForm({ ...form, explanation: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button onClick={onSave} disabled={saving}>
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
