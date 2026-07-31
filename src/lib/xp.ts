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

export type LevelTier = {
  level: number;
  title: string;
  reward: string;
  /** Lớp màu (design token) cho huy hiệu cấp bậc. */
  tone: string;
};

/** 10 cấp bậc dựng sẵn, mỗi cấp là một phần thưởng danh hiệu. */
export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, title: "Tân binh sân đỗ", reward: "Mở khoá hồ sơ nhân vật 3D", tone: "bg-muted text-muted-foreground" },
  { level: 2, title: "Học viên tập sự", reward: "Huy hiệu đồng trên bảng xếp hạng", tone: "bg-amber-100 text-amber-800" },
  { level: 3, title: "Nhân viên chăm chỉ", reward: "Khung ảnh đại diện màu đồng", tone: "bg-amber-200 text-amber-900" },
  { level: 4, title: "Kỹ thuật viên tin cậy", reward: "Hiệu ứng chuỗi đúng nâng cao", tone: "bg-sky-100 text-sky-800" },
  { level: 5, title: "Học viên xuất sắc", reward: "Khung ảnh đại diện màu bạc", tone: "bg-slate-200 text-slate-800" },
  { level: 6, title: "Kiểm soát viên lành nghề", reward: "Danh hiệu hiển thị cạnh tên", tone: "bg-teal-100 text-teal-800" },
  { level: 7, title: "Phi công kỳ cựu", reward: "Khung ảnh đại diện màu vàng", tone: "bg-yellow-200 text-yellow-900" },
  { level: 8, title: "Cơ trưởng tri thức", reward: "Hiệu ứng ánh vàng khi vào phòng thi", tone: "bg-orange-200 text-orange-900" },
  { level: 9, title: "Chỉ huy bầu trời", reward: "Khung bạch kim + ưu tiên vinh danh", tone: "bg-indigo-200 text-indigo-900" },
  { level: 10, title: "Huyền thoại bầu trời", reward: "Vương miện huyền thoại vĩnh viễn", tone: "surface-gold" },
];

/** Cấp bậc (1–10) tương ứng với cấp độ hiện tại. */
export function levelTier(level: number): LevelTier {
  const l = Math.min(LEVEL_TIERS.length, Math.max(1, Math.floor(level || 1)));
  return LEVEL_TIERS[l - 1];
}

/** Danh hiệu hiển thị theo cấp độ. */
export function levelTitle(level: number): string {
  return levelTier(level).title;
}
