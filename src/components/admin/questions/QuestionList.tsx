import { Loader2, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { questionImageSrc } from "@/lib/questionImage";
import { DIFFICULTIES, type Difficulty } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

import type { QuestionRow } from "./types";

/** Danh sách câu hỏi kèm thao tác hàng loạt và phân trang. */
export function QuestionList({
  paged,
  canEdit,
  selected,
  allOnPageSelected,
  onToggleOne,
  onTogglePage,
  onClearSelection,
  onBulkDifficulty,
  onBulkRemove,
  bulkRemoving,
  onEdit,
  onRemove,
  pageSize,
  page,
  pageCount,
  totalFiltered,
  onPageChange,
}: {
  paged: QuestionRow[];
  canEdit: boolean;
  selected: Set<string>;
  allOnPageSelected: boolean;
  onToggleOne: (id: string) => void;
  onTogglePage: () => void;
  onClearSelection: () => void;
  onBulkDifficulty: (value: Difficulty) => void;
  onBulkRemove: () => void;
  bulkRemoving: boolean;
  onEdit: (row: QuestionRow) => void;
  onRemove: (row: QuestionRow) => void;
  pageSize: number;
  page: number;
  pageCount: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-3">
      {/* Thanh chọn nhiều + thao tác hàng loạt */}
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <Checkbox
              checked={allOnPageSelected}
              onCheckedChange={onTogglePage}
              aria-label="Chọn cả trang"
            />
            Chọn cả trang
          </label>
          {selected.size > 0 ? (
            <>
              <span className="type-meta">Đã chọn {selected.size} câu</span>
              <Select onValueChange={(v) => onBulkDifficulty(v as Difficulty)}>
                <SelectTrigger className="h-8 w-40 rounded-full">
                  <SelectValue placeholder="Đổi độ khó…" />
                </SelectTrigger>
                <SelectContent>
                  {DIFFICULTIES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={bulkRemoving}
                onClick={() => {
                  if (confirm(`Xoá ${selected.size} câu hỏi đã chọn?`)) onBulkRemove();
                }}
              >
                {bulkRemoving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                Xoá đã chọn
              </Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={onClearSelection}>
                Bỏ chọn
              </Button>
            </>
          ) : (
            <span className="type-meta">Tích chọn để xoá hoặc đổi độ khó hàng loạt.</span>
          )}
        </div>
      ) : null}

      {paged.map((q, idx) => (
        <div key={q.id} className="card-elevated p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              {canEdit ? (
                <Checkbox
                  className="mt-1"
                  checked={selected.has(q.id)}
                  onCheckedChange={() => onToggleOne(q.id)}
                  aria-label={`Chọn câu ${(page - 1) * pageSize + idx + 1}`}
                />
              ) : null}
              <p className="font-semibold leading-relaxed">
                {(page - 1) * pageSize + idx + 1}. {q.question}
              </p>
            </div>
            <div className={cn("flex shrink-0 gap-1", !canEdit && "hidden")}>
              <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => onEdit(q)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Xoá"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (confirm("Xoá câu hỏi này?")) onRemove(q);
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          {questionImageSrc(q.image_url) ? (
            <img
              src={questionImageSrc(q.image_url)!}
              alt={`Ảnh minh hoạ câu ${idx + 1}`}
              loading="lazy"
              className="mt-3 max-h-40 rounded-xl border border-border object-contain"
            />
          ) : null}
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((o, i) => (
              <li
                key={i}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm",
                  i === q.correct_index
                    ? "border-success/50 bg-success/10 text-success"
                    : "border-border text-muted-foreground",
                )}
              >
                <span className="font-semibold">{String.fromCharCode(65 + i)}. </span>
                {o}
              </li>
            ))}
          </ul>
        </div>
      ))}

      {pageCount > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
          <span className="type-meta">
            Trang {page} / {pageCount} — {totalFiltered} câu hỏi
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Trang trước
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Trang sau
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
