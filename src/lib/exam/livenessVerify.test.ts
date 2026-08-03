import { describe, expect, it } from "vitest";

import {
  LIVENESS_ALGORITHM,
  bytesToBase64,
  isChallengeFresh,
  isValidPublicJwk,
  verifyLivenessSignature,
} from "@/lib/exam/livenessVerify";

async function makePair() {
  const pair = (await crypto.subtle.generateKey(LIVENESS_ALGORITHM, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  return { pair, jwk };
}

async function sign(key: CryptoKey, nonce: string) {
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(nonce),
  );
  return bytesToBase64(new Uint8Array(sig));
}

describe("verifyLivenessSignature", () => {
  it("chấp nhận chữ ký đúng của thiết bị đang thi", async () => {
    const { pair, jwk } = await makePair();
    const signature = await sign(pair.privateKey, "nonce-abc");
    expect(await verifyLivenessSignature(jwk, "nonce-abc", signature)).toBe(true);
  });

  it("từ chối chữ ký của khoá khác (thay người / thay thiết bị)", async () => {
    const a = await makePair();
    const b = await makePair();
    const signature = await sign(b.pair.privateKey, "nonce-abc");
    expect(await verifyLivenessSignature(a.jwk, "nonce-abc", signature)).toBe(false);
  });

  it("từ chối khi thử thách bị đổi", async () => {
    const { pair, jwk } = await makePair();
    const signature = await sign(pair.privateKey, "nonce-abc");
    expect(await verifyLivenessSignature(jwk, "nonce-khac", signature)).toBe(false);
  });
});

describe("isValidPublicJwk", () => {
  it("chỉ nhận khoá EC P-256", () => {
    expect(isValidPublicJwk({ kty: "EC", crv: "P-256", x: "a", y: "b" })).toBe(true);
    expect(isValidPublicJwk({ kty: "RSA", n: "a" })).toBe(false);
    expect(isValidPublicJwk(null)).toBe(false);
  });
});

describe("isChallengeFresh", () => {
  it("hết hạn sau 2 phút và không nhận mốc thời gian tương lai", () => {
    const now = Date.parse("2026-08-03T12:00:00.000Z");
    expect(isChallengeFresh("2026-08-03T11:59:30.000Z", now)).toBe(true);
    expect(isChallengeFresh("2026-08-03T11:57:00.000Z", now)).toBe(false);
    expect(isChallengeFresh("2026-08-03T12:01:00.000Z", now)).toBe(false);
    expect(isChallengeFresh(undefined, now)).toBe(false);
  });
});
