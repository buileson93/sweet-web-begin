import { useState } from "react";
import { Archive, ArchiveRestore, Loader2, Tags, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTIES, type Difficulty } from "@/lib/questionKinds";

export type BulkHandlers = {
  onBulkDifficulty: (value: Difficulty) => void;
  onBulkPoints: (value: number) => void;
  onBulkTags: (tags: string, mode: "add" | "replace") => void;
  onBulkArchive: (archived: boolean) => void;
  onBulkMoveQuiz: (quizId: string) => void;
  onBulkRemove: () => void;
};

/** Bảng điều khiển hàng loạt cho các câu hỏi đang được chọn. */
export function BulkActionsBar({
  selectedCount,
  allOnPageSelected,
  onTogglePage,
  onClearSelection,
  quizzes,
  currentQuizId,
  bulkRemoving,
  busy,
  handlers,
}: {
  selectedCount: number;
  allOnPageSelected: boolean;
  onTogglePage: () => void;
  onClearSelection: () => void;
  quizzes: { id: string; title: string }[];
  currentQuizId: string;
  bulkRemoving: boolean;
  busy: boolean;
  handlers: BulkHandlers;
}) {
  const [points, setPoints] = useState("");
  const [tags, setTags] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-secondary/40 px-4 py-2.5">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Checkbox
          checked={allOnPageSelected}
          onCheckedChange={onTogglePage}
          aria-label="Chọn cả trang"
        />
        Chọn cả trang
      </label>

      {selectedCount === 0 ? (
        <span className="type-meta">
          Tích chọn để đổi độ khó, gán thẻ, đổi điểm, lưu trữ hoặc chuyển cuộc thi hàng loạt.
        </span>
      ) : (
        <>
          <span className="type-meta">Đã chọn {selectedCount} câu</span>

          <Select onValueChange={(v) => handlers.onBulkDifficulty(v as Difficulty)}>
            <SelectTrigger className="h-8 w-36 rounded-full">
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

          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={1}
              value={points}
              placeholder="Điểm"
              aria-label="Điểm áp dụng hàng loạt"
              onChange={(e) => setPoints(e.target.value)}
              className="h-8 w-20 rounded-full"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={busy || !(Number(points) >= 1)}
              onClick={() => {
                handlers.onBulkPoints(Number(points));
                setPoints("");
              }}
            >
              Đổi điểm
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Input
              value={tags}
              placeholder="Thẻ: an toàn bay, khí tượng"
              aria-label="Thẻ áp dụng hàng loạt"
              onChange={(e) => setTags(e.target.value)}
              className="h-8 w-48 rounded-full"
            />
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={busy || !tags.trim()}
              onClick={() => {
                handlers.onBulkTags(tags, "add");
                setTags("");
              }}
            >
              <Tags className="size-4" /> Thêm thẻ
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="rounded-full"
              disabled={busy || !tags.trim()}
              onClick={() => {
                handlers.onBulkTags(tags, "replace");
                setTags("");
              }}
            >
              Thay thẻ
            </Button>
          </div>

          <Select onValueChange={(v) => handlers.onBulkMoveQuiz(v)}>
            <SelectTrigger className="h-8 w-52 rounded-full">
              <SelectValue placeholder="Chuyển sang cuộc thi…" />
            </SelectTrigger>
            <SelectContent>
              {quizzes
                .filter((q) => q.id !== currentQuizId)
                .map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.title}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => handlers.onBulkArchive(true)}
          >
            <Archive className="size-4" /> Lưu trữ
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            disabled={busy}
            onClick={() => handlers.onBulkArchive(false)}
          >
            <ArchiveRestore className="size-4" /> Khôi phục
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={bulkRemoving}
            onClick={() => {
              if (confirm(`Xoá vĩnh viễn ${selectedCount} câu hỏi đã chọn?`))
                handlers.onBulkRemove();
            }}
          >
            {bulkRemoving ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            Xoá vĩnh viễn
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={onClearSelection}>
            Bỏ chọn
          </Button>
        </>
      )}
    </div>
  );
}
