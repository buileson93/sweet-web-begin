/**
 * Hàng đợi ngoại tuyến cho thống kê thiết bị.
 *
 * Đây là dữ liệu thuần thống kê: mất vài bản ghi không ảnh hưởng nghiệp vụ.
 * Vì vậy khi không có mạng ta xếp hàng trên localStorage và gửi gộp lại sau,
 * thay vì mỗi lượt xem trang là một request thất bại.
 */
const QUEUE_KEY = "vatm:visit-queue";
const MAX_QUEUED = 20;

function read(): unknown[] {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: unknown[]): void {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items.slice(-MAX_QUEUED)));
  } catch {
    /* bỏ qua */
  }
}

/** Xếp một bản ghi vào hàng đợi (giữ tối đa 20 bản ghi gần nhất). */
export function enqueueVisit(payload: unknown): void {
  if (typeof window === "undefined") return;
  write([...read(), payload]);
}

/** Lấy toàn bộ hàng đợi và xoá — người gọi chịu trách nhiệm gửi đi. */
export function drainVisits(): unknown[] {
  if (typeof window === "undefined") return [];
  const items = read();
  if (items.length > 0) write([]);
  return items;
}
