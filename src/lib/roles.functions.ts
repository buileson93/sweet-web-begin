import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ASSIGNABLE = ["admin", "editor", "staff"] as const;

const grantSchema = z.object({
  email: z.string().email().max(160),
  role: z.enum(ASSIGNABLE),
});

const revokeSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(ASSIGNABLE),
});

export type AccountRow = {
  userId: string;
  email: string;
  roles: string[];
  createdAt: string;
};

/** Chỉ quản trị viên mới được thao tác phân quyền. */
async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Không kiểm tra được quyền quản trị.");
  if (!data) throw new Error("Chỉ quản trị viên mới được phân quyền tài khoản.");
}

/** Danh sách tài khoản đăng nhập kèm vai trò hiện tại. */
export const listAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AccountRow[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);

    const { data: roles, error: rolesError } = await supabaseAdmin.from("user_roles").select("user_id, role");
    if (rolesError) throw new Error(rolesError.message);

    const byUser = new Map<string, string[]>();
    for (const r of roles ?? []) {
      byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r.role as string]);
    }

    return users.users.map((u) => ({
      userId: u.id,
      email: u.email ?? "(không có email)",
      roles: byUser.get(u.id) ?? [],
      createdAt: u.created_at,
    }));
  });

/** Cấp vai trò cho một tài khoản theo email (tài khoản phải đã đăng ký). */
export const grantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const target = users.users.find((u) => (u.email ?? "").toLowerCase() === data.email.toLowerCase());
    if (!target) throw new Error("Không tìm thấy tài khoản với email này. Người dùng cần đăng ký trước.");

    const { error: insertError } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: target.id, role: data.role }, { onConflict: "user_id,role" });
    if (insertError) throw new Error(insertError.message);

    return { userId: target.id, email: target.email ?? "", role: data.role };
  });

/** Thu hồi vai trò của một tài khoản (không tự thu hồi quyền của chính mình). */
export const revokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => revokeSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) throw new Error("Không thể tự thu hồi quyền của chính mình.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
