import {
  Archive,
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  Pencil,
  Timer,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { questionImageSrc } from "@/lib/questionImage";
import { DIFFICULTY_LABEL, KIND_LABEL, type Difficulty } from "@/lib/questionKinds";
import { cn } from "@/lib/utils";

import { BulkActionsBar, type BulkHandlers } from "./BulkActionsBar";
import type { QuestionRow } from "./types";

/** Danh sách câu hỏi kèm thao tác hàng loạt, sắp thứ tự và phân trang. */
export function QuestionList({
  paged,
  canEdit,
  quizzes,
  quizId,
  selected,
  allOnPageSelected,
  onToggleOne,
  onTogglePage,
  onClearSelection,
  bulkHandlers,
  bulkRemoving,
  bulkBusy,
  onEdit,
  onRemove,
  onPreview,
  onDuplicate,
  onArchive,
  onMove,
  onSetOrder,
  pageSize,
  page,
  pageCount,
  totalFiltered,
  onPageChange,
}: {
  paged: QuestionRow[];
  canEdit: boolean;
  quizzes: { id: string; title: string }[];
  quizId: string;
  selected: Set<string>;
  allOnPageSelected: boolean;
  onToggleOne: (id: string) => void;
  onTogglePage: () => void;
  onClearSelection: () => void;
  bulkHandlers: BulkHandlers;
  bulkRemoving: boolean;
  bulkBusy: boolean;
  onEdit: (row: QuestionRow) => void;
  onRemove: (row: QuestionRow) => void;
  onPreview: (row: QuestionRow) => void;
  onDuplicate: (row: QuestionRow) => void;
  onArchive: (row: QuestionRow, archived: boolean) => void;
  onMove: (row: QuestionRow, delta: -1 | 1) => void;
  onSetOrder: (row: QuestionRow, value: number) => void;
  pageSize: number;
  page: number;
  pageCount: number;
  totalFiltered: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="space-y-3">
      {canEdit ? (
        <BulkActionsBar
          selectedCount={selected.size}
          allOnPageSelected={allOnPageSelected}
          onTogglePage={onTogglePage}
          onClearSelection={onClearSelection}
          quizzes={quizzes}
          currentQuizId={quizId}
          bulkRemoving={bulkRemoving}
          busy={bulkBusy}
          handlers={bulkHandlers}
        />
      ) : null}

      {paged.map((q, idx) => (
        <div
          key={q.id}
          className={cn("card-elevated p-4", q.is_archived && "opacity-70 ring-1 ring-warning/40")}
        >
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
              <div className="min-w-0">
                <p className="font-semibold leading-relaxed">
                  {(page - 1) * pageSize + idx + 1}. {q.question}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge>{KIND_LABEL[q.kind ?? "single"]}</Badge>
                  <Badge>{DIFFICULTY_LABEL[(q.difficulty ?? "medium") as Difficulty]}</Badge>
                  <Badge>{q.points ?? 1} điểm</Badge>
                  {q.time_limit_seconds ? (
                    <Badge tone="info">
                      <Timer className="size-3" /> {q.time_limit_seconds}s
                    </Badge>
                  ) : null}
                  {q.is_archived ? <Badge tone="warn">Đã lưu trữ</Badge> : null}
                  {(q.tags ?? []).map((t) => (
                    <Badge key={t}>#{t}</Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className={cn("flex shrink-0 flex-wrap justify-end gap-1", !canEdit && "hidden")}>
              {/* Sắp thứ tự: nút Lên/Xuống + ô nhập số thứ tự, lưu theo lô. */}
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Chuyển lên trên"
                  disabled={idx === 0}
                  onClick={() => onMove(q, -1)}
                >
                  <ArrowUp className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Chuyển xuống dưới"
                  disabled={idx === paged.length - 1}
                  onClick={() => onMove(q, 1)}
                >
                  <ArrowDown className="size-4" />
                </Button>
                <Input
                  type="number"
                  min={0}
                  defaultValue={q.order_index ?? 0}
                  aria-label="Số thứ tự"
                  className="h-8 w-16 rounded-full"
                  onBlur={(e) => {
                    const next = Math.max(0, Number(e.target.value) || 0);
                    if (next !== (q.order_index ?? 0)) onSetOrder(q, next);
                  }}
                />
              </div>
              <Button size="icon" variant="ghost" aria-label="Xem trước" onClick={() => onPreview(q)}>
                <Eye className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Tạo bản sao"
                onClick={() => onDuplicate(q)}
              >
                <Copy className="size-4" />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Sửa" onClick={() => onEdit(q)}>
                <Pencil className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label={q.is_archived ? "Đưa ra khỏi lưu trữ" : "Đưa vào lưu trữ"}
                onClick={() => onArchive(q, !q.is_archived)}
              >
                {q.is_archived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Xoá vĩnh viễn"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={() => {
                  if (
                    confirm(
                      "Xoá vĩnh viễn câu hỏi này? Nên dùng \"Đưa vào lưu trữ\" nếu chỉ muốn ngừng sử dụng.",
                    )
                  )
                    onRemove(q);
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

/** Nhãn nhỏ mô tả thuộc tính câu hỏi. */
function Badge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "info" | "warn";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "info" && "bg-primary/10 text-primary",
        tone === "warn" && "bg-warning/15 text-warning",
        tone === "default" && "bg-secondary text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}
