/** RNG có hạt (mulberry32) — nền tảng tái lập của mọi roguelike. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRandom(seed: string | number): () => number {
  let a = (typeof seed === "string" ? hashSeed(seed) : seed >>> 0) || 1;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Thứ tự tính điểm xử lý — KHOÁ CỨNG, có kiểm thử:
 * lượt bốc thăm → combo → trợ học → ràng buộc.
 */
export function towerDamage(input: {
  roll: number;
  combo: number;
  damageBonus: number;
  cap?: number;
}): number {
  let dmg = Math.max(1, Math.round(input.roll)); // 1) lượt bốc thăm
  dmg += Math.min(6, Math.max(0, input.combo - 1) * 2); // 2) combo
  dmg += Math.max(0, input.damageBonus); // 3) trợ học
  return Math.min(input.cap ?? 40, dmg); // 4) ràng buộc
}

/**
 * Phân nhánh hạt theo mục đích: hash(seed + "map-floor-3"), hash(seed + "reward-5")…
 * Nhờ vậy thêm/bớt một lần rút ở chỗ này không làm đổi kết quả ở chỗ khác.
 */
export function branch(seed: string, purpose: string): () => number {
  return seededRandom(`${seed}::${purpose}`);
}

/** Hạt của thử thách hằng ngày: cả cơ quan cùng một bản đồ, cùng trang bị. */
export function dailySeed(dayKey: string, salt = "twr"): string {
  return `daily:${salt}:${dayKey}`;
}

/** Rút một phần tử theo trọng số, dùng RNG có hạt. */
export function pickWeighted<T>(items: { item: T; weight: number }[], rand: () => number): T | undefined {
  const pool = items.filter((x) => x.weight > 0);
  if (!pool.length) return undefined;
  const total = pool.reduce((s, x) => s + x.weight, 0);
  let ticket = rand() * total;
  for (const x of pool) {
    ticket -= x.weight;
    if (ticket <= 0) return x.item;
  }
  return pool[pool.length - 1]!.item;
}
