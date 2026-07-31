/**
 * LỚP CHIẾN BINH của Đấu trường — logic THUẦN, không phụ thuộc Supabase/React.
 *
 * Luật:
 * - Trước khi vào trận, mỗi người chọn 1 trong 3 lớp.
 * - Mỗi lớp có ưu / nhược riêng về công và thủ.
 * - Có vòng khắc chế kiểu bao–búa–kéo: lớp khắc chế đối phương được cộng
 *   thêm sát thương, lớp bị khắc chế bị trừ bớt.
 *
 * Tính chất (theo phản hồi người dùng):
 * - Kiếm sĩ  : công thủ toàn diện, không nổi trội mặt nào.
 * - Pháp sư  : sát thương cao nhất, đổi lại nhận đòn đau hơn.
 * - Vệ binh  : chịu đòn tốt nhất, ra đòn nhẹ hơn.
 */

export type ClassId = "kiem_si" | "phap_su" | "ve_binh";

export type ClassDef = {
  id: ClassId;
  name: string;
  icon: string;
  /** Câu mô tả ngắn hiện ở màn chọn lớp. */
  tagline: string;
  /** Hệ số sát thương gây ra (1 = chuẩn). */
  attackMul: number;
  /** Hệ số sát thương phải nhận (1 = chuẩn, nhỏ hơn 1 = thủ tốt). */
  defenseMul: number;
  /** Lớp bị lớp này khắc chế. */
  beats: ClassId;
  strength: string;
  weakness: string;
  /** Tông màu (token thiết kế) dùng cho hiệu ứng chiến đấu. */
  accent: string;
};

/** Mức cộng / trừ sát thương khi có khắc chế (bao–búa–kéo). */
export const COUNTER_BONUS = 0.2;

export const CLASSES: ClassDef[] = [
  {
    id: "kiem_si",
    name: "Kiếm sĩ",
    icon: "⚔️",
    tagline: "Công thủ toàn diện, ổn định trong mọi thế trận.",
    attackMul: 1.06,
    defenseMul: 0.96,
    beats: "phap_su",
    strength: "Công thủ toàn diện",
    weakness: "Không nổi trội mặt nào",
    accent: "primary",
  },
  {
    id: "phap_su",
    name: "Pháp sư",
    icon: "🔮",
    tagline: "Sát thương phép bùng nổ, nhưng thân mỏng.",
    attackMul: 1.18,
    defenseMul: 1.12,
    beats: "ve_binh",
    strength: "Sát thương cao nhất",
    weakness: "Nhận đòn đau hơn",
    accent: "warning",
  },
  {
    id: "ve_binh",
    name: "Vệ binh",
    icon: "🛡️",
    tagline: "Lì đòn, sống sót tới cuối để lật kèo.",
    attackMul: 0.95,
    defenseMul: 0.82,
    beats: "kiem_si",
    strength: "Chịu đòn tốt nhất",
    weakness: "Ra đòn nhẹ hơn",
    accent: "danger",
  },
];

export const DEFAULT_CLASS: ClassId = "kiem_si";

/** Mã lớp cũ (bản thử nghiệm) quy về 3 lớp chính thức. */
const LEGACY_ALIASES: Record<string, ClassId> = {
  cung_thu: "kiem_si",
  chien_binh: "ve_binh",
};

export function classById(id: string | null | undefined): ClassDef {
  const key = id ? (LEGACY_ALIASES[id] ?? id) : "";
  return CLASSES.find((c) => c.id === key) ?? CLASSES.find((c) => c.id === DEFAULT_CLASS)!;
}

export type CounterVerdict = "counter" | "countered" | "even";

/** Xét khắc chế giữa lớp của người đánh và lớp của người đỡ. */
export function counterVerdict(
  attacker: string | null | undefined,
  defender: string | null | undefined,
): CounterVerdict {
  const a = classById(attacker);
  const d = classById(defender);
  if (a.id === d.id) return "even";
  if (a.beats === d.id) return "counter";
  if (d.beats === a.id) return "countered";
  return "even";
}

export type ClassEffect = {
  damage: number;
  /** Diễn giải ngắn để hiện lên giao diện, rỗng nếu không đáng kể. */
  label: string;
  verdict: CounterVerdict;
};

/**
 * Áp hệ số lớp nhân vật lên sát thương của một đòn đánh.
 * Thứ tự: công của người đánh → thủ của người đỡ → khắc chế.
 */
export function applyClassDamage(
  attacker: string | null | undefined,
  defender: string | null | undefined,
  baseDamage: number,
): ClassEffect {
  const base = Math.max(0, Math.round(baseDamage));
  const verdict = counterVerdict(attacker, defender);
  if (base <= 0) return { damage: 0, label: "", verdict };

  const a = classById(attacker);
  const d = classById(defender);
  const counterMul =
    verdict === "counter" ? 1 + COUNTER_BONUS : verdict === "countered" ? 1 - COUNTER_BONUS : 1;

  const damage = Math.max(1, Math.round(base * a.attackMul * d.defenseMul * counterMul));
  const delta = damage - base;
  let label = "";
  if (verdict === "counter") label = `${a.icon} ${a.name} khắc chế ${d.name}`;
  else if (verdict === "countered") label = `${d.icon} ${d.name} hoá giải đòn ${a.name}`;
  else if (delta !== 0) label = `${a.icon} ${a.name} ${delta > 0 ? "+" : ""}${delta} sát thương`;

  return { damage, label, verdict };
}
