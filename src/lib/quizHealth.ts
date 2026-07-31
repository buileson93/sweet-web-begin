/**
 * Phân tích "sức khoẻ ngân hàng đề" của một cuộc thi — hàm thuần tuý, không phụ thuộc Supabase.
 * Mục tiêu: cảnh báo cho ban soạn đề NGAY khi cấu hình, thay vì để thí sinh gặp lỗi lúc bấm thi.
 */
import { DIFFICULTY_LABEL, type Blueprint, type Difficulty } from "@/lib/questionKinds";

export type PoolStats = {
  total: number;
  easy: number;
  medium: number;
  hard: number;
  /** Số câu theo từng thẻ (một câu có thể thuộc nhiều thẻ). */
  tags: Record<string, number>;
};

export type HealthLevel = "red" | "yellow" | "info";

export type HealthIssue = {
  level: HealthLevel;
  message: string;
};

export type QuizHealth = {
  issues: HealthIssue[];
  /** Tổng số câu khai báo trong công thức bốc đề. */
  blueprintTotal: number;
  /** Ước tính tỉ lệ trùng câu giữa hai thí sinh bất kỳ (%). */
  overlapPercent: number;
  /** Có cảnh báo ĐỎ hay không — chặn xuất bản. */
  hasBlocker: boolean;
};

export function emptyPool(): PoolStats {
  return { total: 0, easy: 0, medium: 0, hard: 0, tags: {} };
}

/** Gom thống kê kho câu hỏi từ danh sách thô. */
export function summarizePool(rows: { difficulty: Difficulty; tags?: string[] | null }[]): PoolStats {
  const stats = emptyPool();
  for (const row of rows) {
    stats.total++;
    if (row.difficulty === "easy" || row.difficulty === "medium" || row.difficulty === "hard") {
      stats[row.difficulty]++;
    }
    for (const tag of row.tags ?? []) {
      const key = tag.trim();
      if (!key) continue;
      stats.tags[key] = (stats.tags[key] ?? 0) + 1;
    }
  }
  return stats;
}

/** Tỉ lệ trùng đề ước tính giữa hai thí sinh bất kỳ: số câu mỗi đề / tổng kho. */
export function overlapPercentOf(questionCount: number, poolTotal: number): number {
  if (poolTotal <= 0) return 100;
  return Math.min(100, Math.round((questionCount / poolTotal) * 100));
}

export function analyzeQuizHealth(input: {
  questionCount: number;
  blueprint: Blueprint | null | undefined;
  pool: PoolStats;
}): QuizHealth {
  const issues: HealthIssue[] = [];
  const wanted = Math.max(0, Math.floor(input.questionCount) || 0);
  const bp = input.blueprint ?? {};
  const pool = input.pool;

  if (pool.total < wanted) {
    issues.push({
      level: "red",
      message: `Kho chỉ có ${pool.total} câu nhưng đề cần ${wanted} câu. Thí sinh sẽ không bắt đầu thi được — hãy bổ sung ${wanted - pool.total} câu.`,
    });
  }

  const levels: Difficulty[] = ["easy", "medium", "hard"];
  let blueprintTotal = 0;
  for (const level of levels) {
    const need = Math.max(0, Number(bp[level] ?? 0) || 0);
    blueprintTotal += need;
    if (need > pool[level]) {
      issues.push({
        level: "yellow",
        message: `Mức ${DIFFICULTY_LABEL[level]}: yêu cầu ${need} câu nhưng kho chỉ có ${pool[level]} câu — hệ thống sẽ lấy bù bằng câu ngẫu nhiên ở mức khác.`,
      });
    }
  }

  for (const [tag, raw] of Object.entries(bp.tags ?? {})) {
    const need = Math.max(0, Number(raw) || 0);
    if (need <= 0) continue;
    blueprintTotal += need;
    const have = pool.tags[tag] ?? 0;
    if (need > have) {
      issues.push({
        level: "yellow",
        message: `Thẻ "${tag}": yêu cầu ${need} câu nhưng kho chỉ có ${have} câu — hệ thống sẽ lấy bù bằng câu ngẫu nhiên.`,
      });
    }
  }

  if (blueprintTotal > 0 && blueprintTotal !== wanted) {
    issues.push({
      level: "yellow",
      message:
        blueprintTotal > wanted
          ? `Tổng công thức bốc đề (${blueprintTotal} câu) nhiều hơn số câu mỗi lượt thi (${wanted} câu) — phần dư sẽ bị bỏ.`
          : `Tổng công thức bốc đề (${blueprintTotal} câu) ít hơn số câu mỗi lượt thi (${wanted} câu) — ${wanted - blueprintTotal} câu còn lại bốc ngẫu nhiên.`,
    });
  }

  const overlapPercent = overlapPercentOf(wanted, pool.total);
  if (overlapPercent > 60) {
    issues.push({
      level: "yellow",
      message: `Hai thí sinh bất kỳ trùng khoảng ${overlapPercent}% số câu. Nên bổ sung câu hỏi để đề đa dạng hơn.`,
    });
  } else {
    issues.push({
      level: "info",
      message: `Hai thí sinh bất kỳ trùng khoảng ${overlapPercent}% số câu.`,
    });
  }

  return {
    issues,
    blueprintTotal,
    overlapPercent,
    hasBlocker: issues.some((i) => i.level === "red"),
  };
}
