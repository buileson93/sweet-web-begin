/**
 * Phía máy khách của cơ chế liveness: sinh và giữ cặp khoá ECDSA KHÔNG XUẤT ĐƯỢC
 * trong IndexedDB của trình duyệt đang thi, rồi ký các thử thách do máy chủ gửi.
 */
import { LIVENESS_ALGORITHM, bytesToBase64 } from "@/lib/exam/livenessVerify";

const DB_NAME = "exam-liveness";
const STORE = "keys";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idb<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = run(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result as T);
        req.onerror = () => reject(req.error);
      }),
  );
}

type StoredPair = { privateKey: CryptoKey; publicKey: CryptoKey };

const memory = new Map<string, StoredPair>();

/** Lấy (hoặc tạo mới) cặp khoá gắn với phiên thi. Khoá riêng không thể xuất ra ngoài. */
export async function ensureLivenessKey(
  sessionId: string,
): Promise<{ publicJwk: JsonWebKey } | null> {
  if (typeof indexedDB === "undefined" || !crypto?.subtle) return null;
  try {
    let pair = memory.get(sessionId) ?? (await idb<StoredPair | undefined>("readonly", (s) => s.get(sessionId)));
    if (!pair) {
      const generated = (await crypto.subtle.generateKey(LIVENESS_ALGORITHM, false, [
        "sign",
        "verify",
      ])) as CryptoKeyPair;
      pair = { privateKey: generated.privateKey, publicKey: generated.publicKey };
      await idb("readwrite", (s) => s.put(pair, sessionId));
    }
    memory.set(sessionId, pair);
    const publicJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
    return { publicJwk };
  } catch {
    return null;
  }
}

/** Ký thử thách của máy chủ; trả về chữ ký base64 (null nếu không có khoá của phiên này). */
export async function signLivenessChallenge(
  sessionId: string,
  nonce: string,
): Promise<string | null> {
  try {
    const pair =
      memory.get(sessionId) ??
      (await idb<StoredPair | undefined>("readonly", (s) => s.get(sessionId)));
    if (!pair) return null;
    memory.set(sessionId, pair);
    const signature = await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      pair.privateKey,
      new TextEncoder().encode(nonce) as unknown as BufferSource,
    );
    return bytesToBase64(new Uint8Array(signature));
  } catch {
    return null;
  }
}

/** Dọn khoá khi phiên thi kết thúc. */
export async function clearLivenessKey(sessionId: string): Promise<void> {
  memory.delete(sessionId);
  try {
    await idb("readwrite", (s) => s.delete(sessionId));
  } catch {
    /* bỏ qua */
  }
}
