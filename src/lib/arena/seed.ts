/**
 * Bộ sinh số ngẫu nhiên CÓ HẠT GIỐNG (seed) cho hiệu ứng đấu trường.
 *
 * Hai máy khác nhau cùng nhận một `seed` từ máy chủ (mã lượt + mốc chốt lượt)
 * nên xúc xắc lăn cùng nhịp, dừng cùng lúc và ra cùng giá trị — không còn cảnh
 * mỗi bên thấy một kiểu.
 */

/** Băm chuỗi thành số nguyên 32-bit (FNV-1a) — thuần tuý, không phụ thuộc môi trường. */
export function hashSeed(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Bộ sinh mulberry32: cùng seed → cùng dãy số. */
export function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Thời gian lăn (ms) của từng viên xúc xắc — giống nhau ở cả hai máy. */
export function seededRollDurations(seed: string, count: number, budgetMs = 1_600): number[] {
  const rng = seededRng(hashSeed(seed));
  const span = Math.max(400, budgetMs - 300);
  return Array.from({ length: count }, (_, i) => {
    const base = span * 0.45 + rng() * span * 0.35;
    return Math.round(Math.min(budgetMs - 150, base + i * 180));
  });
}
