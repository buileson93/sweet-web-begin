/**
 * Hệ thống KỸ NĂNG của Đấu trường — logic THUẦN, không phụ thuộc Supabase/React.
 *
 * Luật:
 * - Mỗi đấu thủ có 3 kỹ năng, chọn TRƯỚC khi chốt đáp án của một câu.
 * - Dùng xong thì kỹ năng đó nghỉ 5 lượt câu hỏi (cooldown).
 * - Hiệu quả có tính ngẫu nhiên nên mỗi lần dùng một khác.
 */

export type SkillId = "cong_pha" | "chi_mang" | "khien_thep";

export type SkillDef = {
  id: SkillId;
  name: string;
  icon: string;
  /** "attack" đánh mạnh hơn khi mình gây sát thương, "defend" giảm sát thương nhận. */
  role: "attack" | "defend";
  description: string;
  /** Khoảng hiệu quả hiển thị cho người chơi (không dùng để tính toán). */
  range: string;
};

/** Số lượt câu hỏi phải chờ sau khi dùng một kỹ năng. */
export const SKILL_COOLDOWN_ROUNDS = 5;

export const SKILLS: SkillDef[] = [
  {
    id: "cong_pha",
    name: "Công phá",
    icon: "💥",
    role: "attack",
    description: "Cộng thêm 3–8 sát thương ngẫu nhiên cho đòn đánh của câu này.",
    range: "+3–8 sát thương",
  },
  {
    id: "chi_mang",
    name: "Chí mạng",
    icon: "🎯",
    role: "attack",
    description: "60% cơ hội nhân đôi sát thương; nếu hụt vẫn được +2.",
    range: "60% ×2 · hụt vẫn +2",
  },
  {
    id: "khien_thep",
    name: "Khiên thép",
    icon: "🛡️",
    role: "defend",
    description: "Chặn 30–70% sát thương phải nhận ở câu này.",
    range: "Chặn 30–70% sát thương",
  },
];

export function skillById(id: string | null | undefined): SkillDef | null {
  return SKILLS.find((s) => s.id === id) ?? null;
}

export type Rng = () => number;

function pick(rng: Rng, min: number, max: number) {
  const r = Math.min(0.999999, Math.max(0, rng()));
  return min + Math.floor(r * (max - min + 1));
}

/** Số lượt còn phải chờ của một kỹ năng (0 = dùng được ngay). */
export function skillCooldownLeft(
  usedRounds: number[],
  currentRound: number,
): number {
  if (!usedRounds.length) return 0;
  const last = Math.max(...usedRounds);
  const left = SKILL_COOLDOWN_ROUNDS - (currentRound - last);
  return Math.max(0, left);
}

export function skillReady(usedRounds: number[], currentRound: number): boolean {
  return skillCooldownLeft(usedRounds, currentRound) === 0;
}

export type SkillEffect = {
  damage: number;
  /** Mô tả ngắn để hiện lên giao diện và ghi vào nhật ký trận. */
  label: string;
};

/** Áp kỹ năng tấn công lên sát thương gốc. */
export function applyAttackSkill(
  skill: SkillId | null | undefined,
  baseDamage: number,
  rng: Rng = Math.random,
): SkillEffect {
  const base = Math.max(0, Math.round(baseDamage));
  if (!skill || base <= 0) return { damage: base, label: "" };
  if (skill === "cong_pha") {
    const bonus = pick(rng, 3, 8);
    return { damage: base + bonus, label: `💥 Công phá +${bonus}` };
  }
  if (skill === "chi_mang") {
    const hit = rng() < 0.6;
    return hit
      ? { damage: base * 2, label: "🎯 Chí mạng! Sát thương nhân đôi" }
      : { damage: base + 2, label: "🎯 Chí mạng hụt, chỉ được +2" };
  }
  return { damage: base, label: "" };
}

/** Áp kỹ năng phòng thủ lên sát thương sắp phải nhận. */
export function applyDefenseSkill(
  skill: SkillId | null | undefined,
  incoming: number,
  rng: Rng = Math.random,
): SkillEffect {
  const dmg = Math.max(0, Math.round(incoming));
  if (skill !== "khien_thep" || dmg <= 0) return { damage: dmg, label: "" };
  const percent = pick(rng, 30, 70);
  const blocked = Math.round((dmg * percent) / 100);
  return { damage: Math.max(0, dmg - blocked), label: `🛡️ Khiên thép chặn ${blocked} sát thương` };
}
