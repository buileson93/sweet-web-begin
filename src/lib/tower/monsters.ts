/**
 * HỆ SINH THÁI QUÁI VẬT (SỰ CỐ) CỦA LEO THÁP.
 *
 * Kế thừa 3 lớp nhân vật của Đấu trường (Kiếm sĩ · Pháp sư · Vệ binh) nhưng
 * thay vì đánh nhau giữa người với người, người chơi đánh với "sự cố" bằng
 * cách trả lời câu hỏi:
 * - Trả lời ĐÚNG  → nhân vật ra đòn, sát thương nhân theo CÔNG của lớp và hệ khắc chế.
 * - Trả lời SAI   → quái phản đòn, sát thương nhân theo mức quái và chia theo THỦ của lớp.
 *
 * Vòng khắc hệ (kiểu bao–búa–kéo):
 *   Thời tiết (bão)   ← Vệ binh khắc   → mạnh với Pháp sư
 *   Kỹ thuật (nhiễu)  ← Pháp sư khắc   → mạnh với Kiếm sĩ
 *   Con người (áp lực)← Kiếm sĩ khắc   → mạnh với Vệ binh
 *
 * Toàn bộ file là logic THUẦN: không React, không mạng, không Supabase.
 */
import { classById, type ClassId } from "@/lib/arena/classes";
import type { RoomKind } from "@/lib/tower/map";

export type ElementId = "thoi_tiet" | "ky_thuat" | "con_nguoi";

export type ElementDef = {
  id: ElementId;
  name: string;
  icon: string;
  /** Lớp khắc chế hệ này (đánh mạnh hơn). */
  weakTo: ClassId;
  /** Lớp bị hệ này khắc chế (nhận đòn đau hơn). */
  strongVs: ClassId;
  tone: string;
};

export const ELEMENTS: Record<ElementId, ElementDef> = {
  thoi_tiet: {
    id: "thoi_tiet",
    name: "Thời tiết",
    icon: "🌩️",
    weakTo: "ve_binh",
    strongVs: "phap_su",
    tone: "text-sky-500",
  },
  ky_thuat: {
    id: "ky_thuat",
    name: "Kỹ thuật",
    icon: "📡",
    weakTo: "phap_su",
    strongVs: "kiem_si",
    tone: "text-violet-500",
  },
  con_nguoi: {
    id: "con_nguoi",
    name: "Con người",
    icon: "🧠",
    weakTo: "kiem_si",
    strongVs: "ve_binh",
    tone: "text-amber-500",
  },
};

/** Bậc quái: càng cao càng nhiều máu và đánh đau hơn. */
export type MonsterTier = 1 | 2 | 3 | 4;

export type MonsterDef = {
  id: string;
  name: string;
  icon: string;
  element: ElementId;
  tier: MonsterTier;
  /** Máu cơ bản của quái (nhân thêm theo tầng). */
  hp: number;
  /** Hệ số sát thương quái gây ra khi người chơi trả lời sai. */
  power: number;
  /** Câu đe doạ ngắn hiển thị khi vào phòng. */
  taunt: string;
  /** Kiểu hoạt ảnh riêng của quái. */
  motion: "float" | "stomp" | "swarm" | "pulse" | "storm";
};

/** Sổ tay sự cố — thêm quái chỉ cần nối vào mảng này. */
export const MONSTERS: MonsterDef[] = [
  // ---- Bậc 1: sự cố nhỏ, đánh nhẹ ----
  { id: "gio-canh", name: "Gió cạnh sườn", icon: "🌬️", element: "thoi_tiet", tier: 1, hp: 40, power: 0.8, taunt: "Gió giật ngang đường CHC.", motion: "float" },
  { id: "nhieu-song", name: "Nhiễu sóng lẻ", icon: "📻", element: "ky_thuat", tier: 1, hp: 42, power: 0.8, taunt: "Tiếng lạo xạo chen vào tần số.", motion: "pulse" },
  { id: "doc-lech", name: "Đọc lệch huấn lệnh", icon: "🗣️", element: "con_nguoi", tier: 1, hp: 38, power: 0.85, taunt: "Tổ lái nhắc lại sai một con số.", motion: "swarm" },

  // ---- Bậc 2: sự cố thường gặp ----
  { id: "may-thap", name: "Mây thấp mù sương", icon: "🌫️", element: "thoi_tiet", tier: 2, hp: 70, power: 1.0, taunt: "Tầm nhìn tụt dưới mức tối thiểu.", motion: "float" },
  { id: "radar-chop", name: "Radar chớp nháy", icon: "📡", element: "ky_thuat", tier: 2, hp: 72, power: 1.05, taunt: "Vệt mục tiêu biến mất từng nhịp quét.", motion: "pulse" },
  { id: "qua-tai-kip", name: "Quá tải kíp trực", icon: "😵‍💫", element: "con_nguoi", tier: 2, hp: 68, power: 1.1, taunt: "Bốn cuộc gọi ập đến cùng lúc.", motion: "swarm" },

  // ---- Bậc 3: tình huống phức tạp ----
  { id: "doi-gio-dut", name: "Đứt gió tầng thấp", icon: "🌀", element: "thoi_tiet", tier: 3, hp: 110, power: 1.3, taunt: "Windshear cảnh báo trên ngưỡng.", motion: "storm" },
  { id: "mat-lien-lac", name: "Mất liên lạc vô tuyến", icon: "🔇", element: "ky_thuat", tier: 3, hp: 115, power: 1.35, taunt: "Tàu bay im lặng suốt hai vòng gọi.", motion: "pulse" },
  { id: "xam-nhap-duong", name: "Xâm nhập đường CHC", icon: "🚧", element: "con_nguoi", tier: 3, hp: 108, power: 1.4, taunt: "Có xe lăn vào khi chưa được phép.", motion: "stomp" },

  // ---- Bậc 4: sự cố lớn (trùm tầng) ----
  { id: "bao-dien-rong", name: "Bão điện diện rộng", icon: "⛈️", element: "thoi_tiet", tier: 4, hp: 190, power: 1.6, taunt: "Cả vùng trời chuyển sang phương án dự phòng.", motion: "storm" },
  { id: "sap-he-thong", name: "Sập hệ thống giám sát", icon: "🖥️", element: "ky_thuat", tier: 4, hp: 200, power: 1.65, taunt: "Màn hình tối đen, chuyển sang phương thức thoại.", motion: "pulse" },
  { id: "khan-nguy", name: "Tàu bay khẩn nguy", icon: "🆘", element: "con_nguoi", tier: 4, hp: 210, power: 1.7, taunt: "MAYDAY — mọi ưu tiên dồn về một tàu bay.", motion: "stomp" },
];

export const monsterById = (id: string | null | undefined): MonsterDef | undefined =>
  MONSTERS.find((m) => m.id === id);

/** Bậc quái phù hợp với loại phòng và độ sâu của tầng. */
export function tierFor(kind: RoomKind, floor: number): MonsterTier {
  if (kind === "boss") return 4;
  if (kind === "elite") return floor >= 9 ? 4 : 3;
  if (floor >= 9) return 3;
  if (floor >= 5) return 2;
  return 1;
}

/** Máu quái tăng dần theo tầng (mỗi tầng +6%). */
export function monsterMaxHp(def: MonsterDef, floor: number): number {
  return Math.max(20, Math.round(def.hp * (1 + Math.max(0, floor - 1) * 0.06)));
}

export type MonsterInstance = {
  id: string;
  hp: number;
  maxHp: number;
  floor: number;
};

/** Bốc một con quái đúng bậc bằng RNG có hạt (cùng hạt → cùng quái). */
export function pickMonster(rand: () => number, kind: RoomKind, floor: number): MonsterInstance {
  const tier = tierFor(kind, floor);
  const pool = MONSTERS.filter((m) => m.tier === tier);
  const list = pool.length ? pool : MONSTERS;
  const def = list[Math.floor(rand() * list.length) % list.length]!;
  const maxHp = monsterMaxHp(def, floor);
  return { id: def.id, hp: maxHp, maxHp, floor };
}

export type Affinity = "khac_che" | "bi_khac" | "can_bang";

/** Xét khắc hệ giữa lớp nhân vật và hệ của quái. */
export function affinityOf(classId: string | null | undefined, element: ElementId): Affinity {
  const cls = classById(classId).id;
  const el = ELEMENTS[element];
  if (el.weakTo === cls) return "khac_che";
  if (el.strongVs === cls) return "bi_khac";
  return "can_bang";
}

/** Mức thưởng/phạt của khắc hệ (25%). */
export const AFFINITY_BONUS = 0.25;

export type HitResult = {
  damage: number;
  affinity: Affinity;
  /** Diễn giải ngắn hiển thị trên giao diện. */
  label: string;
};

/**
 * Sát thương người chơi gây ra khi trả lời ĐÚNG:
 * công của lớp × khắc hệ.
 */
export function heroHit(classId: string | null | undefined, def: MonsterDef, base: number): HitResult {
  const cls = classById(classId);
  const affinity = affinityOf(classId, def.element);
  const mul = affinity === "khac_che" ? 1 + AFFINITY_BONUS : affinity === "bi_khac" ? 1 - AFFINITY_BONUS : 1;
  const damage = Math.max(1, Math.round(Math.max(0, base) * cls.attackMul * mul));
  const el = ELEMENTS[def.element];
  const label =
    affinity === "khac_che"
      ? `${cls.icon} ${cls.name} khắc hệ ${el.name} — đòn mạnh hơn`
      : affinity === "bi_khac"
        ? `${el.icon} Hệ ${el.name} cản đòn của ${cls.name}`
        : "";
  return { damage, affinity, label };
}

/**
 * Sát thương quái gây ra khi trả lời SAI:
 * mức quái × bậc × thủ của lớp × khắc hệ (ngược chiều).
 */
export function monsterHit(
  classId: string | null | undefined,
  def: MonsterDef,
  base: number,
  floor: number,
): HitResult {
  const cls = classById(classId);
  const affinity = affinityOf(classId, def.element);
  // Bị khắc thì ăn đòn đau hơn; mình khắc lại nó thì đỡ đau hơn.
  const mul = affinity === "bi_khac" ? 1 + AFFINITY_BONUS : affinity === "khac_che" ? 1 - AFFINITY_BONUS : 1;
  const depth = 1 + Math.max(0, floor - 1) * 0.03;
  const damage = Math.max(1, Math.round(Math.max(0, base) * def.power * depth * cls.defenseMul * mul));
  const el = ELEMENTS[def.element];
  const label =
    affinity === "bi_khac"
      ? `${el.icon} Hệ ${el.name} khắc ${cls.name} — đòn nặng hơn`
      : affinity === "khac_che"
        ? `${cls.icon} ${cls.name} hoá giải bớt đòn hệ ${el.name}`
        : "";
  return { damage, affinity, label };
}

/** Bảng chỉ số ngắn gọn của lớp để hiện ở màn chọn nhân vật Leo Tháp. */
export function classTowerStats(classId: string | null | undefined) {
  const cls = classById(classId);
  const counter = (Object.values(ELEMENTS).find((e) => e.weakTo === cls.id) ?? ELEMENTS.thoi_tiet);
  const weak = (Object.values(ELEMENTS).find((e) => e.strongVs === cls.id) ?? ELEMENTS.ky_thuat);
  return {
    cls,
    /** Sát thương gây ra so với chuẩn, tính theo phần trăm. */
    attackPct: Math.round((cls.attackMul - 1) * 100),
    /** Sát thương phải nhận so với chuẩn (âm là chịu đòn tốt). */
    defensePct: Math.round((cls.defenseMul - 1) * 100),
    counter,
    weak,
  };
}
