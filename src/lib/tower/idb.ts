/**
 * Kho cục bộ cho Leo Tháp (IndexedDB) — chỉ chạy trong trình duyệt.
 * Giữ gói đề, trạng thái ôn tập và hàng chờ đồng bộ để chơi được cả khi rớt mạng.
 */
import type { QuestionBank } from "@/lib/tower/bank";
import type { TowerState } from "@/lib/tower/state";

const DB_NAME = "tower-cache";
const DB_VERSION = 1;
const STORE = "kv";

const KEY_BANK = "bank";
const KEY_STATE = "state";
const KEY_PENDING = "pending";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get<T>(key: string): Promise<T | null> {
  try {
    const db = await openDb();
    return await new Promise<T | null>((resolve, reject) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function put(key: string, value: unknown): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* Không có IndexedDB (chế độ riêng tư): bỏ qua, phiên vẫn chơi được trong bộ nhớ. */
  }
}

export const readCachedBank = () => get<QuestionBank>(KEY_BANK);
export const writeCachedBank = (bank: QuestionBank) => put(KEY_BANK, bank);

export const readCachedState = () => get<TowerState>(KEY_STATE);
export const writeCachedState = (state: TowerState) => put(KEY_STATE, state);

/** Cờ "còn tiến trình chưa gửi lên máy chủ". */
export const readPendingSync = () => get<boolean>(KEY_PENDING);
export const writePendingSync = (pending: boolean) => put(KEY_PENDING, pending);
