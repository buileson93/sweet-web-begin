/**
 * Yếu tố bất lợi — trục "rủi ro đổi phần thưởng" của Tháp Không Lưu.
 * Người chơi tự nguyện nhận để đổi lấy trang bị hiếm hơn hoặc tín chỉ.
 */
import type { RelicEffect } from "@/lib/tower/relics";

export type Curse = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  /** Bậc nặng nhẹ, dùng để tính điểm hành trình và mức thưởng. */
  rank: 1 | 2 | 3;
  effect: RelicEffect & { skillSlow?: number; noHeal?: boolean; silence?: boolean };
};

export const CURSES: Curse[] = [
  { id: "mu-suong", icon: "🌫️", name: "Tầm nhìn hạn chế", desc: "Thời gian mỗi câu −25%", rank: 2, effect: { timePct: -0.25 } },
  { id: "xieng-xich", icon: "⛓️", name: "Quá tải luồng bay", desc: "Kỹ năng hồi chậm thêm 3 lượt", rank: 1, effect: { skillSlow: 3 } },
  { id: "vet-thuong-ho", icon: "🩸", name: "Thiết bị trục trặc", desc: "Mọi nguồn hồi an toàn bị vô hiệu", rank: 3, effect: { noHeal: true } },
  { id: "long-tham", icon: "🤑", name: "Cao điểm dồn chuyến", desc: "Nhận điểm xử lý +20%, tín chỉ +60%", rank: 2, effect: { damageReducePct: -0.2, coinPct: 0.6 } },
  { id: "im-lang", icon: "🤫", name: "Mất liên lạc vô tuyến", desc: "Mất một kỹ năng ngẫu nhiên", rank: 1, effect: { silence: true } },
];

export const curseById = (id: string): Curse | undefined => CURSES.find((c) => c.id === id);

/** Tổng bậc yếu tố bất lợi đang mang — dùng trong công thức điểm hành trình. */
export function curseRank(ids: string[]): number {
  return ids.reduce((s, id) => s + (curseById(id)?.rank ?? 0), 0);
}

export function curseTotals(ids: string[]) {
  return ids.reduce(
    (acc, id) => {
      const c = curseById(id);
      if (!c) return acc;
      return {
        timePct: acc.timePct + (c.effect.timePct ?? 0),
        damageReducePct: acc.damageReducePct + (c.effect.damageReducePct ?? 0),
        coinPct: acc.coinPct + (c.effect.coinPct ?? 0),
        skillSlow: acc.skillSlow + (c.effect.skillSlow ?? 0),
        noHeal: acc.noHeal || Boolean(c.effect.noHeal),
        silence: acc.silence || Boolean(c.effect.silence),
      };
    },
    { timePct: 0, damageReducePct: 0, coinPct: 0, skillSlow: 0, noHeal: false, silence: false },
  );
}

/** Rút một yếu tố bất lợi chưa mang, kèm mức thưởng tín chỉ tương ứng bậc. */
export function offerCurse(rand: () => number, taken: string[] = []): { curse: Curse; coins: number } | null {
  const pool = CURSES.filter((c) => !taken.includes(c.id));
  if (!pool.length) return null;
  const curse = pool[Math.floor(rand() * pool.length) % pool.length]!;
  return { curse, coins: curse.rank * 40 };
}
