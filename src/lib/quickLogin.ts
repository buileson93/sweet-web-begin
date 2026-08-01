/**
 * Ghi nhớ thông tin đăng nhập nhanh trong 3 giờ để người dùng không phải nhập lại
 * họ tên + 4 số cuối điện thoại mỗi lần vào phòng thi / đấu trường.
 *
 * Chỉ lưu trên chính máy của người dùng (localStorage) và tự hết hạn.
 */

export const QUICK_LOGIN_KEY = "vatm:quick-login:v1";
export const QUICK_LOGIN_TTL_MS = 3 * 60 * 60 * 1000;

export type QuickLogin = {
  name: string;
  credential: string;
  extraCredential?: string;
};

type Stored = QuickLogin & { savedAt: number };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function store(storage?: StorageLike | null): StorageLike | null {
  return storage ?? (typeof window === "undefined" ? null : window.localStorage);
}

export function saveQuickLogin(entry: QuickLogin, storage?: StorageLike | null, now = Date.now()) {
  const s = store(storage);
  const name = entry.name.trim();
  const credential = entry.credential.trim();
  if (!s || !name || !credential) return;
  const payload: Stored = {
    name,
    credential,
    ...(entry.extraCredential?.trim() ? { extraCredential: entry.extraCredential.trim() } : {}),
    savedAt: now,
  };
  try {
    s.setItem(QUICK_LOGIN_KEY, JSON.stringify(payload));
  } catch {
    /* trình duyệt chặn lưu trữ — bỏ qua */
  }
}

/** Trả về thông tin còn hiệu lực, hoặc null nếu chưa có / đã quá 3 giờ. */
export function readQuickLogin(storage?: StorageLike | null, now = Date.now()): QuickLogin | null {
  const s = store(storage);
  if (!s) return null;
  try {
    const raw = s.getItem(QUICK_LOGIN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (!parsed?.name || !parsed.credential || typeof parsed.savedAt !== "number") return null;
    if (now - parsed.savedAt > QUICK_LOGIN_TTL_MS) {
      s.removeItem(QUICK_LOGIN_KEY);
      return null;
    }
    return {
      name: parsed.name,
      credential: parsed.credential,
      ...(parsed.extraCredential ? { extraCredential: parsed.extraCredential } : {}),
    };
  } catch {
    return null;
  }
}

export function clearQuickLogin(storage?: StorageLike | null) {
  try {
    store(storage)?.removeItem(QUICK_LOGIN_KEY);
  } catch {
    /* bỏ qua */
  }
}
