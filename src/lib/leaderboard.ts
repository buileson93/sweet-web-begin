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
 * So sánh hai kết quả: tỉ lệ đúng → tỉ lệ điểm thưởng → thời gian làm bài ngắn hơn.
 */
export function compareResults(a: RankableResult, b: RankableResult): number {
  const acc = accuracyOf(b) - accuracyOf(a);
  if (Math.abs(acc) > 1e-9) return acc;
  const bonus = bonusRatioOf(b) - bonusRatioOf(a);
  if (Math.abs(bonus) > 1e-9) return bonus;
  return a.time_seconds - b.time_seconds;
}

/** Lọc bài chưa đạt rồi sắp xếp theo quy tắc trên. */
export function rankResults<T extends RankableResult>(rows: T[]): T[] {
  return rows.filter(isRankable).sort(compareResults);
}

/**
 * Chỉ hiển thị bài TỐT NHẤT của mỗi thí sinh (dữ liệu gốc trong CSDL giữ nguyên).
 * Khoá gộp ưu tiên employee_id, không có thì dùng tên + đơn vị.
 */
export function dedupeByCandidate<
  T extends RankableResult & { employee_id?: string | null; candidate_name?: string | null; unit?: string | null },
>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const key =
      r.employee_id ??
      `${(r.candidate_name ?? "").trim().toLowerCase()}|${(r.unit ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Xếp hạng rồi gộp: mỗi thí sinh một dòng duy nhất với kết quả cao nhất. */
export function rankUniqueResults<
  T extends RankableResult & { employee_id?: string | null; candidate_name?: string | null; unit?: string | null },
>(rows: T[]): T[] {
  return dedupeByCandidate(rankResults(rows));
}
