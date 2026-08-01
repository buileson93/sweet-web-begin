/**
 * Trùm có luật riêng — mỗi con buộc người chơi đổi cách chơi, không chỉ là "nhiều máu hơn".
 */
export type Boss = {
  floor: number;
  icon: string;
  name: string;
  rule: string;
  hp: number;
  effect: {
    /** Nhân thêm sát thương người chơi nhận (0.3 = +30%). */
    damageTakenPct?: number;
    /** Nhân thời gian mỗi câu (−0.5 = còn một nửa). */
    timePct?: number;
    /** Vô hiệu mọi nguồn hồi máu. */
    noHeal?: boolean;
    /** Kỹ năng hồi chậm thêm N lượt. */
    skillSlow?: number;
  };
};

export const BOSSES: Boss[] = [
  {
    floor: 4,
    icon: "🧐",
    name: "Giám khảo Khắt khe",
    rule: "Trả lời sai bị phạt nặng — sát thương nhận +30%. Hãy chậm mà chắc.",
    hp: 120,
    effect: { damageTakenPct: 0.3 },
  },
  {
    floor: 8,
    icon: "🕰️",
    name: "Đồng hồ Tham lam",
    rule: "Thời gian mỗi câu chỉ còn một nửa. Lối chơi tốc độ lên ngôi.",
    hp: 180,
    effect: { timePct: -0.5 },
  },
  {
    floor: 12,
    icon: "🌑",
    name: "Bóng tối Tri thức",
    rule: "Vô hiệu hồi máu, kỹ năng hồi chậm. Lối chơi bú máu phải tìm cách khác.",
    hp: 260,
    effect: { noHeal: true, skillSlow: 2 },
  },
];

export const bossAt = (floor: number): Boss | undefined => BOSSES.find((b) => b.floor === floor);
