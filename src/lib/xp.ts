/**
 * Hệ thống kinh nghiệm & cấp độ theo phong cách Habitica.
 * Module thuần (không phụ thuộc React/Supabase) để kiểm thử được.
 * LƯU Ý: công thức cấp độ phải khớp với hàm SQL public.award_player_xp.
 */

/** Tổng số kinh nghiệm cần tích luỹ để LÊN cấp `level + 1`. */
export function xpThreshold(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 100 * l + (50 * l * (l - 1)) / 2;
}

/** Cấp độ hiện tại ứng với tổng kinh nghiệm. */
export function levelFromXp(xp: number): number {
  const total = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  while (total >= xpThreshold(level)) level += 1;
  return level;
}

/** Tiến độ trong cấp hiện tại: đã có bao nhiêu / cần bao nhiêu / phần trăm. */
export function levelProgress(xp: number): {
  level: number;
  into: number;
  need: number;
  percent: number;
} {
  const total = Math.max(0, Math.floor(xp || 0));
  const level = levelFromXp(total);
  const floor = level === 1 ? 0 : xpThreshold(level - 1);
  const ceil = xpThreshold(level);
  const into = total - floor;
  const need = ceil - floor;
  return { level, into, need, percent: Math.min(100, Math.round((into / need) * 100)) };
}

export type XpInput = {
  score: number;
  total: number;
  passed: boolean;
  bestStreak: number;
  disqualified?: boolean;
  /** Có cải thiện so với lượt tốt nhất trước đó không. */
  improved?: boolean;
};

/**
 * Kinh nghiệm nhận được sau một lượt thi.
 * Càng làm nhiều bài, càng đúng nhiều thì càng lên cấp nhanh.
 */
export function computeXpGain(input: XpInput): number {
  if (input.disqualified) return 0;
  const total = Math.max(0, input.total);
  const score = Math.min(Math.max(0, input.score), total || 0);
  const percent = total > 0 ? (score / total) * 100 : 0;

  let xp = 10; // thưởng tham gia
  xp += score * 5; // mỗi câu đúng
  xp += Math.max(0, input.bestStreak) * 3; // chuỗi đúng liên tiếp
  if (input.passed) xp += 40;
  if (percent >= 80) xp += 20;
  if (percent >= 90) xp += 30;
  if (percent >= 100) xp += 50;
  if (input.improved) xp += 25;
  return Math.round(xp);
}

/** Danh hiệu hiển thị theo cấp độ. */
export function levelTitle(level: number): string {
  if (level >= 30) return "Huyền thoại bầu trời";
  if (level >= 20) return "Cơ trưởng tri thức";
  if (level >= 14) return "Kiểm soát viên bậc thầy";
  if (level >= 9) return "Phi công kỳ cựu";
  if (level >= 5) return "Học viên xuất sắc";
  if (level >= 3) return "Tân binh chăm chỉ";
  return "Tân binh";
}
