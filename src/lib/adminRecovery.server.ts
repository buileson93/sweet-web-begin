/**
 * Khôi phục mật khẩu quản trị bằng "khoá khôi phục" nội bộ.
 * Chỉ chạy phía máy chủ; khoá được lưu trong biến môi trường ADMIN_RECOVERY_KEY.
 */
import { createHash, timingSafeEqual } from "node:crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

function keyMatches(input: string, expected: string) {
  const a = createHash("sha256").update(input, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function resetAdminPasswordWithKey(input: {
  email: string;
  recoveryKey: string;
  newPassword: string;
}) {
  const expected = process.env["ADMIN_RECOVERY_KEY"];
  if (!expected) throw new Error("Hệ thống chưa cấu hình khoá khôi phục.");
  if (!keyMatches(input.recoveryKey, expected)) {
    throw new Error("Khoá khôi phục không đúng.");
  }

  const email = input.email.trim().toLowerCase();
  let userId = "";
  for (let page = 1; page <= 10 && !userId; page += 1) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === email);
    if (found) userId = found.id;
    if ((data?.users ?? []).length < 200) break;
  }
  if (!userId) throw new Error("Không tìm thấy tài khoản quản trị với email này.");

  const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (roleError) throw new Error(roleError.message);
  if (!isAdmin) throw new Error("Tài khoản này không có quyền quản trị.");

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: input.newPassword,
  });
  if (updateError) throw new Error(updateError.message);

  return { ok: true as const };
}
