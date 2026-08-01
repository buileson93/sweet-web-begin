/**
 * Elo theo chủ đề — cùng công thức Elo cổ điển, nhưng "đối thủ" là độ khó của
 * câu hỏi. Không trigger, không job nền: gọi một lệnh lúc kết chặng.
 */

export const START_RATING = 1200;
/** Độ khó quy đổi sang thang Elo. */
export const DIFFICULTY_RATING: Record<string, number> = {
  easy: 1000,
  medium: 1200,
  hard: 1400,
};

/** Hệ số K giảm dần theo kinh nghiệm để điểm ổn định về sau. */
export function kFactor(games: number): number {
  if (games < 10) return 40;
  if (games < 30) return 24;
  return 16;
}

/** Xác suất trả lời đúng theo Elo. */
export function expectedScore(rating: number, difficultyRating: number): number {
  return 1 / (1 + Math.pow(10, (difficultyRating - rating) / 400));
}

/** Một lần cập nhật Elo chủ đề; `score` nhận điểm phần (0…1). */
export function nextRating(input: {
  rating: number;
  games: number;
  difficulty: string;
  score: number;
}): number {
  const dr = DIFFICULTY_RATING[input.difficulty] ?? START_RATING;
  const exp = expectedScore(input.rating, dr);
  const score = Math.max(0, Math.min(1, input.score));
  return Math.round(input.rating + kFactor(input.games) * (score - exp));
}

export type TopicDelta = { tag: string; rating: number; games: number; correct: number };

/**
 * Gộp kết quả một chặng thành các thay đổi theo chủ đề.
 * Một câu nhiều thẻ chủ đề thì cập nhật cho từng thẻ.
 */
export function accumulateTopics(
  current: Record<string, { rating: number; games: number; correct: number }>,
  items: { tags: string[]; difficulty: string; fraction: number }[],
): TopicDelta[] {
  const map = new Map<string, { rating: number; games: number; correct: number }>();
  for (const item of items) {
    for (const rawTag of item.tags) {
      const tag = rawTag.trim();
      if (!tag) continue;
      const base =
        map.get(tag) ??
        current[tag] ?? { rating: START_RATING, games: 0, correct: 0 };
      map.set(tag, {
        rating: nextRating({
          rating: base.rating,
          games: base.games,
          difficulty: item.difficulty,
          score: item.fraction,
        }),
        games: base.games + 1,
        correct: base.correct + (item.fraction >= 1 ? 1 : 0),
      });
    }
  }
  return [...map.entries()].map(([tag, v]) => ({ tag, ...v }));
}

export type Mastery = "moi" | "dang-hoc" | "kha" | "thanh-thao";

/** Mức thành thạo — cần đủ số lần gặp mới dám kết luận. */
export function masteryOf(rating: number, games: number): Mastery {
  if (games < 3) return "moi";
  if (rating >= 1400) return "thanh-thao";
  if (rating >= 1250) return "kha";
  return "dang-hoc";
}

export const MASTERY_LABEL: Record<Mastery, string> = {
  moi: "Chưa đủ dữ liệu",
  "dang-hoc": "Đang học",
  kha: "Khá",
  "thanh-thao": "Thành thạo",
};

/**
 * Chọn câu thích ứng: nhắm xác suất đúng ~0,8 — đủ dễ để không nản,
 * đủ khó để còn học được.
 */
export const TARGET_SUCCESS = 0.8;

export function adaptiveScore(
  question: { tags: string[]; difficulty: string },
  ratings: Record<string, { rating: number; games: number }>,
): number {
  const relevant = question.tags
    .map((t) => ratings[t.trim()]?.rating)
    .filter((r): r is number => typeof r === "number");
  const rating = relevant.length
    ? relevant.reduce((a, b) => a + b, 0) / relevant.length
    : START_RATING;
  const p = expectedScore(rating, DIFFICULTY_RATING[question.difficulty] ?? START_RATING);
  return Math.abs(p - TARGET_SUCCESS);
}

/** Sắp xếp theo mức phù hợp rồi lấy `limit` câu. */
export function pickAdaptive<T extends { tags: string[]; difficulty: string }>(
  questions: T[],
  ratings: Record<string, { rating: number; games: number }>,
  limit: number,
): T[] {
  return [...questions]
    .map((q) => ({ q, d: adaptiveScore(q, ratings) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map((x) => x.q);
}

/**
 * Báo cáo tham khảo: dự báo phần trăm điểm kỳ thi từ mức thành thạo hiện tại.
 * KHÔNG ghi vào kết quả thi, không ảnh hưởng xếp hạng.
 */
export function readinessPercent(
  topics: { rating: number; games: number }[],
  assumedDifficulty = "medium",
): number {
  const scored = topics.filter((t) => t.games >= 1);
  if (!scored.length) return 0;
  const dr = DIFFICULTY_RATING[assumedDifficulty] ?? START_RATING;
  const avg =
    scored.reduce((sum, t) => sum + expectedScore(t.rating, dr), 0) / scored.length;
  return Math.round(avg * 100);
}
