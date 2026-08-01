/**
 * Tiến trình meta — thứ giữ chân người chơi giữa các hành trình.
 *
 * Nguyên tắc: tín chỉ chỉ dùng để MỞ RỘNG lựa chọn (mở trang bị mới vào bể rút, mở lớp,
 * mở độ thăng thiên), tuyệt đối không bán sức mạnh trực tiếp — tránh cảm giác trả tiền để thắng.
 */
import { RELICS } from "@/lib/tower/relics";

export type UnlockKind = "relic" | "class" | "ascension";

export type Unlock = {
  id: string;
  kind: UnlockKind;
  name: string;
  desc: string;
  cost: number;
  /** Điều kiện mở: cần thắng hành trình ít nhất N lần. */
  needWins?: number;
};

/** Trang bị khoá sẵn — phải mở mới xuất hiện trong bể rút. */
export const LOCKED_RELIC_IDS = ["nghich-luu", "bao-to", "doc-4444", "khien-bang"];

export const UNLOCKS: Unlock[] = [
  ...LOCKED_RELIC_IDS.map((id) => {
    const r = RELICS.find((x) => x.id === id);
    return {
      id: `relic:${id}`,
      kind: "relic" as const,
      name: `${r?.icon ?? "🎁"} ${r?.name ?? id}`,
      desc: `Đưa trang bị vào bể rút: ${r?.desc ?? ""}`,
      cost: r?.rarity === "huyenthoai" ? 600 : 350,
    };
  }),
  { id: "class:ky-su", kind: "class", name: "🛠️ Kỹ sư trực canh", desc: "Lớp thứ 4: khởi đầu với lớp bảo vệ 20 an toàn", cost: 500 },
  { id: "class:hoa-tieu", kind: "class", name: "🧭 Hoa tiêu", desc: "Lớp thứ 5: +10% thời gian mỗi câu", cost: 800 },
  { id: "ascension", kind: "ascension", name: "🌗 Độ thăng thiên", desc: "Mở cấp khó 1→10, mỗi cấp thêm một luật khó hơn", cost: 0, needWins: 1 },
];

/** Bể trang bị khả dụng theo danh sách đã mở khoá. */
export function relicPoolIds(unlocked: string[]): string[] {
  return RELICS.filter((r) => !LOCKED_RELIC_IDS.includes(r.id) || unlocked.includes(`relic:${r.id}`)).map((r) => r.id);
}

/** Luật thêm vào theo cấp thăng thiên (1→10). */
export const ASCENSION_RULES: string[] = [
  "Cấp 1 — An toàn khởi đầu −10",
  "Cấp 2 — Điểm xử lý nhận +10%",
  "Cấp 3 — Phòng nghỉ ca chỉ hồi 20% an toàn",
  "Cấp 4 — Tình huống phức tạp xuất hiện dày hơn",
  "Cấp 5 — Thời gian mỗi câu −10%",
  "Cấp 6 — Kho khí tài đắt thêm 50%",
  "Cấp 7 — Sự cố lớn thêm 20% an toàn",
  "Cấp 8 — Bắt buộc mang 1 yếu tố bất lợi",
  "Cấp 9 — Chỉ còn 2 trang bị để chọn",
  "Cấp 10 — An toàn khởi đầu −25, không hồi sinh",
];

export type AscensionMods = {
  startHpDelta: number;
  damageTakenPct: number;
  campfireHealPct: number;
  timePct: number;
  shopCostPct: number;
  bossHpPct: number;
  forcedCurse: boolean;
  relicChoices: number;
  noRevive: boolean;
};

export function ascensionMods(level: number): AscensionMods {
  const lv = Math.max(0, Math.min(10, Math.round(level)));
  return {
    startHpDelta: (lv >= 10 ? -25 : lv >= 1 ? -10 : 0),
    damageTakenPct: lv >= 2 ? 0.1 : 0,
    campfireHealPct: lv >= 3 ? 0.2 : 0.3,
    timePct: lv >= 5 ? -0.1 : 0,
    shopCostPct: lv >= 6 ? 0.5 : 0,
    bossHpPct: lv >= 7 ? 0.2 : 0,
    forcedCurse: lv >= 8,
    relicChoices: lv >= 9 ? 2 : 3,
    noRevive: lv >= 10,
  };
}

export function canBuy(unlock: Unlock, coins: number, wins: number, owned: string[]): boolean {
  if (owned.includes(unlock.id)) return false;
  if (unlock.needWins && wins < unlock.needWins) return false;
  return coins >= unlock.cost;
}
