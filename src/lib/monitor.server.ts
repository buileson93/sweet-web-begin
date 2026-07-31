/**
 * Trợ giúp phía máy chủ cho màn "Theo dõi trực tiếp".
 * Mục tiêu: ít truy vấn (không N+1), có bộ nhớ đệm ngắn để nhiều người xem
 * cùng lúc không tạo tải trùng lặp, và trả về "vân tay" dữ liệu để client
 * chỉ cập nhật khi thực sự có thay đổi.
 */

export type LiveSession = {
  id: string;
  quizId: string;
  quizTitle: string;
  candidateName: string;
  unit: string;
  startedAt: string;
  expiresAt: string;
  submittedAt: string | null;
  status: string;
  answered: number;
  total: number;
};

export type LivePage = {
  /** Vân tay của trang dữ liệu; giống nhau nghĩa là không có gì đổi. */
  version: string;
  /** false khi client đã có đúng phiên bản này (không gửi lại rows). */
  changed: boolean;
  rows: LiveSession[];
  /** Còn dữ liệu cũ hơn để tải thêm hay không. */
  hasMore: boolean;
  activeCount: number;
  submittedCount: number;
  serverNow: string;
};

const MONITOR_ROLES = ["admin", "staff", "editor"] as const;

/** Kiểm tra quyền bằng MỘT truy vấn thay vì gọi has_role nhiều lần. */
export async function assertMonitorRole(supabase: {
  from: (t: string) => any;
}, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", MONITOR_ROLES as unknown as string[])
    .limit(1);
  if (error) throw new Error("Không kiểm tra được quyền theo dõi kỳ thi.");
  if (!data || data.length === 0) throw new Error("Tài khoản không có quyền theo dõi kỳ thi.");
}

/** Hàm băm FNV-1a nhỏ gọn, đủ để phát hiện thay đổi. */
export function fingerprint(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

type CacheEntry = { at: number; value: unknown };
const cache = new Map<string, CacheEntry>();
/** Đệm 4 giây: nhiều quản trị viên cùng mở bảng chỉ tốn 1 lượt truy vấn. */
const CACHE_TTL_MS = 4_000;

export async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value as T;
  const value = await load();
  cache.set(key, { at: now, value });
  if (cache.size > 50) {
    for (const [k, v] of cache) if (now - v.at > CACHE_TTL_MS) cache.delete(k);
  }
  return value;
}

/** Cửa sổ theo dõi: 2 giờ gần nhất. */
export function monitorSince() {
  return new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
}
