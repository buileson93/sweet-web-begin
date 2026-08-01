/** Cấu hình Leo Tháp — dữ liệu hoá, thêm nội dung không cần sửa code. */
export const STAGES_PER_RUN = 5;
export const QUESTIONS_PER_STAGE = 5;
export const QUESTIONS_PER_RUN = STAGES_PER_RUN * QUESTIONS_PER_STAGE;
export const START_HP = 100;
/** Sai quá tỉ lệ này trong một chặng → kết thúc nhẹ nhàng (không dùng ngôn từ thất bại). */
export const STOP_WRONG_RATIO = 0.4;

export type Boon = {
  id: string;
  name: string;
  desc: string;
  rarity: "thuong" | "hiem";
  /** Ngôn ngữ hiệu ứng nhỏ: cộng thẳng vào chỉ số của phiên. */
  effect: { shield?: number; heal?: number; damageBonus?: number; timeBonus?: number };
};

/** 8 trợ học đầu tiên (5 Thường + 3 Hiếm). Thêm mới chỉ cần nối vào mảng này. */
export const BOONS: Boon[] = [
  { id: "so-tay", name: "Sổ tay ghi chú", desc: "+8 máu ngay", rarity: "thuong", effect: { heal: 8 } },
  { id: "ca-phe", name: "Ly cà phê", desc: "+3 giây mỗi câu", rarity: "thuong", effect: { timeBonus: 3 } },
  { id: "but-do", name: "Bút đỏ", desc: "+2 sát thương mỗi câu đúng", rarity: "thuong", effect: { damageBonus: 2 } },
  { id: "ao-phan-quang", name: "Áo phản quang", desc: "Khiên 10 máu", rarity: "thuong", effect: { shield: 10 } },
  { id: "tai-nghe", name: "Tai nghe chống ồn", desc: "+5 máu, +1 giây", rarity: "thuong", effect: { heal: 5, timeBonus: 1 } },
  { id: "so-tay-vang", name: "Sổ tay vàng", desc: "+20 máu", rarity: "hiem", effect: { heal: 20 } },
  { id: "radar", name: "Màn hình radar", desc: "+5 sát thương mỗi câu đúng", rarity: "hiem", effect: { damageBonus: 5 } },
  { id: "giay-phep", name: "Giấy phép đặc biệt", desc: "Khiên 25 máu", rarity: "hiem", effect: { shield: 25 } },
];

/** Chọn 3 trợ học để người học chọn 1, dùng RNG có hạt để tái lập được. */
export function offerBoons(rand: () => number, taken: string[] = []): Boon[] {
  const pool = BOONS.filter((b) => !taken.includes(b.id));
  const out: Boon[] = [];
  const copy = [...pool];
  while (out.length < 3 && copy.length) {
    const i = Math.floor(rand() * copy.length) % copy.length;
    out.push(copy.splice(i, 1)[0]!);
  }
  return out;
}
