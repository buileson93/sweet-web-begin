import { getVATMFingerprint } from "./exam/fingerprint";

/**
 * Mã định danh thiết bị bền vững kết hợp localStorage và Fingerprint.
 * Mục tiêu: chống thi hộ và truy vết gian lận ngay cả khi người dùng xóa cache/Incognito.
 */

const DEVICE_KEY = "vatm:device-id";
const FINGERPRINT_KEY = "vatm:device-fp";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Math.random().toString(36).slice(2)}${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2)}`;
}

/** 
 * Lấy (hoặc tạo mới) mã thiết bị. 
 * Kết hợp UUID từ localStorage và Fingerprint từ phần cứng.
 */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    const fp = window.sessionStorage.getItem(FINGERPRINT_KEY) || "";
    
    // Nếu có cả hai, kết hợp chúng
    if (existing && existing.length >= 8) {
      return fp ? `${existing}:${fp}` : existing;
    }
    
    const fresh = randomId();
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fp ? `${fresh}:${fp}` : fresh;
  } catch {
    return "";
  }
}

/** 
 * Khởi tạo fingerprint khi ứng dụng bắt đầu. 
 * Nên gọi hàm này sớm tại root để đảm bảo có fingerprint sẵn sàng.
 */
export async function initDeviceIdentity() {
  if (typeof window === "undefined") return;
  try {
    const fp = await getVATMFingerprint();
    window.sessionStorage.setItem(FINGERPRINT_KEY, fp);
  } catch (e) {
    console.warn("Failed to init device identity", e);
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

