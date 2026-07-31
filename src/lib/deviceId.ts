/**
 * Mã định danh thiết bị bền vững (localStorage) dùng để chống thi hộ:
 * một thiết bị chỉ phục vụ một nhân viên, đổi người phải chờ hết thời gian nguội.
 */

const DEVICE_KEY = "vatm:device-id";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

/** Lấy (hoặc tạo mới) mã thiết bị. Trả về chuỗi rỗng nếu trình duyệt chặn lưu trữ. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing && existing.length >= 8) return existing;
    const fresh = randomId();
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}

/** Diễn giải thời gian chờ còn lại thành tiếng Việt dễ đọc. */
export function formatCooldown(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m <= 0) return `${rest} giây`;
  if (rest === 0) return `${m} phút`;
  return `${m} phút ${rest} giây`;
}
