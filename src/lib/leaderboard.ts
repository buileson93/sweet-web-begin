/**
 * Quy tắc xếp hạng thí sinh (lớp thuần, kiểm thử được).
 *
 * VÌ SAO KHÔNG XẾP THEO `points`: điểm thô có cộng thưởng combo/nhân đôi và
 * phụ thuộc cấu hình từng cuộc thi, nên một bài 12/20 có chuỗi dài vẫn có thể
 * vượt bài 19/20 làm ở cấu hình cũ (không thưởng). Xếp hạng phải công bằng theo
 * TỈ LỆ ĐÚNG trước, điểm thưởng chỉ dùng để phá hoà.
 */

export type RankableResult = {
  score: number;
  total: number;
  points?: number | null;
  max_points?: number | null;
  time_seconds: number;
  /** Số lần thí sinh đã thi cuộc thi này (dùng để phá hoà: thi ít lần hơn xếp trên). */
  attempts?: number | null;
};

/** Tỉ lệ đúng 0–1. */
export function accuracyOf(r: RankableResult): number {
  return r.total > 0 ? r.score / r.total : 0;
}

/** Tỉ lệ điểm thưởng 0–1; cuộc thi không cấu hình thưởng thì coi như bằng tỉ lệ đúng. */
export function bonusRatioOf(r: RankableResult): number {
  const max = r.max_points ?? 0;
  if (max > 0) return Math.max(0, r.points ?? 0) / max;
  return accuracyOf(r);
}

/** Ngưỡng vào bảng xếp hạng: đúng từ 50% trở lên. */
export function isRankable(r: RankableResult): boolean {
  return r.total > 0 && accuracyOf(r) >= 0.5;
}

/**
 * So sánh hai kết quả: tỉ lệ đúng → thời gian làm bài ngắn hơn.
 * Điểm thưởng KHÔNG tham gia xếp hạng (tránh việc bài chậm hơn nhưng có combo
 * lại vượt bài cùng số câu đúng làm nhanh hơn).
 */
export function compareResults(a: RankableResult, b: RankableResult): number {
  const acc = accuracyOf(b) - accuracyOf(a);
  if (Math.abs(acc) > 1e-9) return acc;
  if (a.time_seconds !== b.time_seconds) return a.time_seconds - b.time_seconds;
  // Cùng tỉ lệ đúng và cùng thời gian: ai thi ÍT LẦN hơn được xếp trên.
  return attemptsOf(a) - attemptsOf(b);
}

/** Số lần thi (mặc định 1 nếu chưa được gắn). */
export function attemptsOf(r: RankableResult): number {
  return Math.max(1, r.attempts ?? 1);
}

/** Khoá gộp theo thí sinh: ưu tiên employee_id, không có thì tên + đơn vị. */
export function candidateKeyOf(r: {
  employee_id?: string | null;
  candidate_name?: string | null;
  unit?: string | null;
}): string {
  return (
    r.employee_id ??
    `${(r.candidate_name ?? "").trim().toLowerCase()}|${(r.unit ?? "").trim().toLowerCase()}`
  );
}

/** Lọc bài chưa đạt rồi sắp xếp theo quy tắc trên. */
export function rankResults<T extends RankableResult>(rows: T[]): T[] {
  return rows.filter(isRankable).sort(compareResults);
}

/**
 * So sánh để chọn BÀI TỐT NHẤT của một thí sinh: đúng nhiều nhất, nếu bằng nhau
 * thì thời gian ngắn hơn. Điểm thưởng KHÔNG tham gia (điểm thưởng chỉ dùng cho
 * bảng "săn điểm thưởng").
 */
export function compareBestAttempt(a: RankableResult, b: RankableResult): number {
  const acc = accuracyOf(b) - accuracyOf(a);
  if (Math.abs(acc) > 1e-9) return acc;
  return a.time_seconds - b.time_seconds;
}

/**
 * Chỉ hiển thị bài TỐT NHẤT của mỗi thí sinh (dữ liệu gốc trong CSDL giữ nguyên).
 * Khoá gộp ưu tiên employee_id, không có thì dùng tên + đơn vị.
 */
export function dedupeByCandidate<
  T extends RankableResult & { employee_id?: string | null; candidate_name?: string | null; unit?: string | null },
>(rows: T[]): T[] {
  const bestOf = new Map<string, T>();
  const order: string[] = [];
  for (const r of rows) {
    const key = candidateKeyOf(r);
    const cur = bestOf.get(key);
    if (!cur) {
      bestOf.set(key, r);
      order.push(key);
      continue;
    }
    if (compareBestAttempt(r, cur) < 0) bestOf.set(key, r);
  }
  return order.map((k) => bestOf.get(k)!);
}

/** Gộp bài tốt nhất của mỗi thí sinh rồi xếp hạng theo quy tắc chung. */
export function rankUniqueResults<
  T extends RankableResult & { employee_id?: string | null; candidate_name?: string | null; unit?: string | null },
>(rows: T[]): T[] {
  // Đếm TỔNG số lần thi của mỗi thí sinh (kể cả bài chưa đạt) trước khi lọc,
  // để phá hoà khi cùng tỉ lệ đúng và cùng thời gian.
  const attemptsByKey = new Map<string, number>();
  for (const r of rows) {
    const k = candidateKeyOf(r);
    attemptsByKey.set(k, (attemptsByKey.get(k) ?? 0) + 1);
  }
  const withAttempts = rows
    .filter(isRankable)
    .map((r) => ({ ...r, attempts: attemptsByKey.get(candidateKeyOf(r)) ?? 1 }));
  return rankResults(dedupeByCandidate(withAttempts)) as T[];
}

