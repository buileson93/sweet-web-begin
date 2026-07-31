/**
 * Vé phiên Đấu trường: chuỗi ký HMAC (không cần bảng phụ, không cần cookie).
 * Nội dung chỉ gồm mã nhân viên + hạn dùng; chữ ký dùng khoá bí mật máy chủ.
 */
const TTL_MS = 8 * 60 * 60 * 1000;

function secretKey() {
  const secret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) throw new Error("Máy chủ chưa cấu hình khoá bí mật cho Đấu trường.");
  return secret;
}

async function sign(payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secretKey()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function issueArenaToken(employeeId: string): Promise<string> {
  const payload = `${employeeId}.${Date.now() + TTL_MS}`;
  return `${payload}.${await sign(payload)}`;
}

/** Trả về mã nhân viên nếu vé hợp lệ; ném lỗi tiếng Việt nếu không. */
export async function verifyArenaToken(token: string): Promise<string> {
  const parts = (token ?? "").split(".");
  if (parts.length !== 3) throw new Error("Phiên đấu trường không hợp lệ, vui lòng đăng nhập lại.");
  const [employeeId, expires, mac] = parts;
  const expected = await sign(`${employeeId}.${expires}`);
  if (mac !== expected) throw new Error("Phiên đấu trường không hợp lệ, vui lòng đăng nhập lại.");
  if (Number(expires) < Date.now()) throw new Error("Phiên đấu trường đã hết hạn, vui lòng đăng nhập lại.");
  return employeeId;
}
