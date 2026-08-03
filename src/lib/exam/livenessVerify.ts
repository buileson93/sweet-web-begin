/**
 * Xác minh chữ ký "liveness" (thuần tuý, dùng WebCrypto — chạy được ở máy chủ Worker).
 *
 * Ý tưởng: đầu giờ, máy của thí sinh sinh một cặp khoá ECDSA P-256 KHÔNG XUẤT ĐƯỢC
 * (non-extractable) lưu trong IndexedDB của chính trình duyệt đó, rồi gửi khoá công khai
 * lên máy chủ. Trong suốt buổi thi, máy chủ liên tục gửi thử thách ngẫu nhiên (challenge)
 * và trình duyệt phải ký lại (response). Vì khoá riêng không thể xuất ra, không thể
 * chuyển sang máy khác hay dán vào script — nên nếu giữa chừng có người khác "thay ca"
 * trên thiết bị/trình duyệt khác mà vẫn dùng session cũ, chữ ký sẽ hỏng và bị ghi nhận.
 */

export const LIVENESS_ALGORITHM = { name: "ECDSA", namedCurve: "P-256" } as const;
/** Thử thách hết hạn sau 2 phút để không thể trả lời lại bằng chữ ký cũ. */
export const LIVENESS_CHALLENGE_TTL_MS = 120_000;
/** Nhịp kiểm tra liveness trên máy khách. */
export const LIVENESS_INTERVAL_MS = 90_000;

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Khoá công khai hợp lệ (JWK của ECDSA P-256) hay không — chặn dữ liệu rác. */
export function isValidPublicJwk(jwk: unknown): jwk is JsonWebKey {
  const k = jwk as JsonWebKey | null;
  return Boolean(
    k && k.kty === "EC" && k.crv === "P-256" && typeof k.x === "string" && typeof k.y === "string",
  );
}

/** Kiểm tra chữ ký của thử thách bằng khoá công khai đã đăng ký. */
export async function verifyLivenessSignature(
  publicJwk: JsonWebKey,
  nonce: string,
  signatureBase64: string,
): Promise<boolean> {
  if (!isValidPublicJwk(publicJwk) || !nonce || !signatureBase64) return false;
  try {
    const key = await crypto.subtle.importKey("jwk", publicJwk, LIVENESS_ALGORITHM, false, [
      "verify",
    ]);
    const signature = base64ToBytes(signatureBase64);
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      signature as unknown as BufferSource,
      new TextEncoder().encode(nonce) as unknown as BufferSource,
    );
  } catch {
    return false;
  }
}

/** Thử thách còn hiệu lực hay không. */
export function isChallengeFresh(issuedAt: string | undefined, now = Date.now()): boolean {
  if (!issuedAt) return false;
  const t = Date.parse(issuedAt);
  return Number.isFinite(t) && now - t >= 0 && now - t <= LIVENESS_CHALLENGE_TTL_MS;
}
