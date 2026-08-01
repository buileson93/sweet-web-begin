/**
 * Bảng "Vô địch điểm thưởng": tôn vinh người kiếm được nhiều điểm nhờ chuỗi
 * đúng liên tiếp (combo) và nhân đôi điểm — khác với bảng xếp hạng chính
 * (xếp theo TỈ LỆ ĐÚNG).
 *
 * Module thuần, không phụ thuộc React/Supabase để kiểm thử được.
 */

export type ChampionRow = {
  id: string;
  candidate_name: string;
  unit: string | null;
  quiz_title?: string | null;
  score: number;
  total: number;
  points?: number | null;
  max_points?: number | null;
  best_streak?: number | null;
  time_seconds: number;
  submitted_at: string;
};

export type ChampionEntry = ChampionRow & {
  /** Điểm nền nếu không có thưởng: tỉ lệ đúng × điểm tối đa. */
  basePoints: number;
  /** Phần điểm kiếm thêm nhờ combo và nhân đôi. */
  bonusPoints: number;
  /** Điểm thực nhận. */
  points: number;
  bestStreak: number;
};

/** Chỉ ghi nhận bài đạt từ 50% trở lên (giống bảng xếp hạng chính). */
export function isChampionEligible(r: ChampionRow): boolean {
  return r.total > 0 && r.score / r.total >= 0.5;
}

/** Điểm nền (không thưởng) của một bài thi. */
export function basePointsOf(r: ChampionRow): number {
  const max = Math.max(0, r.max_points ?? 0);
  if (max <= 0 || r.total <= 0) return 0;
  return Math.round((max * r.score) / r.total);
}

/**
 * Xếp hạng vô địch: điểm thưởng nhiều nhất → chuỗi dài nhất → điểm thực →
 * thời gian ngắn hơn. Mỗi thí sinh chỉ giữ lại bài tốt nhất.
 */
export function rankChampions(rows: ChampionRow[], limit = 10): ChampionEntry[] {
  const entries = rows.filter(isChampionEligible).map((r) => {
    const points = Math.max(0, r.points ?? 0);
    const basePoints = basePointsOf(r);
    return {
      ...r,
      points,
      basePoints,
      bonusPoints: Math.max(0, points - basePoints),
      bestStreak: Math.max(0, r.best_streak ?? 0),
    } satisfies ChampionEntry;
  });

  const sorted = entries.sort((a, b) => {
    if (b.bonusPoints !== a.bonusPoints) return b.bonusPoints - a.bonusPoints;
    if (b.bestStreak !== a.bestStreak) return b.bestStreak - a.bestStreak;
    if (b.points !== a.points) return b.points - a.points;
    return a.time_seconds - b.time_seconds;
  });

  const seen = new Set<string>();
  const best: ChampionEntry[] = [];
  for (const e of sorted) {
    const key = `${e.candidate_name.trim().toLowerCase()}|${(e.unit ?? "").trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    best.push(e);
    if (best.length >= limit) break;
  }
  return best;
}
