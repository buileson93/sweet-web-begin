// Logic chấm điểm thuần tuý — tách khỏi exam.server.ts để test được mà không cần Supabase.
import {
  normalizeText,
  type AnswerValue,
  type Blueprint,
  type Difficulty,
  type QuestionKind,
} from "@/lib/questionKinds";

/** Tỷ lệ điểm tối thiểu để được công nhận "Đạt" khi cuộc thi không cấu hình riêng. */
export const PASS_RATIO = 0.5;

export type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  image_url: string | null;
  kind: QuestionKind;
  correct_indices: number[];
  accepted_answers: string[];
  pairs: unknown;
  correct_order: number[];
  difficulty: Difficulty;
  tags: string[];
  points: number;
  explanation: string;
  time_limit_seconds: number | null;
};

export function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function percentOf(score: number, total: number) {
  return total > 0 ? Math.round((score / total) * 100) : 0;
}

export function pairsOf(row: Pick<QuestionRow, "pairs">): { left: string; right: string }[] {
  const raw = row.pairs;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((p) => (p && typeof p === "object" ? (p as { left?: unknown; right?: unknown }) : {}))
    .map((p) => ({ left: String(p.left ?? ""), right: String(p.right ?? "") }))
    .filter((p) => p.left || p.right);
}

/** Danh sách phương án hiển thị gốc (chưa trộn) tuỳ theo loại câu hỏi. */
export function baseOptions(row: QuestionRow): string[] {
  if (row.kind === "matching") return pairsOf(row).map((p) => p.right);
  if (row.kind === "true_false") return row.options.length >= 2 ? row.options : ["Đúng", "Sai"];
  return row.options;
}

/** Chấm một câu. `order` là ánh xạ vị trí hiển thị -> vị trí gốc. */
export function gradeOne(
  row: QuestionRow,
  order: number[],
  value: AnswerValue | undefined,
): boolean {
  if (value === undefined || value === null) return false;
  switch (row.kind) {
    case "multi": {
      if (!Array.isArray(value)) return false;
      const chosen = new Set(
        (value as number[])
          .filter((i) => Number.isInteger(i) && i >= 0 && i < order.length)
          .map((i) => order[i]),
      );
      const expected = new Set(row.correct_indices ?? []);
      if (chosen.size === 0 || chosen.size !== expected.size) return false;
      for (const i of expected) if (!chosen.has(i)) return false;
      return true;
    }
    case "fill_blank": {
      if (typeof value !== "string") return false;
      const answer = normalizeText(value);
      if (!answer) return false;
      return (row.accepted_answers ?? []).some((a) => normalizeText(a) === answer);
    }
    case "matching": {
      if (typeof value !== "object" || Array.isArray(value)) return false;
      const pairs = pairsOf(row);
      if (pairs.length === 0) return false;
      return pairs.every((_, leftIndex) => {
        const display = (value as Record<string, number>)[String(leftIndex)];
        return (
          Number.isInteger(display) &&
          display >= 0 &&
          display < order.length &&
          order[display] === leftIndex
        );
      });
    }
    case "ordering": {
      if (!Array.isArray(value)) return false;
      const expected =
        row.correct_order && row.correct_order.length === order.length
          ? row.correct_order
          : order.map((_, i) => i).sort((a, b) => a - b);
      const chosen = (value as number[]).map((i) => order[i]);
      if (chosen.length !== expected.length) return false;
      return chosen.every((v, i) => v === expected[i]);
    }
    default: {
      if (typeof value !== "number") return false;
      return value >= 0 && value < order.length && order[value] === row.correct_index;
    }
  }
}

/** Mô tả đáp án đúng dưới dạng chữ để hiển thị khi xem lại. */
export function correctTextOf(row: QuestionRow): string {
  switch (row.kind) {
    case "multi":
      return (row.correct_indices ?? [])
        .map((i) => row.options[i])
        .filter(Boolean)
        .join(" · ");
    case "fill_blank":
      return (row.accepted_answers ?? []).join(" / ");
    case "matching":
      return pairsOf(row)
        .map((p) => `${p.left} → ${p.right}`)
        .join(" · ");
    case "ordering": {
      const expected = row.correct_order?.length ? row.correct_order : row.options.map((_, i) => i);
      return expected
        .map((i) => row.options[i])
        .filter(Boolean)
        .join(" → ");
    }
    default:
      return row.options[row.correct_index] ?? "";
  }
}

export function chosenTextOf(
  row: QuestionRow,
  order: number[],
  value: AnswerValue | undefined,
): string {
  const display = baseOptions(row);
  if (value === undefined || value === null) return "";
  switch (row.kind) {
    case "multi":
      return Array.isArray(value)
        ? (value as number[])
            .map((i) => display[order[i]])
            .filter(Boolean)
            .join(" · ")
        : "";
    case "fill_blank":
      return typeof value === "string" ? value : "";
    case "matching": {
      if (typeof value !== "object" || Array.isArray(value)) return "";
      const pairs = pairsOf(row);
      return pairs
        .map((p, i) => {
          const d = (value as Record<string, number>)[String(i)];
          const right = Number.isInteger(d) ? display[order[d]] : "(chưa nối)";
          return `${p.left} → ${right ?? "(chưa nối)"}`;
        })
        .join(" · ");
    }
    case "ordering":
      return Array.isArray(value)
        ? (value as number[])
            .map((i) => display[order[i]])
            .filter(Boolean)
            .join(" → ")
        : "";
    default:
      return typeof value === "number" ? (display[order[value]] ?? "") : "";
  }
}

/** Bốc đề theo công thức: ưu tiên tỉ lệ độ khó, phần còn lại lấy ngẫu nhiên. */
export function pickByBlueprint(
  pool: QuestionRow[],
  wanted: number,
  blueprint: Blueprint,
): QuestionRow[] {
  const picked: QuestionRow[] = [];
  const used = new Set<string>();
  const takeFrom = (rows: QuestionRow[], count: number) => {
    for (const row of shuffle(rows)) {
      if (picked.length >= wanted || count <= 0) break;
      if (used.has(row.id)) continue;
      used.add(row.id);
      picked.push(row);
      count--;
    }
  };

  for (const level of ["easy", "medium", "hard"] as Difficulty[]) {
    const count = Number(blueprint?.[level] ?? 0);
    if (count > 0)
      takeFrom(
        pool.filter((r) => r.difficulty === level),
        count,
      );
  }
  for (const [tag, count] of Object.entries(blueprint?.tags ?? {})) {
    if (Number(count) > 0)
      takeFrom(
        pool.filter((r) => (r.tags ?? []).includes(tag)),
        Number(count),
      );
  }
  if (picked.length < wanted)
    takeFrom(
      pool.filter((r) => !used.has(r.id)),
      wanted - picked.length,
    );
  return shuffle(picked).slice(0, wanted);
}
