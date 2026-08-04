/**
 * "Bằng chứng thao tác thật" cho từng đáp án.
 *
 * Vì sao: script gọi API hoặc bắn sự kiện giả (`dispatchEvent`) đều KHÔNG tạo ra
 * sự kiện có `isTrusted === true` — chỉ thao tác vật lý của người dùng mới có.
 * Mỗi đáp án gửi lên máy chủ vì thế phải kèm bằng chứng vừa có thao tác thật
 * (chạm/bấm chuột/gõ phím) ngay trước đó.
 *
 * Phần logic thuần tuý ở đây test được; phần gắn sự kiện chỉ chạy trên trình duyệt.
 */

/** Thao tác thật phải xảy ra trong vòng ngần này (ms) trước khi ghi đáp án. */
export const TRUSTED_MAX_AGE_MS = 4_000;

export type ProofVia = "pointer" | "key" | "none";

export type AnswerProof = {
  /** Có thao tác vật lý thật ngay trước khi ghi đáp án hay không. */
  trusted: boolean;
  via: ProofVia;
  /** Khoảng cách (ms) từ thao tác thật gần nhất tới lúc ghi đáp án. */
  ageMs: number;
  /** Mốc thời gian ghi đáp án (ms) — dùng để phân tích nhịp bấm. */
  at: number;
};

export type TrustedMark = { at: number; via: Exclude<ProofVia, "none"> };

/** Dựng bằng chứng cho một đáp án từ thao tác thật gần nhất. */
export function buildProof(
  last: TrustedMark | null,
  now: number,
  maxAgeMs: number = TRUSTED_MAX_AGE_MS,
): AnswerProof {
  if (!last) return { trusted: false, via: "none", ageMs: -1, at: now };
  const ageMs = now - last.at;
  const fresh = ageMs >= 0 && ageMs <= maxAgeMs;
  return { trusted: fresh, via: fresh ? last.via : "none", ageMs, at: now };
}

/** Bộ theo dõi thao tác thật + bằng chứng của từng câu (một bản dùng chung cho phòng thi). */
export function createInputProofTracker() {
  let last: TrustedMark | null = null;
  const proofs = new Map<string, AnswerProof>();

  return {
    /** Ghi nhận một sự kiện đầu vào (chỉ chấp nhận sự kiện `isTrusted`). */
    note(event: { isTrusted?: boolean; type?: string }, now = Date.now()) {
      if (!event?.isTrusted) return;
      const via: TrustedMark["via"] = (event.type ?? "").startsWith("key") ? "key" : "pointer";
      last = { at: now, via };
    },
    /** Gắn bằng chứng cho câu vừa trả lời. */
    mark(index: number | string, now = Date.now()) {
      proofs.set(String(index), buildProof(last, now));
    },
    /** Lấy bằng chứng của những câu chuẩn bị gửi lên máy chủ. */
    collect(keys: string[]): Record<string, AnswerProof> {
      const out: Record<string, AnswerProof> = {};
      for (const key of keys) {
        out[key] = proofs.get(key) ?? { trusted: false, via: "none", ageMs: -1, at: Date.now() };
      }
      return out;
    },
    reset() {
      proofs.clear();
      last = null;
    },
  };
}

export type InputProofTracker = ReturnType<typeof createInputProofTracker>;

/** Bản dùng chung cho toàn phòng thi. */
export const inputProof = createInputProofTracker();

/** Gắn lắng nghe thao tác thật trên toàn trang; trả về hàm gỡ bỏ. */
export function attachInputProof(target?: Window): () => void {
  const win = target ?? (typeof window === "undefined" ? null : window);
  if (!win) return () => undefined;
  const handler = (event: Event) => inputProof.note(event as unknown as { isTrusted?: boolean; type?: string });
  const kinds = ["pointerdown", "touchstart", "mousedown", "keydown"];
  for (const kind of kinds) win.addEventListener(kind, handler, { capture: true, passive: true });
  return () => {
    for (const kind of kinds) win.removeEventListener(kind, handler, { capture: true });
  };
}
