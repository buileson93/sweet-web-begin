/**
 * Chuỗi băm (hash chain) cho từng lần autosave.
 *
 * Vì sao: chỉ dùng số thứ tự (seq) thì kẻ tấn công vẫn có thể GHÉP dữ liệu —
 * bắt lại một request cũ, đổi seq rồi gửi lại, hoặc gộp nhiều gói đáp án bắt được
 * thành một chuỗi giả. Với hash chain, mỗi gói phải mang mã băm nối tiếp đúng
 * mã băm mà MÁY CHỦ đã xác nhận ở gói liền trước; đổi/lặp/ghép bất kỳ gói nào
 * cũng làm gãy chuỗi và bị máy chủ từ chối.
 *
 * Thuần tuý, chạy được cả trên trình duyệt lẫn máy chủ (WebCrypto chuẩn).
 */

/** Chuẩn hoá gói đáp án về chuỗi ổn định (thứ tự chỉ số tăng dần) để hai bên băm giống nhau. */
export function canonicalAnswers(delta: Record<string, unknown>): string {
  const keys = Object.keys(delta ?? {}).sort((a, b) => {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return JSON.stringify(keys.map((k) => [k, delta[k] ?? null]));
}

const encoder = new TextEncoder();

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Mắt xích khởi đầu, gắn với đúng phiên thi (không dùng lại được cho phiên khác). */
export function genesisHash(sessionId: string): Promise<string> {
  return sha256Hex("exam-chain:v1:genesis:" + sessionId);
}

/** Mắt xích kế tiếp = băm(mắt xích trước | seq | đáp án gửi kèm). */
export function linkHash(
  prev: string,
  seq: number,
  delta: Record<string, unknown>,
): Promise<string> {
  return sha256Hex(`exam-chain:v1|${prev}|${seq}|${canonicalAnswers(delta)}`);
}

export type ChainState = { head: string; seq: number };

/** Đọc trạng thái chuỗi đang lưu trong cột helpers (jsonb) của phiên thi. */
export function readChain(helpers: unknown): ChainState | null {
  const raw = (helpers as { chain?: unknown } | null)?.chain as
    | { head?: unknown; seq?: unknown }
    | undefined;
  if (!raw || typeof raw.head !== "string" || raw.head.length !== 64) return null;
  return { head: raw.head, seq: Number(raw.seq ?? 0) || 0 };
}

/** Ghi mắt xích mới vào helpers, giữ nguyên các khoá khác (checked, x2, ...). */
export function withChain(helpers: unknown, head: string, seq: number): Record<string, unknown> {
  const base = (helpers as Record<string, unknown> | null) ?? {};
  return { ...base, chain: { head, seq } };
}

export type ChainCheck =
  | { ok: true; head: string }
  | { ok: false; reason: "missing" | "fork" | "mismatch"; head: string };

/**
 * Kiểm tra một gói autosave có nối tiếp đúng chuỗi hay không.
 * `expectedHead` là mắt xích máy chủ đang giữ (hoặc genesis nếu chưa có gói nào).
 */
export async function verifyChainLink(params: {
  expectedHead: string;
  established: boolean;
  seq: number;
  delta: Record<string, unknown>;
  chainPrev?: string | undefined;
  chainHash?: string | undefined;
}): Promise<ChainCheck> {
  const { expectedHead, established, seq, delta, chainPrev, chainHash } = params;
  if (!chainHash) {
    // Chưa từng có gói nào ký chuỗi thì cho qua (tương thích gói gửi bằng sendBeacon);
    // một khi chuỗi đã hình thành thì mọi gói sau bắt buộc phải có mắt xích.
    return established
      ? { ok: false, reason: "missing", head: expectedHead }
      : { ok: true, head: expectedHead };
  }
  if (chainPrev !== expectedHead) return { ok: false, reason: "fork", head: expectedHead };
  const expected = await linkHash(expectedHead, seq, delta);
  if (expected !== chainHash) return { ok: false, reason: "mismatch", head: expectedHead };
  return { ok: true, head: chainHash };
}
