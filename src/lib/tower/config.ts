/** Cấu hình Tháp Không Lưu (TWR ATC) — dữ liệu hoá, thêm nội dung không cần sửa code. */
/** Ngân hàng câu hỏi chuyên ngành KSVKL dùng mặc định cho Tháp Không Lưu. */
export const ATC_BANK_QUIZ_ID = "00000000-0000-4a7c-9000-00000000a7c1";
export const STAGES_PER_RUN = 5;
export const QUESTIONS_PER_STAGE = 5;
export const QUESTIONS_PER_RUN = STAGES_PER_RUN * QUESTIONS_PER_STAGE;
export const START_HP = 100;
/** Số giây cơ bản cho mỗi câu trong một tầng. */
export const SECONDS_PER_QUESTION = 20;
/** Sai quá tỉ lệ này trong một tầng → kết thúc nhẹ nhàng (không dùng ngôn từ thất bại). */
export const STOP_WRONG_RATIO = 0.4;

/** Tên 5 tầng theo vị trí làm việc trong dây chuyền điều hành bay. */
export const STAGE_NAMES = [
  "Tầng 1 · Sân đỗ (Apron)",
  "Tầng 2 · Mặt đất (GND)",
  "Tầng 3 · Đài kiểm soát (TWR)",
  "Tầng 4 · Tiếp cận (APP)",
  "Tầng 5 · Đường dài (ACC)",
] as const;

export function stageName(index: number): string {
  return STAGE_NAMES[index] ?? `Tầng ${index + 1}`;
}

export type Boon = {
  id: string;
  name: string;
  desc: string;
  rarity: "thuong" | "hiem";
  /** Ngôn ngữ hiệu ứng nhỏ: cộng thẳng vào chỉ số của phiên. */
  effect: { shield?: number; heal?: number; damageBonus?: number; timeBonus?: number };
};

/** 8 trợ giúp kíp trực (5 Thường + 3 Hiếm). Thêm mới chỉ cần nối vào mảng này. */
export const BOONS: Boon[] = [
  { id: "so-tay", name: "Sổ nhật ký kíp trực", desc: "+8 an toàn ngay", rarity: "thuong", effect: { heal: 8 } },
  { id: "ca-phe", name: "Ly cà phê ca đêm", desc: "+3 giây mỗi câu", rarity: "thuong", effect: { timeBonus: 3 } },
  { id: "but-do", name: "Strip bay đánh dấu", desc: "+2 điểm xử lý mỗi câu đúng", rarity: "thuong", effect: { damageBonus: 2 } },
  { id: "ao-phan-quang", name: "Áo phản quang sân đỗ", desc: "Lớp bảo vệ 10 an toàn", rarity: "thuong", effect: { shield: 10 } },
  { id: "tai-nghe", name: "Tai nghe VHF chống ồn", desc: "+5 an toàn, +1 giây", rarity: "thuong", effect: { heal: 5, timeBonus: 1 } },
  { id: "so-tay-vang", name: "Tài liệu Doc 4444", desc: "+20 an toàn", rarity: "hiem", effect: { heal: 20 } },
  { id: "radar", name: "Màn hình radar giám sát", desc: "+5 điểm xử lý mỗi câu đúng", rarity: "hiem", effect: { damageBonus: 5 } },
  { id: "giay-phep", name: "Huấn lệnh ưu tiên", desc: "Lớp bảo vệ 25 an toàn", rarity: "hiem", effect: { shield: 25 } },
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
