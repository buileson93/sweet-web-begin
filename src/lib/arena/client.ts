/**
 * Vé phiên Đấu trường.
 *
 * Lưu ở localStorage kèm hạn 3 giờ để người chơi không phải đăng nhập nhanh lại
 * mỗi lần mở tab mới; quá 3 giờ vé tự hết hiệu lực.
 */
const KEY = "vatm:arena-token";
const NAME_KEY = "vatm:arena-name";
const AT_KEY = "vatm:arena-token-at";

export const ARENA_TOKEN_TTL_MS = 3 * 60 * 60 * 1000;

export function saveArenaToken(token: string, displayName: string) {
  try {
    localStorage.setItem(KEY, token);
    localStorage.setItem(NAME_KEY, displayName);
    localStorage.setItem(AT_KEY, String(Date.now()));
  } catch {
    /* bỏ qua khi trình duyệt chặn lưu trữ */
  }
}

function fresh(): boolean {
  const at = Number(localStorage.getItem(AT_KEY) ?? 0);
  return at > 0 && Date.now() - at <= ARENA_TOKEN_TTL_MS;
}

export function getArenaToken(): string {
  try {
    if (!fresh()) {
      clearArenaToken();
      return "";
    }
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function getArenaName(): string {
  try {
    return fresh() ? (localStorage.getItem(NAME_KEY) ?? "") : "";
  } catch {
    return "";
  }
}

export function clearArenaToken() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(AT_KEY);
  } catch {
    /* bỏ qua */
  }
}
