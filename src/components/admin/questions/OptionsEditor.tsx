import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

import type { EditorProps } from "./types";

/**
 * Bộ soạn phương án dùng chung cho câu một đáp án, nhiều đáp án,
 * đúng-sai và sắp xếp thứ tự (hành vi giữ nguyên như bản gốc).
 */
export function OptionsEditor({ form, setForm }: EditorProps) {
  return (
    <div className="space-y-2">
      <Label>{form.kind === "ordering" ? "Các mục theo đúng thứ tự" : "Phương án trả lời"}</Label>
      {form.options.map((o, i) => (
        <div key={i} className="flex items-center gap-2">
          {form.kind === "ordering" ? (
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
            placeholder={
              form.kind === "ordering" ? `Mục ${i + 1}` : `Phương án ${String.fromCharCode(65 + i)}`
            }
            onChange={(e) => {
              const next = [...form.options];
              next[i] = e.target.value;
              setForm({ ...form, options: next });
            }}
          />
          {form.options.length > 2 ? (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Xoá phương án"
              onClick={() => setForm({ ...form, options: form.options.filter((_, j) => j !== i) })}
            >
              <X className="size-4" />
            </Button>
          ) : null}
        </div>
      ))}
      {form.kind !== "true_false" ? (
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setForm({ ...form, options: [...form.options, ""] })}
        >
          <Plus className="size-4" /> Thêm phương án
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
