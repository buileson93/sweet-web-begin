/**
 * Bản đồ phân nhánh 12 tầng — sinh hoàn toàn từ hạt ngẫu nhiên nên tái lập được.
 *
 * Nguyên tắc thiết kế:
 * - Mỗi tầng thường có 2–3 phòng khác loại để lựa chọn luôn có ý nghĩa.
 * - Tầng 4 / 8 / 12 là trùm (bắt buộc, một phòng duy nhất).
 * - Tầng ngay trước trùm LUÔN có lửa trại để người chơi kịp chuẩn bị.
 */
import { branch } from "@/lib/tower/rng";

export type RoomKind = "combat" | "elite" | "event" | "shop" | "campfire" | "boss";

export type Room = {
  kind: RoomKind;
  /** Số câu hỏi phải trả lời trong phòng (phòng không giao tranh = 0). */
  questions: number;
  /** Bậc khó cộng thêm khi chọn câu hỏi. */
  harder: number;
};

export const FLOORS = 12;
/** Tầng trùm, đánh số từ 1. */
export const BOSS_FLOORS = [4, 8, 12] as const;
const PRE_BOSS = BOSS_FLOORS.map((f) => f - 1);

export const ROOM_META: Record<RoomKind, { icon: string; label: string; desc: string; tone: string }> = {
  combat: { icon: "⚔️", label: "Giao tranh", desc: "Bot thường · 5 câu", tone: "text-primary" },
  elite: { icon: "💀", label: "Tinh anh", desc: "Bot mạnh · 7 câu · khó hơn một bậc", tone: "text-destructive" },
  event: { icon: "❓", label: "Sự kiện", desc: "Lựa chọn bất ngờ: rương bẫy, hiến máu, câu đố", tone: "text-amber-500" },
  shop: { icon: "🏪", label: "Cửa hàng", desc: "Mua di vật, gỡ lời nguyền, hồi máu bằng xu", tone: "text-emerald-500" },
  campfire: { icon: "🔥", label: "Lửa trại", desc: "Hồi 30% máu hoặc nâng cấp một di vật", tone: "text-orange-500" },
  boss: { icon: "👑", label: "Trùm", desc: "Bắt buộc — có luật riêng", tone: "text-yellow-500" },
};

const ROOM: Record<RoomKind, Room> = {
  combat: { kind: "combat", questions: 5, harder: 0 },
  elite: { kind: "elite", questions: 7, harder: 1 },
  event: { kind: "event", questions: 0, harder: 0 },
  shop: { kind: "shop", questions: 0, harder: 0 },
  campfire: { kind: "campfire", questions: 0, harder: 0 },
  boss: { kind: "boss", questions: 7, harder: 1 },
};

/** Bể phòng theo độ sâu: càng lên cao càng nhiều tinh anh. */
function poolFor(floor: number): RoomKind[] {
  if (floor <= 3) return ["combat", "combat", "event", "shop", "campfire"];
  if (floor <= 7) return ["combat", "elite", "event", "shop", "campfire"];
  return ["combat", "elite", "elite", "event", "shop", "campfire"];
}

/**
 * Sinh bản đồ: trả về mảng 12 tầng, mỗi tầng là danh sách phòng để chọn.
 * Cùng một hạt luôn cho cùng một bản đồ — nền tảng của thử thách hằng ngày.
 */
export function buildMap(seed: string): Room[][] {
  const floors: Room[][] = [];
  for (let f = 1; f <= FLOORS; f++) {
    if ((BOSS_FLOORS as readonly number[]).includes(f)) {
      floors.push([{ ...ROOM.boss }]);
      continue;
    }
    const rand = branch(seed, `map-floor-${f}`);
    const picks: RoomKind[] = [];
    // Tầng ngay trước trùm luôn có lửa trại: chuẩn bị được thì thua mới là do chơi dở.
    if (PRE_BOSS.includes(f)) picks.push("campfire");

    const pool = poolFor(f).filter((k) => !picks.includes(k));
    const want = picks.length + (rand() < 0.5 ? 1 : 2);
    while (picks.length < Math.min(3, want) && pool.length) {
      const i = Math.floor(rand() * pool.length) % pool.length;
      const kind = pool.splice(i, 1)[0]!;
      if (picks.includes(kind)) continue;
      picks.push(kind);
    }
    // Luôn còn ít nhất một phòng có câu hỏi để hành trình không đứng yên.
    if (!picks.some((k) => ROOM[k].questions > 0)) picks.push("combat");
    floors.push(picks.map((k) => ({ ...ROOM[k] })));
  }
  return floors;
}

export const isBossFloor = (floor: number) => (BOSS_FLOORS as readonly number[]).includes(floor);

/**
 * Bộ nhớ đệm bản đồ theo hạt — sinh bản đồ là việc thuần nhưng tốn vài nghìn phép,
 * gọi lại mỗi lần đổi tầng sẽ gây giật. Giữ tối đa 8 hạt gần nhất là đủ.
 */
const MAP_CACHE = new Map<string, Room[][]>();
const MAP_CACHE_MAX = 8;

export function mapFor(seed: string): Room[][] {
  const hit = MAP_CACHE.get(seed);
  if (hit) return hit;
  const built = buildMap(seed);
  MAP_CACHE.set(seed, built);
  if (MAP_CACHE.size > MAP_CACHE_MAX) {
    const oldest = MAP_CACHE.keys().next().value;
    if (oldest !== undefined) MAP_CACHE.delete(oldest);
  }
  return built;
}
