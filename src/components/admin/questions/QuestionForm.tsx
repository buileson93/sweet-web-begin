import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Loader2, RotateCcw, X } from "lucide-react";

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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { questionImageSrc } from "@/lib/questionImage";
import {
  DIFFICULTIES,
  QUESTION_KINDS,
  type Difficulty,
  type QuestionKind,
} from "@/lib/questionKinds";
import { MAX_TIME_LIMIT_SECONDS, hasBlockingErrors, validateQuestionDraft } from "@/lib/questionValidation";

import { FieldMessage } from "./FieldMessage";
import { FillBlankEditor } from "./FillBlankEditor";
import { MatchingEditor } from "./MatchingEditor";
import { MultiChoiceEditor } from "./MultiChoiceEditor";
import { OrderingEditor } from "./OrderingEditor";
import { QuestionLivePreview } from "./QuestionLivePreview";
import { SingleChoiceEditor } from "./SingleChoiceEditor";
import { TrueFalseEditor } from "./TrueFalseEditor";
import type { EditorProps, QuestionFormState } from "./types";

/** Chọn bộ soạn đáp án theo loại câu hỏi. */
function AnswerEditor(props: EditorProps) {
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
  editingId,
  existing,
  form,
  setForm,
  quizId,
  uploadStage,
  uploadInfo,
  onAttachImage,
  onRemoveImage,
  onSave,
  onSaveNext,
  saving,
  draftAvailable,
  onRestoreDraft,
  onDiscardDraft,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: boolean;
  editingId?: string | null;
  existing: { id: string; question: string }[];
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
  quizId: string;
  uploadStage: "idle" | "compressing" | "uploading";
  uploadInfo: string | null;
  onAttachImage: (file: File) => void;
  onRemoveImage: () => void;
  onSave: () => void;
  /** Lưu rồi mở luôn biểu mẫu trống để soạn câu kế (Ctrl/⌘ + Enter). */
  onSaveNext?: () => void;
  saving: boolean;
  draftAvailable: boolean;
  onRestoreDraft: () => void;
  onDiscardDraft: () => void;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const uploading = uploadStage !== "idle";
  const stageLabel = uploadStage === "compressing" ? "Đang nén..." : "Đang tải lên...";

  const validation = useMemo(
    () => validateQuestionDraft(form, existing, editingId ?? null),
    [form, existing, editingId],
  );
  const blocked = hasBlockingErrors(validation);

  // Phím tắt: Ctrl/⌘ + S = lưu, Ctrl/⌘ + Enter = lưu và soạn câu kế.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      const key = e.key.toLowerCase();
      if (key !== "s" && key !== "enter") return;
      e.preventDefault();
      if (saving || blocked) return;
      if (key === "enter" && onSaveNext) onSaveNext();
      else onSave();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, blocked, onSave, onSaveNext]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-[min(1100px,96vw)]"
      >
        <SheetHeader className="px-0">
          <SheetTitle>{editing ? "Sửa câu hỏi" : "Thêm câu hỏi"}</SheetTitle>
          <SheetDescription>
            Chọn phương án đúng bằng nút bên trái. Phím tắt:{" "}
            <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">Ctrl/⌘ + S</kbd>{" "}
            lưu,{" "}
            <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
              Ctrl/⌘ + Enter
            </kbd>{" "}
            lưu và soạn câu kế.
          </SheetDescription>
        </SheetHeader>

        {draftAvailable ? (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
            <RotateCcw className="size-4 text-warning" />
            <span className="font-medium">Có bản nháp chưa lưu. Khôi phục?</span>
            <Button size="sm" className="rounded-full" onClick={onRestoreDraft}>
              Khôi phục
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={onDiscardDraft}>
              Bỏ qua
            </Button>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="min-w-0 space-y-4">
          <div className="space-y-2">
            <Label>Nội dung câu hỏi</Label>
            <Textarea
              rows={3}
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
            />
            <FieldMessage error={validation.errors.question} warning={validation.warnings.question} />
            <p className="type-meta">
              Hỗ trợ Markdown và công thức toán: **đậm**, *nghiêng*, danh sách, bảng, $x^2$ (nội
              dòng) hoặc {"$$\\frac{a}{b}$$"} (khối). Xem trước ở cột bên phải.
            </p>

          </div>
          <div className="space-y-2">
            <Label>Ảnh minh hoạ (không bắt buộc)</Label>
            {questionImageSrc(form.image_url) ? (
              <div className="relative w-fit">
                <img
                  src={questionImageSrc(form.image_url)!}
                  alt={form.image_alt || "Ảnh minh hoạ câu hỏi"}
                  className="max-h-48 rounded-xl border border-border object-contain"
                />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-label="Gỡ ảnh"
                  className="absolute -right-2 -top-2 size-7 rounded-full"
                  onClick={onRemoveImage}
                >
                  <X className="size-4" />
                </Button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  if (uploading) return;
                  const file = Array.from(e.dataTransfer.files).find((f) =>
                    f.type.startsWith("image/"),
                  );
                  if (file) onAttachImage(file);
                }}
                className={`flex flex-col items-start gap-2 rounded-2xl border border-dashed p-4 transition-colors ${
                  dragging ? "border-primary bg-primary/5 ring-2 ring-primary/40" : "border-border"
                }`}
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
                  {uploading ? stageLabel : "Chọn ảnh"}
                </Button>
                <p className="type-meta">
                  Kéo-thả ảnh vào đây, hoặc{" "}
                  <kbd className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px]">
                    Ctrl/⌘ + V
                  </kbd>{" "}
                  để dán ảnh chụp màn hình trực tiếp từ clipboard.
                </p>
              </div>
            )}
            {form.image_url ? (
              <div className="space-y-1.5">
                <Label>Mô tả ảnh (alt)</Label>
                <Input
                  value={form.image_alt}
                  placeholder="Ví dụ: Sơ đồ đường lăn sân bay Đà Nẵng"
                  onChange={(e) => setForm({ ...form, image_alt: e.target.value })}
                />
                <FieldMessage warning={validation.warnings.image_alt} />
                <p className="type-meta">
                  Giúp thí sinh dùng trình đọc màn hình hiểu được nội dung ảnh.
                </p>
              </div>
            ) : null}
            {uploadInfo ? <p className="type-meta">Đã nén: {uploadInfo}</p> : null}
            <p className="type-meta">
              Ảnh được tự động nén về WebP (hoặc JPEG nếu trình duyệt không hỗ trợ), cạnh dài tối đa
              1280px. Tối đa 25 MB mỗi tệp.
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
              <FieldMessage error={validation.errors.points} />
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
            <div className="space-y-2">
              <Label>Giới hạn thời gian riêng (giây)</Label>
              <Input
                type="number"
                min={0}
                max={MAX_TIME_LIMIT_SECONDS}
                placeholder="Để trống = dùng giờ chung"
                value={form.time_limit_seconds}
                onChange={(e) => setForm({ ...form, time_limit_seconds: e.target.value })}
              />
              <p className="type-meta">
                Bỏ trống hoặc 0 = dùng thời gian chung của cuộc thi. Tối đa{" "}
                {MAX_TIME_LIMIT_SECONDS} giây.
              </p>
              <FieldMessage error={validation.errors.time_limit_seconds} />
            </div>
          </div>

          <p className="type-meta">{QUESTION_KINDS.find((k) => k.value === form.kind)?.hint}</p>

          {/* Đáp án theo từng loại */}
          <AnswerEditor
            form={form}
            setForm={setForm}
            errors={validation.errors}
            warnings={validation.warnings}
            quizId={quizId}
          />

          {/* Giải thích riêng cho từng phương án */}
          {form.kind !== "matching" && form.kind !== "fill_blank" ? (
            <div className="space-y-2 rounded-2xl border border-border p-3">
              <Label>Giải thích riêng cho từng phương án (không bắt buộc)</Label>
              <p className="type-meta">
                Thí sinh xem lại sẽ thấy vì sao mỗi phương án đúng hoặc sai.
              </p>
              <div className="space-y-2">
                {form.options.map((opt, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-2 grid size-6 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-extrabold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <Input
                      value={form.option_explanations[i] ?? ""}
                      placeholder={opt.trim() ? `Vì sao “${opt.trim()}”...` : "Giải thích..."}
                      onChange={(e) =>
                        setForm((f) => {
                          const next = f.options.map(
                            (_, j) => (j === i ? e.target.value : (f.option_explanations[j] ?? "")),
                          );
                          return { ...f, option_explanations: next };
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : null}

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
              <p className="type-meta">
                Hỗ trợ Markdown: **đậm**, *nghiêng*, danh sách, bảng và công thức $E=mc^2$.
              </p>
            </div>
          </div>

        </div>

          {/* Cột xem trước trực tiếp */}
          <aside className="min-w-0 lg:sticky lg:top-2 lg:self-start">
            <QuestionLivePreview form={form} />
          </aside>
        </div>
        <SheetFooter className="flex-row justify-end gap-2 px-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          {onSaveNext ? (
            <Button variant="secondary" onClick={onSaveNext} disabled={saving || blocked}>
              Lưu &amp; soạn câu kế
            </Button>
          ) : null}
          <Button onClick={onSave} disabled={saving || blocked}>
            Lưu
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
