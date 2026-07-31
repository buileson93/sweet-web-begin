import { Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DIFFICULTIES, type Difficulty } from "@/lib/questionKinds";

import type { ArchiveFilter } from "./types";

/** Bộ lọc ngân hàng câu hỏi: cuộc thi, trạng thái lưu trữ, độ khó, từ khoá. */
export function QuestionFilters({
  quizzes,
  quizId,
  onQuizChange,
  difficultyFilter,
  onDifficultyChange,
  archiveFilter,
  onArchiveChange,
  keyword,
  onKeywordChange,
}: {
  quizzes: { id: string; title: string }[];
  quizId: string;
  onQuizChange: (id: string) => void;
  difficultyFilter: "all" | Difficulty;
  onDifficultyChange: (value: "all" | Difficulty) => void;
  archiveFilter: ArchiveFilter;
  onArchiveChange: (value: ArchiveFilter) => void;
  keyword: string;
  onKeywordChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      <Select value={quizId} onValueChange={onQuizChange}>
        <SelectTrigger className="rounded-full sm:w-56">
          <SelectValue placeholder="Chọn cuộc thi" />
        </SelectTrigger>
        <SelectContent>
          {quizzes.map((q) => (
            <SelectItem key={q.id} value={q.id}>
              {q.title}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={archiveFilter} onValueChange={(v) => onArchiveChange(v as ArchiveFilter)}>
        <SelectTrigger className="rounded-full sm:w-40">
          <SelectValue placeholder="Trạng thái" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Đang dùng</SelectItem>
          <SelectItem value="archived">Đã lưu trữ</SelectItem>
          <SelectItem value="all">Tất cả</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={difficultyFilter}
        onValueChange={(v) => onDifficultyChange(v as "all" | Difficulty)}
      >
        <SelectTrigger className="rounded-full sm:w-40">
          <SelectValue placeholder="Độ khó" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Mọi độ khó</SelectItem>
          {DIFFICULTIES.map((d) => (
            <SelectItem key={d.value} value={d.value}>
              {d.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative sm:w-56">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="rounded-full pl-10"
          placeholder="Tìm câu hỏi..."
          value={keyword}
          onChange={(e) => onKeywordChange(e.target.value)}
        />
      </div>
    </div>
  );
}
