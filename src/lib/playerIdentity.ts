/**
 * Nhận diện nhân vật dùng chung cho toàn web (header, trang chủ, đấu trường).
 * Chỉ lưu thông tin hiển thị (KHÔNG lưu thông tin xác thực như 4 số cuối / ngày sinh).
 */

export const PLAYER_IDENTITY_KEY = "player:identity:v1";
export const PLAYER_IDENTITY_EVENT = "player-identity-changed";

export type PlayerIdentity = {
  employeeId: string;
  displayName: string;
  unit: string;
  avatarUrl: string;
  avatarImage: string;
  level: number;
  title: string;
  into: number;
  need: number;
  percent: number;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Chuẩn hoá dữ liệu thô thành nhận diện hợp lệ; trả null nếu thiếu thông tin bắt buộc. */
export function normalizeIdentity(raw: unknown): PlayerIdentity | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const employeeId = String(r.employeeId ?? "");
  const displayName = String(r.displayName ?? "").trim();
  if (!employeeId || !displayName) return null;
  const need = Number(r.need ?? 100) || 100;
  return {
    employeeId,
    displayName,
    unit: String(r.unit ?? ""),
    avatarUrl: String(r.avatarUrl ?? ""),
    avatarImage: String(r.avatarImage ?? ""),
    level: Math.max(1, Math.floor(Number(r.level ?? 1) || 1)),
    title: String(r.title ?? ""),
    into: Math.max(0, Math.floor(Number(r.into ?? 0) || 0)),
    need,
    percent: Math.min(100, Math.max(0, Math.round(Number(r.percent ?? 0) || 0))),
  };
}

export function readPlayerIdentity(storage?: StorageLike | null): PlayerIdentity | null {
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!store) return null;
  try {
    const raw = store.getItem(PLAYER_IDENTITY_KEY);
    return raw ? normalizeIdentity(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function savePlayerIdentity(value: unknown, storage?: StorageLike | null): PlayerIdentity | null {
  const identity = normalizeIdentity(value);
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  if (!identity || !store) return null;
  try {
    store.setItem(PLAYER_IDENTITY_KEY, JSON.stringify(identity));
    if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAYER_IDENTITY_EVENT));
  } catch {
    /* bộ nhớ đầy hoặc bị chặn — bỏ qua */
  }
  return identity;
}

export function clearPlayerIdentity(storage?: StorageLike | null) {
  const store = storage ?? (typeof window === "undefined" ? null : window.localStorage);
  try {
    store?.removeItem(PLAYER_IDENTITY_KEY);
    if (typeof window !== "undefined") window.dispatchEvent(new Event(PLAYER_IDENTITY_EVENT));
  } catch {
    /* bỏ qua */
  }
}
