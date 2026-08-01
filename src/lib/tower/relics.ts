/**
 * Trang bị (Relics) — trụ cột tạo sự đa dạng của Tháp Không Lưu.
 *
 * Nguyên tắc: trang bị chỉ sống trong MỘT hành trình, hiệu ứng bị động và cộng dồn.
 * Mỗi món thuộc một hệ (Hoả / Băng / Trí); gom đủ 3 món cùng hệ được thưởng bộ,
 * nhờ vậy "chọn 1 trong 3" là chọn món hợp lối chơi chứ không phải chọn món mạnh nhất.
 */

export type Rarity = "thuong" | "hiem" | "suthi" | "huyenthoai";
export type Element = "hoa" | "bang" | "tri";

export type RelicEffect = {
  /** Cộng phần trăm thời gian mỗi câu (0.25 = +25%). */
  timePct?: number;
  /** Giảm phần trăm rủi ro phải nhận (0.12 = −12%). */
  damageReducePct?: number;
  /** Mỗi viên lượt bốc thăm tính tối thiểu N mặt. */
  minRoll?: number;
  /** Câu Khó gây thêm điểm xử lý. */
  hardBonus?: number;
  /** Phản lại phần trăm điểm xử lý vừa nhận. */
  reflectPct?: number;
  /** Mỗi bậc combo cộng thêm điểm xử lý. */
  comboDamage?: number;
  /** Dưới 30% an toàn thì điểm xử lý nhân thêm phần trăm này. */
  lowHpRagePct?: number;
  /** Mỗi tầng chặn đứng N đòn. */
  blockPerFloor?: number;
  /** Lần đầu phải dừng ca hồi sinh với phần trăm an toàn này. */
  revivePct?: number;
  /** Cộng thẳng điểm xử lý mỗi câu đúng. */
  damageBonus?: number;
  /** Lớp bảo vệ nhận ngay khi lấy trang bị. */
  shield?: number;
  /** Hồi an toàn ngay khi lấy trang bị. */
  heal?: number;
  /** Cộng phần trăm tín chỉ nhặt được. */
  coinPct?: number;
};

export type Relic = {
  id: string;
  icon: string;
  name: string;
  desc: string;
  rarity: Rarity;
  element: Element;
  effect: RelicEffect;
};

export const RARITY_LABEL: Record<Rarity, string> = {
  thuong: "Thường",
  hiem: "Hiếm",
  suthi: "Sử thi",
  huyenthoai: "Huyền thoại",
};

export const ELEMENT_LABEL: Record<Element, string> = {
  hoa: "⚡ Tác nghiệp",
  bang: "🛡️ An toàn",
  tri: "🧠 Chuyên môn",
};

export const RELICS: Relic[] = [
  // ——— Thường
  { id: "dong-ho-cat", icon: "⏳", name: "Đồng hồ đếm ngược", desc: "+25% thời gian mỗi câu", rarity: "thuong", element: "tri", effect: { timePct: 0.25 } },
  { id: "giap-da", icon: "🪨", name: "Quy trình chuẩn SOP", desc: "−12% rủi ro phải nhận", rarity: "thuong", element: "bang", effect: { damageReducePct: 0.12 } },
  { id: "strip-bay", icon: "🖊️", name: "Strip bay đánh dấu", desc: "+2 điểm xử lý mỗi câu đúng", rarity: "thuong", element: "hoa", effect: { damageBonus: 2 } },
  { id: "ao-phan-quang", icon: "🦺", name: "Áo phản quang", desc: "Lớp bảo vệ 10 an toàn", rarity: "thuong", element: "bang", effect: { shield: 10 } },
  { id: "so-tay-kip", icon: "📓", name: "Sổ nhật ký kíp trực", desc: "+8 an toàn ngay", rarity: "thuong", element: "tri", effect: { heal: 8 } },
  { id: "ca-phe", icon: "☕", name: "Ly cà phê ca đêm", desc: "+10% thời gian, +1 điểm xử lý", rarity: "thuong", element: "hoa", effect: { timePct: 0.1, damageBonus: 1 } },

  // ——— Hiếm
  { id: "xuc-xac-chi", icon: "🎲", name: "Bảng phân cách chuẩn", desc: "Mỗi viên lượt bốc thăm tính tối thiểu 3 mặt", rarity: "hiem", element: "hoa", effect: { minRoll: 3 } },
  { id: "sach-co", icon: "📖", name: "Tài liệu nghiệp vụ", desc: "Câu Khó gây thêm 5 điểm xử lý", rarity: "hiem", element: "tri", effect: { hardBonus: 5 } },
  { id: "guong-phan", icon: "🪞", name: "Phản hồi hai chiều", desc: "Phản 20% rủi ro phải nhận", rarity: "hiem", element: "bang", effect: { reflectPct: 0.2 } },
  { id: "da-cong-huong", icon: "💎", name: "Ăn khớp kíp trực", desc: "Mỗi bậc combo +2 điểm xử lý", rarity: "hiem", element: "hoa", effect: { comboDamage: 2 } },
  { id: "radar", icon: "📡", name: "Màn hình radar", desc: "+5 điểm xử lý mỗi câu đúng", rarity: "hiem", element: "tri", effect: { damageBonus: 5 } },
  { id: "huan-lenh", icon: "📜", name: "Huấn lệnh ưu tiên", desc: "Lớp bảo vệ 25 an toàn", rarity: "hiem", element: "bang", effect: { shield: 25 } },
  { id: "tui-tín chỉ", icon: "💰", name: "Quỹ khen thưởng", desc: "+40% tín chỉ nhặt được", rarity: "hiem", element: "tri", effect: { coinPct: 0.4 } },

  // ——— Sử thi
  { id: "ngon-lua", icon: "🔥", name: "Bản lĩnh cao điểm", desc: "Dưới 30% an toàn → điểm xử lý +50%", rarity: "suthi", element: "hoa", effect: { lowHpRagePct: 0.5 } },
  { id: "khien-bang", icon: "❄️", name: "Vùng đệm an toàn", desc: "Mỗi tầng chặn đứng 1 đòn", rarity: "suthi", element: "bang", effect: { blockPerFloor: 1 } },
  { id: "doc-4444", icon: "📘", name: "Tài liệu Doc 4444", desc: "+20 an toàn, câu Khó +3 điểm xử lý", rarity: "suthi", element: "tri", effect: { heal: 20, hardBonus: 3 } },

  // ——— Huyền thoại
  { id: "nghich-luu", icon: "🌀", name: "Phương án dự phòng", desc: "Lần đầu phải dừng ca → hồi sinh 40% an toàn", rarity: "huyenthoai", element: "bang", effect: { revivePct: 0.4 } },
  { id: "bao-to", icon: "🌪️", name: "Phối hợp tần số", desc: "+4 điểm xử lý, +1 điểm xử lý mỗi bậc combo", rarity: "huyenthoai", element: "hoa", effect: { damageBonus: 4, comboDamage: 1 } },
];

export const relicById = (id: string): Relic | undefined => RELICS.find((r) => r.id === id);

/** Thưởng bộ: gom đủ 3 món cùng hệ trong một hành trình. */
export const SET_BONUS: Record<Element, { name: string; desc: string; effect: RelicEffect }> = {
  hoa: { name: "Nhóm Tác nghiệp — Nhịp nhàng", desc: "+3 điểm xử lý mỗi câu đúng", effect: { damageBonus: 3 } },
  bang: { name: "Nhóm An toàn — Vững vàng", desc: "−10% rủi ro phải nhận", effect: { damageReducePct: 0.1 } },
  tri: { name: "Nhóm Chuyên môn — Tỉnh táo", desc: "+15% thời gian mỗi câu", effect: { timePct: 0.15 } },
};

export function activeSets(ids: string[]): Element[] {
  const count: Record<string, number> = {};
  for (const id of ids) {
    const r = relicById(id);
    if (r) count[r.element] = (count[r.element] ?? 0) + 1;
  }
  return (Object.keys(count) as Element[]).filter((e) => (count[e] ?? 0) >= 3);
}

export type RelicTotals = Required<Omit<RelicEffect, never>>;

const ZERO: RelicTotals = {
  timePct: 0,
  damageReducePct: 0,
  minRoll: 1,
  hardBonus: 0,
  reflectPct: 0,
  comboDamage: 0,
  lowHpRagePct: 0,
  blockPerFloor: 0,
  revivePct: 0,
  damageBonus: 0,
  shield: 0,
  heal: 0,
  coinPct: 0,
};

function merge(acc: RelicTotals, e: RelicEffect): RelicTotals {
  return {
    timePct: acc.timePct + (e.timePct ?? 0),
    damageReducePct: acc.damageReducePct + (e.damageReducePct ?? 0),
    minRoll: Math.max(acc.minRoll, e.minRoll ?? 1),
    hardBonus: acc.hardBonus + (e.hardBonus ?? 0),
    reflectPct: acc.reflectPct + (e.reflectPct ?? 0),
    comboDamage: acc.comboDamage + (e.comboDamage ?? 0),
    lowHpRagePct: Math.max(acc.lowHpRagePct, e.lowHpRagePct ?? 0),
    blockPerFloor: acc.blockPerFloor + (e.blockPerFloor ?? 0),
    revivePct: Math.max(acc.revivePct, e.revivePct ?? 0),
    damageBonus: acc.damageBonus + (e.damageBonus ?? 0),
    shield: acc.shield + (e.shield ?? 0),
    heal: acc.heal + (e.heal ?? 0),
    coinPct: acc.coinPct + (e.coinPct ?? 0),
  };
}

/** Cộng dồn toàn bộ hiệu ứng trang bị, đã tính thưởng bộ 3 món cùng hệ. */
export function relicTotals(ids: string[]): RelicTotals {
  let acc = { ...ZERO };
  for (const id of ids) {
    const r = relicById(id);
    if (r) acc = merge(acc, r.effect);
  }
  for (const el of activeSets(ids)) acc = merge(acc, SET_BONUS[el].effect);
  return acc;
}

/** Trọng số rút theo bậc hiếm, thay đổi theo loại phòng vừa vượt qua. */
const WEIGHTS: Record<"thuong" | "tinh-anh" | "trum", Record<Rarity, number>> = {
  "thuong": { thuong: 60, hiem: 32, suthi: 7, huyenthoai: 1 },
  "tinh-anh": { thuong: 25, hiem: 50, suthi: 20, huyenthoai: 5 },
  "trum": { thuong: 5, hiem: 40, suthi: 40, huyenthoai: 15 },
};

/** Rút 3 trang bị theo trọng số hiếm, loại các món đang sở hữu. */
export function offerRelics(
  rand: () => number,
  owned: string[] = [],
  tier: keyof typeof WEIGHTS = "thuong",
  count = 3,
): Relic[] {
  const pool = RELICS.filter((r) => !owned.includes(r.id));
  const out: Relic[] = [];
  const table = WEIGHTS[tier];
  while (out.length < count && pool.length) {
    const left = pool.filter((r) => !out.includes(r));
    if (!left.length) break;
    const total = left.reduce((s, r) => s + table[r.rarity], 0);
    let ticket = rand() * total;
    let picked = left[left.length - 1]!;
    for (const r of left) {
      ticket -= table[r.rarity];
      if (ticket <= 0) {
        picked = r;
        break;
      }
    }
    out.push(picked);
  }
  return out;
}
