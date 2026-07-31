import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type VerifiedEmployee = {
  id: string;
  fullName: string;
  position: string | null;
  unitName: string | null;
  birthYear: string;
  /** Số điện thoại đã che, ví dụ 090****195 */
  phoneMasked: string;
};

/** Chuẩn hoá họ tên: bỏ dấu, thường hoá, gộp khoảng trắng. */
export function nameKey(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/đ/g, "d")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function maskPhone(phone: string | null) {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "***";
  return `${digits.slice(0, 3)}****${digits.slice(-3)}`;
}

const MAX_FAILED = 8;
const WINDOW_MINUTES = 10;

/**
 * Tách "thông tin xác thực" mà thí sinh nhập: chấp nhận 4 số cuối điện thoại
 * HOẶC ngày sinh (dd/mm/yyyy, dd-mm-yyyy hoặc yyyy-mm-dd).
 */
export function parseCredential(raw?: string | null): { last4?: string; birthIso?: string } {
  const value = (raw ?? "").trim();
  if (!value) return {};

  const dmy = value.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    return { birthIso: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }

  const ymd = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) return { birthIso: value };

  const digits = value.replace(/\D/g, "");
  if (digits.length === 8) {
    // 01021990 -> 1990-02-01
    return { birthIso: `${digits.slice(4)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}` };
  }
  if (digits.length >= 4) return { last4: digits.slice(-4) };
  return {};
}

/**
 * Ghi nhận một lần đăng nhập nhanh: vừa dùng cho chống dò thông tin, vừa đẩy
 * vào nhật ký quản trị để admin theo dõi realtime.
 */
async function logAttempt(input: {
  key: string;
  displayName: string;
  success: boolean;
  reason?: string;
  employeeId?: string | null;
}) {
  try {
    await supabaseAdmin.from("employee_login_attempts").insert({ name_key: input.key, success: input.success });
    await supabaseAdmin.from("audit_logs").insert({
      user_id: null,
      actor_email: "Đăng nhập nhanh",
      action: input.success ? "login_success" : "login_failed",
      entity: "employee",
      entity_id: input.employeeId ?? null,
      entity_label: input.displayName,
      details: { reason: input.reason ?? (input.success ? "Xác thực thành công" : "Không rõ") } as never,
    });
  } catch {
    /* nhật ký là phụ trợ */
  }
}

export type VerifyInput = {
  name: string;
  /** 4 số cuối điện thoại HOẶC ngày sinh */
  credential: string;
  /** Thông tin bổ sung khi có nhiều người trùng họ tên */
  extraCredential?: string;
};

/**
 * Đối chiếu thí sinh với danh bạ nhân viên.
 * Chỉ cần khớp MỘT trong hai: 4 số cuối điện thoại hoặc ngày sinh.
 * Chỉ trả về thông tin đã che bớt; toàn bộ danh bạ không bao giờ gửi xuống trình duyệt.
 */
export async function verifyEmployee(input: VerifyInput): Promise<VerifiedEmployee> {
  const key = nameKey(input.name);
  const displayName = input.name.trim().slice(0, 120) || "(không nhập tên)";

  if (key.length < 3) throw new Error("Vui lòng nhập đầy đủ họ và tên như trong danh sách nhân viên.");

  const primary = parseCredential(input.credential);
  const extra = parseCredential(input.extraCredential);
  const last4 = primary.last4 ?? extra.last4;
  const birthIso = primary.birthIso ?? extra.birthIso;

  if (!last4 && !birthIso) {
    throw new Error("Nhập 4 số cuối điện thoại hoặc ngày sinh (dd/mm/yyyy) để xác thực.");
  }

  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000).toISOString();
  const { data: recentFails } = await supabaseAdmin
    .from("employee_login_attempts")
    .select("created_at")
    .eq("name_key", key)
    .eq("success", false)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(MAX_FAILED + 5);

  const fails = recentFails ?? [];
  if (fails.length >= MAX_FAILED) {
    // Khoá tạm thời: tính từ lần nhập sai gần nhất để tránh dò dữ liệu liên tục.
    const lockedUntil = new Date(new Date(fails[0].created_at).getTime() + WINDOW_MINUTES * 60_000);
    const minutesLeft = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    await logAttempt({
      key,
      displayName,
      success: false,
      reason: `Tạm khoá do nhập sai ${fails.length} lần trong ${WINDOW_MINUTES} phút`,
    });
    throw new Error(
      `Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau ${minutesLeft} phút hoặc liên hệ Phòng TCCB-LĐ.`,
    );
  }

  const { data, error } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, position, unit_name, birth_date, phone, phone_last4")
    .eq("name_key", key)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const people = data ?? [];
  if (people.length === 0) {
    await logAttempt({ key, displayName, success: false, reason: "Không tìm thấy họ tên trong danh bạ" });
    throw new Error("Không tìm thấy họ tên này trong danh sách nhân viên. Vui lòng kiểm tra lại chính tả.");
  }

  const matchPhone = (p: (typeof people)[number]) => Boolean(last4) && p.phone_last4 === last4;
  const matchBirth = (p: (typeof people)[number]) => Boolean(birthIso) && String(p.birth_date ?? "") === birthIso;

  let matches = people.filter((p) => matchPhone(p) || matchBirth(p));

  if (matches.length === 0) {
    await logAttempt({ key, displayName, success: false, reason: "Sai 4 số cuối điện thoại và ngày sinh" });
    throw new Error(
      "Thông tin chưa khớp. Bạn có thể dùng 4 số cuối điện thoại HOẶC ngày sinh (dd/mm/yyyy) đã đăng ký.",
    );
  }

  if (matches.length > 1) {
    // Trùng họ tên: yêu cầu khớp cả hai thông tin để phân biệt.
    const both = matches.filter((p) => matchPhone(p) && matchBirth(p));
    if (both.length !== 1) {
      await logAttempt({ key, displayName, success: false, reason: "Trùng họ tên, cần thêm thông tin" });
      throw new Error(
        "Có nhiều nhân viên trùng họ tên. Vui lòng nhập thêm thông tin còn lại (ngày sinh hoặc 4 số cuối điện thoại).",
      );
    }
    matches = both;
  }

  const emp = matches[0];
  await logAttempt({ key, displayName: emp.full_name, success: true, employeeId: emp.id });

  return {
    id: emp.id,
    fullName: emp.full_name,
    position: emp.position,
    unitName: emp.unit_name,
    birthYear: emp.birth_date ? String(emp.birth_date).slice(0, 4) : "",
    phoneMasked: maskPhone(emp.phone),
  };
}
