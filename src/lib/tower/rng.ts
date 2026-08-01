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
 * Thứ tự tính sát thương — KHOÁ CỨNG, có kiểm thử:
 * xúc xắc → combo → trợ học → ràng buộc.
 */
export function towerDamage(input: {
  roll: number;
  combo: number;
  damageBonus: number;
  cap?: number;
}): number {
  let dmg = Math.max(1, Math.round(input.roll)); // 1) xúc xắc
  dmg += Math.min(6, Math.max(0, input.combo - 1) * 2); // 2) combo
  dmg += Math.max(0, input.damageBonus); // 3) trợ học
  return Math.min(input.cap ?? 40, dmg); // 4) ràng buộc
}
