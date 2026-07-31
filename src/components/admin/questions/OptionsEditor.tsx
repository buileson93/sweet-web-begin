import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import { OptionImageButton } from "./OptionImageButton";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import { FieldMessage } from "./FieldMessage";
import type { EditorProps } from "./types";

/**
 * Bộ soạn phương án dùng chung cho câu một đáp án, nhiều đáp án,
 * đúng-sai và sắp xếp thứ tự.
 */
export function OptionsEditor({ form, setForm, errors, warnings, quizId }: EditorProps) {
  const ordering = form.kind === "ordering";

  /** Đổi chỗ hai mục (dùng cho câu sắp xếp). */
  function swap(i: number, j: number) {
    if (j < 0 || j >= form.options.length) return;
    const next = [...form.options];
    [next[i], next[j]] = [next[j], next[i]];
    const nextImg = [...(form.option_images ?? [])];
    [nextImg[i], nextImg[j]] = [nextImg[j], nextImg[i]];
    setForm({ ...form, options: next, option_images: nextImg });
  }

  return (
    <div className="space-y-2">
      <Label>{ordering ? "Các mục theo đúng thứ tự" : "Phương án trả lời"}</Label>
      {ordering ? (
        <p className="type-meta">
          Nhập các mục <strong>THEO ĐÚNG THỨ TỰ</strong> — hệ thống sẽ tự trộn khi thi. Dùng nút mũi
          tên để sắp lại.
        </p>
      ) : null}
      {form.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          {ordering ? (
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary text-sm font-bold">
              {i + 1}
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Đánh dấu phương án ${String.fromCharCode(65 + i)} là đúng`}
              onClick={() =>
                setForm((f) =>
                  f.kind === "multi"
                    ? {
                        ...f,
                        correct_indices: f.correct_indices.includes(i)
                          ? f.correct_indices.filter((x) => x !== i)
                          : [...f.correct_indices, i].sort((a, b) => a - b),
                      }
                    : { ...f, correct_index: i },
                )
              }
              className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-lg border text-sm font-bold transition-colors",
                (
                  form.kind === "multi"
                    ? form.correct_indices.includes(i)
                    : form.correct_index === i
                )
                  ? "border-success bg-success text-success-foreground"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              {String.fromCharCode(65 + i)}
            </button>
          )}
          <Input
            value={o}
            placeholder={ordering ? `Mục ${i + 1}` : `Phương án ${String.fromCharCode(65 + i)}`}
            data-option-index={i}
            onChange={(e) => {
              const next = [...form.options];
              next[i] = e.target.value;
              setForm({ ...form, options: next });
            }}
          />
          {quizId ? (
            <OptionImageButton
              quizId={quizId}
              path={form.option_images?.[i] ?? ""}
              label={ordering ? `Mục ${i + 1}` : `Phương án ${String.fromCharCode(65 + i)}`}
              onChange={(path) => {
                const nextImg = [...(form.option_images ?? [])];
                nextImg[i] = path;
                setForm({ ...form, option_images: nextImg });
              }}
            />
          ) : null}
          {ordering ? (
            <>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Đưa mục lên trên"
                disabled={i === 0}
                onClick={() => swap(i, i - 1)}
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Đưa mục xuống dưới"
                disabled={i === form.options.length - 1}
                onClick={() => swap(i, i + 1)}
              >
                <ArrowDown className="size-4" />
              </Button>
            </>
          ) : null}
          {form.options.length > 2 ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Xoá phương án"
              onClick={() =>
                setForm({
                  ...form,
                  options: form.options.filter((_, j) => j !== i),
                  option_images: (form.option_images ?? []).filter((_, j) => j !== i),
                })
              }
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      <FieldMessage error={errors?.options} warning={warnings?.options} />
      <FieldMessage error={errors?.correct} warning={warnings?.correct} />
      {form.kind !== "true_false" ? (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() =>
            setForm({
              ...form,
              options: [...form.options, ""],
              option_images: [...(form.option_images ?? []), ""],
            })
          }
        >
          <Plus className="size-4" /> {ordering ? "Thêm mục" : "Thêm phương án"}
        </Button>
      ) : null}
    </div>
  );
}

/** Câu một đáp án đúng. */
export const SingleChoiceEditor = OptionsEditor;
/** Câu nhiều đáp án đúng. */
export const MultiChoiceEditor = OptionsEditor;
/** Câu đúng-sai. */
export const TrueFalseEditor = OptionsEditor;
/** Câu sắp xếp thứ tự. */
export const OrderingEditor = OptionsEditor;
