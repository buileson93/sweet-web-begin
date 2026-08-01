// Logic chấm điểm thuần tuý — tách khỏi exam.server.ts để test được mà không cần Supabase.
import {
  normalizeText,
  type AnswerValue,
  type Blueprint,
  type Difficulty,
  type QuestionKind,
} from "@/lib/questionKinds";

/** Mức điểm đạt mặc định, tính theo PHẦN TRĂM (0–100), dùng khi cuộc thi không cấu hình riêng. */
export const PASS_PERCENT_DEFAULT = 50;

/**
 * Xác định bài thi có ĐẠT hay không.
 * Đơn vị duy nhất của `passPercent` là phần trăm (0–100), không phải số câu đúng.
 * - total = 0 -> luôn chưa đạt.
 * - passPercent <= 0 -> dùng mặc định 50%.
 */
export function isPassed(score: number, total: number, passPercent: number): boolean {
  if (!total || total <= 0) return false;
  const threshold = passPercent > 0 ? passPercent : PASS_PERCENT_DEFAULT;
  return percentOf(score, total) >= threshold;
}

/** Thời gian ân hạn khi nộp bài (ms): bù cho độ trễ mạng lúc bấm nộp đúng phút chót. */
export const SUBMIT_GRACE_MS = 30_000;

/**
 * Tính mức độ nộp muộn so với thời điểm hết hạn.
 * - `expired`: đã quá giờ làm bài.
 * - `msLate`: số mili giây nộp muộn (0 nếu còn hạn).
 * - `withinGrace`: còn nằm trong khoảng ân hạn SUBMIT_GRACE_MS.
 * Mốc thời gian không hợp lệ được coi là ĐÃ HẾT HẠN và HẾT ân hạn (an toàn cho kỳ thi).
 */
export function lateness(
  nowIso: string,
  expiresAtIso: string,
): { expired: boolean; msLate: number; withinGrace: boolean } {
  const now = Date.parse(nowIso);
  const expires = Date.parse(expiresAtIso);
  if (Number.isNaN(now) || Number.isNaN(expires)) {
    return { expired: true, msLate: Number.POSITIVE_INFINITY, withinGrace: false };
  }
  const msLate = Math.max(0, now - expires);
  return { expired: msLate > 0, msLate, withinGrace: msLate <= SUBMIT_GRACE_MS };
}

export type QuestionRow = {
  id: string;
  question: string;
  options: string[];
  correct_index: number;
  image_url: string | null;
  /** Ảnh riêng của từng phương án, cùng chỉ số với `options`; chuỗi rỗng = không có ảnh. */
  option_images: string[] | null;
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
  /** Thứ tự hiển thị ổn định trong cuộc thi (dùng khi tắt trộn câu hỏi). */
  order_index: number;
};

/**
 * Trộn mảng. Truyền `seed` để có kết quả lặp lại được (dùng cho ô xem trước:
 * cùng một seed thì cùng một thứ tự, đổi seed mới trộn lại).
 */
export function shuffle<T>(input: T[], seed?: number): T[] {
  const arr = [...input];
  // Bộ sinh số giả ngẫu nhiên mulberry32 — nhỏ gọn và ổn định theo seed.
  let state = ((seed ?? 0) >>> 0) + 0x6d2b79f5;
  const rand = () => {
    if (seed === undefined) return Math.random();
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
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

/**
 * Danh sách ảnh phương án theo ĐÚNG chỉ số của `baseOptions(row)`.
 * Thiếu phần tử thì bù chuỗi rỗng, thừa thì cắt bớt.
 */
export function optionImagesOf(row: QuestionRow): string[] {
  const count = baseOptions(row).length;
  const raw = Array.isArray(row.option_images) ? row.option_images : [];
  return Array.from({ length: count }, (_, i) => String(raw[i] ?? ""));
}

/**
 * Hoán vị một mảng theo `order` (ánh xạ vị trí hiển thị -> vị trí gốc).
 * Dùng để ảnh phương án luôn đi kèm đúng phương án sau khi trộn.
 */
export function permuteByOrder<T>(items: T[], order: number[], fallback: T): T[] {
  return order.map((i) => (i >= 0 && i < items.length ? items[i] : fallback));
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

/**
 * Bốc đề theo công thức: ưu tiên tỉ lệ độ khó, phần còn lại lấy ngẫu nhiên.
 * Việc CHỌN câu luôn ngẫu nhiên trong từng nhóm độ khó để mỗi lượt thi ra đề khác nhau,
 * nhưng THỨ TỰ câu chỉ bị trộn khi `shuffleQuestions = true`; ngược lại sắp lại
 * theo thứ tự ổn định của pool (order_index, rồi id để hoà nhau vẫn xác định).
 */
export function pickByBlueprint(
  pool: QuestionRow[],
  wanted: number,
  blueprint: Blueprint,
  shuffleQuestions: boolean,
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
  const result = picked.slice(0, wanted);
  if (shuffleQuestions) return shuffle(result);
  return result.sort((a, b) => a.order_index - b.order_index || a.id.localeCompare(b.id));
}

/** Cấu hình tính điểm hấp dẫn của một cuộc thi. */
export type ScoreRules = {
  /** Bật thưởng chuỗi đúng liên tiếp. */
  streakBonus: boolean;
  /** Điểm cộng thêm cho mỗi câu đúng liên tiếp kể từ câu thứ 3. */
  streakStep: number;
  /** Trần điểm thưởng chuỗi cho mỗi câu; 0 hoặc âm = KHÔNG giới hạn (combo luỹ tiến vô tận). */
  streakMaxBonus: number;
  /** Số câu đúng liên tiếp để nhân đôi điểm câu đó; 0 = tắt. */
  doublePointsAfter: number;
  /** Trừ điểm khi trả lời sai (theo tỉ lệ điểm câu hỏi). */
  negativeMarking: number;
};

export const DEFAULT_SCORE_RULES: ScoreRules = {
  streakBonus: true,
  streakStep: 1,
  streakMaxBonus: 0,
  doublePointsAfter: 0,
  negativeMarking: 0,
};

/** Mốc combo bắt đầu được thưởng điểm luỹ tiến. */
export const COMBO_START = 3;

/**
 * Điểm thưởng chuỗi cho MỘT câu khi combo đạt `streak`.
 * Luỹ tiến từ combo thứ 3 trở lên; nếu `streakMaxBonus <= 0` thì tăng vô tận.
 */
export function comboBonus(streak: number, rules: ScoreRules): number {
  if (!rules.streakBonus || streak < COMBO_START) return 0;
  const step = Math.max(0, rules.streakStep);
  const raw = (streak - (COMBO_START - 1)) * step;
  return rules.streakMaxBonus > 0 ? Math.min(rules.streakMaxBonus, raw) : raw;
}

/**
 * Điểm nhận được cho MỘT câu, đã tính thưởng chuỗi luỹ tiến và nhân đôi.
 * @param streak số câu đúng liên tiếp TÍNH CẢ câu này (1 nếu là câu đầu chuỗi).
 * @param opts.x2 thí sinh dùng vật phẩm X2 cho chính câu này (nhân đôi CẢ điểm thưởng combo).
 */
export function scoreForAnswer(
  basePoints: number,
  correct: boolean,
  answered: boolean,
  streak: number,
  rules: ScoreRules,
  opts: { x2?: boolean } = {},
): number {
  const base = Math.max(1, basePoints || 1);
  if (!correct) return answered ? -Math.max(0, rules.negativeMarking) * base : 0;

  const doubled =
    rules.doublePointsAfter > 0 && streak >= rules.doublePointsAfter ? base * 2 : base;

  const total = doubled + comboBonus(streak, rules);
  return opts.x2 ? total * 2 : total;
}

/**
 * Ước lượng lại tổng điểm của một lượt thi CŨ (chỉ còn số câu đúng và chuỗi dài nhất).
 * Dùng để xếp hạng lại theo thuật toán điểm mới mà không cần chấm lại từng câu.
 */
export function estimatePoints(score: number, bestStreak: number, rules = DEFAULT_SCORE_RULES) {
  const correct = Math.max(0, Math.floor(score || 0));
  const streak = Math.min(correct, Math.max(0, Math.floor(bestStreak || 0)));
  let total = correct; // mỗi câu đúng 1 điểm gốc
  for (let s = COMBO_START; s <= streak; s++) total += comboBonus(s, rules);
  return total;
}

/**
 * Hoán vị một mảng phụ (ảnh, giải thích...) theo đúng thứ tự phương án đã trộn.
 * `order[i]` là chỉ số gốc của phương án đang đứng ở vị trí i.
 */
export function reorderByDisplay(list: string[] | null | undefined, order: number[]): string[] {
  const src = list ?? [];
  return order.map((i) => src[i] ?? "");
}
