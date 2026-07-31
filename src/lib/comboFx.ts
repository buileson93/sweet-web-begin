/**
 * Hiệu ứng combo kiểu Audition: trả lời đúng liên tiếp càng nhiều thì hiệu ứng
 * càng mạnh, và KHÔNG cấp nào trùng cấp nào (khác tên, khác màu, khác kiểu rung,
 * khác biểu tượng, khác số hạt bay).
 *
 * Module thuần (không phụ thuộc DOM) để test được bằng vitest.
 */

export type ComboIcon =
  | "sparkles"
  | "zap"
  | "flame"
  | "star"
  | "rocket"
  | "crown"
  | "trophy"
  | "sun"
  | "heart";

export type ComboTier = {
  /** Cấp hiệu ứng, 0 = chưa đủ combo để hiện gì. */
  level: number;
  /** Nhãn tiếng Việt hiển thị giữa màn hình. */
  label: string;
  /** Biểu tượng chủ đạo của cấp. */
  icon: ComboIcon;
  /** Tên lớp CSS rung màn hình (mỗi cấp một kiểu rung riêng). */
  shake: string;
  /** Tên lớp CSS cho khối chữ combo. */
  burst: string;
  /** Biên độ rung (px) — tăng dần theo cấp. */
  amplitude: number;
  /** Số hạt biểu tượng bay ra. */
  particles: number;
  /** Màu chủ đạo (biến CSS oklch). */
  color: string;
  /** Thời lượng hiệu ứng (ms). */
  duration: number;
};

const TIERS: Omit<ComboTier, "level">[] = [
  {
    label: "Tuyệt vời!",
    icon: "sparkles",
    shake: "fx-shake-tilt",
    burst: "fx-burst-pop",
    amplitude: 2,
    particles: 6,
    color: "oklch(0.78 0.14 200)",
    duration: 700,
  },
  {
    label: "Bùng nổ!",
    icon: "zap",
    shake: "fx-shake-jitter",
    burst: "fx-burst-slam",
    amplitude: 4,
    particles: 9,
    color: "oklch(0.82 0.17 95)",
    duration: 800,
  },
  {
    label: "Rực lửa!",
    icon: "flame",
    shake: "fx-shake-wave",
    burst: "fx-burst-flip",
    amplitude: 6,
    particles: 12,
    color: "oklch(0.7 0.19 45)",
    duration: 900,
  },
  {
    label: "Siêu đỉnh!",
    icon: "star",
    shake: "fx-shake-roll",
    burst: "fx-burst-zoom",
    amplitude: 8,
    particles: 16,
    color: "oklch(0.72 0.2 330)",
    duration: 950,
  },
  {
    label: "Thần tốc!",
    icon: "rocket",
    shake: "fx-shake-punch",
    burst: "fx-burst-streak",
    amplitude: 10,
    particles: 20,
    color: "oklch(0.68 0.2 265)",
    duration: 1000,
  },
  {
    label: "Bất bại!",
    icon: "crown",
    shake: "fx-shake-quake",
    burst: "fx-burst-glory",
    amplitude: 13,
    particles: 26,
    color: "oklch(0.8 0.16 85)",
    duration: 1100,
  },
  {
    label: "Huyền thoại!",
    icon: "trophy",
    shake: "fx-shake-storm",
    burst: "fx-burst-nova",
    amplitude: 16,
    particles: 32,
    color: "oklch(0.66 0.21 20)",
    duration: 1200,
  },
];

/** Combo tối thiểu để bắt đầu có hiệu ứng. */
export const COMBO_MIN = 2;

/** Trả về mô tả hiệu ứng cho số câu đúng liên tiếp. */
export function comboTier(combo: number): ComboTier | null {
  if (!Number.isFinite(combo) || combo < COMBO_MIN) return null;
  const idx = Math.min(TIERS.length - 1, Math.floor(combo) - COMBO_MIN);
  return { level: idx + 1, ...TIERS[idx] };
}

/** Số cấp hiệu ứng tối đa. */
export const COMBO_MAX_LEVEL = TIERS.length;

/** Toạ độ/độ trễ của từng hạt bay ra, phân bố đều theo vòng tròn. */
export function particleLayout(tier: ComboTier) {
  return Array.from({ length: tier.particles }, (_, i) => {
    const angle = (360 / tier.particles) * i;
    const rad = (angle * Math.PI) / 180;
    const distance = 90 + (i % 4) * 28 + tier.level * 10;
    return {
      angle,
      dx: Math.round(Math.cos(rad) * distance),
      dy: Math.round(Math.sin(rad) * distance),
      delay: (i % 6) * 40,
      scale: 0.7 + ((i % 5) * 0.12),
    };
  });
}
