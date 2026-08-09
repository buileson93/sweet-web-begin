/**
 * Trần tần suất autosave theo TỪNG PHIÊN THI (đếm phía máy chủ, lưu trong helpers.save).
 *
 * Vì sao: trần "5 câu mới / gói" vô nghĩa nếu script được phép bắn không giới hạn số gói.
 * Ở đây giới hạn khoảng cách giữa hai gói và tổng số gói của cả phiên, đồng thời
 * chống phát lại bằng cách nhớ chữ ký của các gói gần nhất.
 *
 * Ngưỡng đặt rộng rãi để KHÔNG phạt oan người thi thật (nhịp tim 12s + debounce 2s),
 * nhưng đủ chặt để không thể nhồi cả bài trong vài giây.
 */

/** Khoảng cách tối thiểu giữa hai gói autosave thường (ms). */
export const MIN_GAP_RPC_MS = 900;
/** Khoảng cách tối thiểu giữa hai gói gửi bằng sendBeacon (ms). */
export const MIN_GAP_BEACON_MS = 2_000;
/** Tổng số gói autosave tối đa cho một phiên thi. */
export const MAX_SAVES_PER_SESSION = 400;
/** Tổng số gói beacon tối đa cho một phiên thi (beacon chỉ xảy ra khi tab bị ẩn). */
export const MAX_BEACONS_PER_SESSION = 40;
/** Số chữ ký gần nhất được nhớ để chống phát lại. */
export const SEEN_LIMIT = 40;

export type SaveSource = "rpc" | "beacon";

export type SaveRateState = {
  /** Mốc gói gần nhất (ms). */
  at?: number;
  /** Tổng số gói đã nhận. */
  count?: number;
  /** Số gói beacon đã nhận. */
  beacons?: number;
  /** Chữ ký (rút gọn) của các gói gần nhất. */
  seen?: string[];
};

export function readSaveRate(helpers: unknown): SaveRateState {
  const raw = (helpers as { save?: SaveRateState } | null)?.save;
  return raw && typeof raw === "object" ? raw : {};
}

export function withSaveRate(helpers: unknown, next: SaveRateState): Record<string, unknown> {
  const base = (helpers as Record<string, unknown> | null) ?? {};
  return { ...base, save: next };
}

export type RateVerdict =
  | { ok: true }
  | { ok: false; reason: "too_fast" | "too_many" | "too_many_beacons" | "replay" };

/** Gói này có được nhận hay không (chưa cập nhật trạng thái). */
export function checkSaveRate(params: {
  state: SaveRateState;
  nowMs: number;
  source: SaveSource;
  signature?: string | undefined;
}): RateVerdict {
  const { state, nowMs, source, signature } = params;
  const gap = source === "beacon" ? MIN_GAP_BEACON_MS : MIN_GAP_RPC_MS;
  if (typeof state.at === "number" && nowMs - state.at < gap) return { ok: false, reason: "too_fast" };
  if ((state.count ?? 0) >= MAX_SAVES_PER_SESSION) return { ok: false, reason: "too_many" };
  if (source === "beacon" && (state.beacons ?? 0) >= MAX_BEACONS_PER_SESSION) {
    return { ok: false, reason: "too_many_beacons" };
  }
  if (signature && (state.seen ?? []).includes(fingerprint(signature))) {
    return { ok: false, reason: "replay" };
  }
  return { ok: true };
}

/** Rút gọn chữ ký để lưu trữ (đủ dài để không đụng độ, đủ ngắn để không phình jsonb). */
export function fingerprint(signature: string): string {
  return signature.slice(0, 24);
}

/** Trạng thái mới sau khi nhận một gói. */
export function advanceSaveRate(params: {
  state: SaveRateState;
  nowMs: number;
  source: SaveSource;
  signature?: string | undefined;
}): SaveRateState {
  const { state, nowMs, source, signature } = params;
  const seen = signature ? [...(state.seen ?? []), fingerprint(signature)].slice(-SEEN_LIMIT) : (state.seen ?? []);
  return {
    at: nowMs,
    count: (state.count ?? 0) + 1,
    beacons: (state.beacons ?? 0) + (source === "beacon" ? 1 : 0),
    seen,
  };
}
