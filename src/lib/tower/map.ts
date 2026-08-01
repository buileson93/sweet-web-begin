/**
 * Bản đồ phân nhánh 12 tầng theo thuật toán roguelike kiểu Slay the Spire
 * (sinh nhiều lối đi trên lưới, gộp nút trùng, cấm hai cạnh cắt nhau).
 *
 * Cách sinh:
 * 1. Lưới FLOORS tầng × COLS cột.
 * 2. Thả PATHS lối đi từ tầng 1: mỗi bước lệch trái/giữa/phải một cột.
 * 3. Hai lối đi đi qua cùng một ô thì dùng chung một nút (gộp).
 * 4. Trước khi nối, kiểm tra cạnh mới có cắt cạnh đã có không; cắt thì kéo về gần.
 * 5. Gán loại phòng theo trọng số + ràng buộc (không trùng loại với phòng cha,
 *    cửa hàng/lửa trại không xuất hiện quá sớm, tầng trước trùm luôn là lửa trại).
 *
 * Cùng một hạt luôn cho cùng một bản đồ — nền tảng của thử thách hằng ngày.
 */
import { branch, pickWeighted } from "@/lib/tower/rng";

export type RoomKind = "combat" | "elite" | "event" | "shop" | "campfire" | "boss";

export type Room = {
  kind: RoomKind;
  /** Số câu hỏi trắc nghiệm phải trả lời trong phòng (phòng không giao tranh = 0). */
  questions: number;
  /** Bậc khó cộng thêm khi chọn câu hỏi. */
  harder: number;
};

/** Nút trên bản đồ: một phòng + vị trí cột + các nút có thể đi tiếp ở tầng trên. */
export type MapNode = Room & {
  /** Cột trên lưới, 0..COLS-1 — dùng để vẽ và để chống cắt đường. */
  col: number;
  /** Chỉ số các nút ở tầng kế tiếp mà nút này nối tới. */
  next: number[];
};

export const FLOORS = 12;
/** Số cột của lưới bản đồ. */
export const COLS = 5;
/** Số lối đi thả xuống lưới; càng nhiều thì bản đồ càng rậm. */
const PATHS = 6;
/** Tầng trùm, đánh số từ 1 — mỗi tầng này chỉ có duy nhất một nút (mọi lối hội tụ). */
export const BOSS_FLOORS = [4, 8, 12] as const;
const isBoss = (f: number) => (BOSS_FLOORS as readonly number[]).includes(f);
const PRE_BOSS = BOSS_FLOORS.map((f) => f - 1);

export const ROOM_META: Record<RoomKind, { icon: string; label: string; desc: string; tone: string }> = {
  combat: { icon: "⚔️", label: "Giao tranh", desc: "5 câu · sai −8 máu · đúng liên tiếp gây sát thương tăng dần", tone: "text-primary" },
  elite: { icon: "💀", label: "Tinh anh", desc: "7 câu khó hơn · sai −12 máu · thưởng di vật hiếm", tone: "text-destructive" },
  event: { icon: "❓", label: "Sự kiện", desc: "1 câu thử thách · đúng được thưởng · sai −5 máu", tone: "text-amber-500" },
  shop: { icon: "🏪", label: "Cửa hàng", desc: "1 câu mặc cả · đúng được giảm 30% giá · không mất máu", tone: "text-emerald-500" },
  campfire: { icon: "🔥", label: "Lửa trại", desc: "1 câu ôn bài · đúng hồi thêm máu · không mất máu", tone: "text-orange-500" },
  boss: { icon: "👑", label: "Trùm", desc: "7 câu · sai −15 máu · có luật riêng", tone: "text-yellow-500" },
};

const ROOM: Record<RoomKind, Room> = {
  combat: { kind: "combat", questions: 5, harder: 0 },
  elite: { kind: "elite", questions: 7, harder: 1 },
  event: { kind: "event", questions: 0, harder: 0 },
  shop: { kind: "shop", questions: 0, harder: 0 },
  campfire: { kind: "campfire", questions: 0, harder: 0 },
  boss: { kind: "boss", questions: 7, harder: 1 },
};

/** Trọng số loại phòng theo độ sâu — càng lên cao càng nhiều tinh anh. */
function weightsFor(floor: number): { item: RoomKind; weight: number }[] {
  const deep = floor >= 9 ? 2 : floor >= 5 ? 1 : 0;
  return [
    { item: "combat", weight: 46 - deep * 6 },
    { item: "event", weight: 22 },
    { item: "elite", weight: floor <= 2 ? 0 : 10 + deep * 6 },
    { item: "shop", weight: floor <= 2 ? 0 : 10 },
    { item: "campfire", weight: floor <= 3 ? 0 : 9 },
  ];
}

/** Hai cạnh (a→b) và (c→d) cắt nhau khi thứ tự cột đảo chiều. */
function crosses(a: number, b: number, c: number, d: number): boolean {
  return (a < c && b > d) || (a > c && b < d);
}

type Cell = { col: number; kind?: RoomKind; next: Set<number> };

export function buildMap(seed: string): MapNode[][] {
  const rand = branch(seed, "map-graph");
  // grid[f] = danh sách ô của tầng f (đánh số từ 0), sắp theo cột tăng dần ở cuối.
  const grid: Cell[][] = Array.from({ length: FLOORS }, () => []);
  const edges: { f: number; from: number; to: number }[] = [];

  const cellAt = (f: number, col: number): Cell => {
    const row = grid[f]!;
    const hit = row.find((c) => c.col === col);
    if (hit) return hit;
    const made: Cell = { col, next: new Set<number>() };
    row.push(made);
    return made;
  };

  // 1–3. Thả các lối đi, gộp nút trùng ô.
  for (let p = 0; p < PATHS; p++) {
    let col = Math.floor(rand() * COLS) % COLS;
    for (let f = 0; f < FLOORS; f++) {
      // Tầng trùm hội tụ về cột giữa.
      if (isBoss(f + 1)) col = Math.floor(COLS / 2);
      cellAt(f, col);
      if (f === FLOORS - 1) break;

      let nextCol = isBoss(f + 2) ? Math.floor(COLS / 2) : clamp(col + drift(rand));
      // 4. Tránh cạnh cắt nhau: kéo dần đích về cùng cột nếu phát hiện cắt.
      let guard = 0;
      while (
        !isBoss(f + 2) &&
        guard++ < COLS &&
        edges.some((e) => e.f === f && crosses(e.from, e.to, col, nextCol))
      ) {
        nextCol = nextCol > col ? nextCol - 1 : nextCol < col ? nextCol + 1 : col;
      }
      edges.push({ f, from: col, to: nextCol });
      cellAt(f + 1, nextCol);
      cellAt(f, col).next.add(nextCol);
      col = nextCol;
    }
  }

  // Sắp cột và chuyển cạnh "theo cột" thành cạnh "theo chỉ số nút".
  for (const row of grid) row.sort((a, b) => a.col - b.col);

  // 5. Gán loại phòng.
  for (let f = 0; f < FLOORS; f++) {
    const floor = f + 1;
    const kindRand = branch(seed, `map-kind-${floor}`);
    for (const cell of grid[f]!) {
      if (isBoss(floor)) {
        cell.kind = "boss";
        continue;
      }
      if (floor === 1) {
        cell.kind = "combat";
        continue;
      }
      if (PRE_BOSS.includes(floor)) {
        cell.kind = "campfire"; // Luôn có chỗ chuẩn bị trước khi gặp trùm.
        continue;
      }
      const parents = (grid[f - 1] ?? []).filter((p) => p.next.has(cell.col)).map((p) => p.kind);
      let kind: RoomKind = "combat";
      for (let tryIt = 0; tryIt < 8; tryIt++) {
        kind = pickWeighted(weightsFor(floor), kindRand) ?? "combat";
        const repeated = parents.includes(kind) && kind !== "combat" && kind !== "event";
        const twiceOnFloor =
          kind !== "combat" && kind !== "event" && grid[f]!.some((c) => c.kind === kind);
        if (!repeated && !twiceOnFloor) break;
      }
      cell.kind = kind;
    }
    // Mỗi tầng luôn còn ít nhất một phòng có câu hỏi giao tranh để hành trình không đứng yên.
    const row = grid[f]!;
    if (floor > 1 && !isBoss(floor) && !PRE_BOSS.includes(floor) && !row.some((c) => ROOM[c.kind!].questions > 0)) {
      row[0]!.kind = "combat";
    }
  }

  return grid.map((row, f) =>
    row.map<MapNode>((cell) => {
      const upper = grid[f + 1] ?? [];
      const next = [...cell.next]
        .map((col) => upper.findIndex((c) => c.col === col))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);
      return { ...ROOM[cell.kind ?? "combat"], col: cell.col, next };
    }),
  );
}

function drift(rand: () => number): number {
  const r = rand();
  return r < 0.3 ? -1 : r < 0.7 ? 0 : 1;
}

const clamp = (col: number) => Math.min(COLS - 1, Math.max(0, col));

export const isBossFloor = (floor: number) => isBoss(floor);

/**
 * Bộ nhớ đệm bản đồ theo hạt — sinh bản đồ là việc thuần nhưng tốn vài nghìn phép,
 * gọi lại mỗi lần đổi tầng sẽ gây giật. Giữ tối đa 8 hạt gần nhất là đủ.
 */
const MAP_CACHE = new Map<string, MapNode[][]>();
const MAP_CACHE_MAX = 8;

export function mapFor(seed: string): MapNode[][] {
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

/** Chỉ số các nút có thể đi tới ở tầng `floor` (đánh số từ 1) khi đang đứng ở nút `fromIndex`. */
export function reachableAt(map: MapNode[][], floor: number, fromIndex: number | null): number[] {
  const row = map[floor - 1] ?? [];
  if (floor <= 1 || fromIndex === null || fromIndex < 0) return row.map((_, i) => i);
  const prev = map[floor - 2]?.[fromIndex];
  const next = (prev?.next ?? []).filter((i) => i < row.length);
  return next.length ? next : row.map((_, i) => i);
}
