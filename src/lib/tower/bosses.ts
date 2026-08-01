/**
 * Sự cố lớn có luật riêng — mỗi con buộc người chơi đổi cách chơi, không chỉ là "nhiều an toàn hơn".
 */
export type Boss = {
  floor: number;
  icon: string;
  name: string;
  rule: string;
  hp: number;
  effect: {
    /** Nhân thêm điểm xử lý người chơi nhận (0.3 = +30%). */
    damageTakenPct?: number;
    /** Nhân thời gian mỗi câu (−0.5 = còn một nửa). */
    timePct?: number;
    /** Vô hiệu mọi nguồn hồi an toàn. */
    noHeal?: boolean;
    /** Kỹ năng hồi chậm thêm N lượt. */
    skillSlow?: number;
  };
};

export const BOSSES: Boss[] = [
  {
    floor: 4,
    icon: "🧐",
    name: "Kiểm tra định kỳ",
    rule: "Trả lời sai bị phạt nặng — rủi ro phải nhận +30%. Hãy chậm mà chắc.",
    hp: 120,
    effect: { damageTakenPct: 0.3 },
  },
  {
    floor: 8,
    icon: "🕰️",
    name: "Giờ cao điểm",
    rule: "Thời gian mỗi câu chỉ còn một nửa. Lối chơi tốc độ lên ngôi.",
    hp: 180,
    effect: { timePct: -0.5 },
  },
  {
    floor: 12,
    icon: "🌑",
    name: "Thời tiết xấu diện rộng",
    rule: "Vô hiệu hồi an toàn, kỹ năng hồi chậm. Lối chơi bú an toàn phải tìm cách khác.",
    hp: 260,
    effect: { noHeal: true, skillSlow: 2 },
  },
];

export const bossAt = (floor: number): Boss | undefined => BOSSES.find((b) => b.floor === floor);
