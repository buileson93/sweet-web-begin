/** Vé phiên Đấu trường lưu ở sessionStorage: đóng tab là hết hiệu lực. */
const KEY = "vatm:arena-token";
const NAME_KEY = "vatm:arena-name";

export function saveArenaToken(token: string, displayName: string) {
  try {
    sessionStorage.setItem(KEY, token);
    sessionStorage.setItem(NAME_KEY, displayName);
  } catch {
    /* bỏ qua khi trình duyệt chặn lưu trữ */
  }
}

export function getArenaToken(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function getArenaName(): string {
  try {
    return sessionStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearArenaToken() {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(NAME_KEY);
  } catch {
    /* bỏ qua */
  }
}
