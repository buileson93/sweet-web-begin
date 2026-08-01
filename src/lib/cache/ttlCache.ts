/**
 * Bộ nhớ đệm nhẹ theo thời gian sống (TTL) trên localStorage.
 *
 * Dùng cho dữ liệu chỉ-đọc không cần realtime tuyệt đối (bảng xếp hạng,
 * số thẻ đến hạn) nhằm cắt bớt lượt gọi máy chủ khi người dùng chuyển trang.
 */
type Entry<T> = { at: number; value: T };

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Đọc giá trị còn hạn; trả về null nếu hết hạn, hỏng hoặc không có. */
export function readCache<T>(key: string, ttlMs: number): T | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Entry<T>;
    if (!entry || typeof entry.at !== "number") return null;
    if (Date.now() - entry.at > ttlMs) return null;
    return entry.value;
  } catch {
    return null;
  }
}

export function writeCache<T>(key: string, value: T): void {
  const store = storage();
  if (!store) return;
  try {
    store.setItem(key, JSON.stringify({ at: Date.now(), value } satisfies Entry<T>));
  } catch {
    /* hết dung lượng -> bỏ qua, chỉ là bộ đệm */
  }
}

/**
 * Lấy dữ liệu qua bộ đệm: còn hạn thì dùng ngay (không gọi mạng),
 * hết hạn thì gọi `fetcher` và ghi lại. Lỗi mạng vẫn trả bản cũ nếu có.
 */
export async function cachedFetch<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = readCache<T>(key, ttlMs);
  if (hit !== null) return hit;
  try {
    const fresh = await fetcher();
    writeCache(key, fresh);
    return fresh;
  } catch (err) {
    const stale = readCache<T>(key, Number.MAX_SAFE_INTEGER);
    if (stale !== null) return stale;
    throw err;
  }
}
