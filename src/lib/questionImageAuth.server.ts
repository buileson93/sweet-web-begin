/** Kiểm tra quyền thao tác kho ảnh câu hỏi (chỉ chạy phía máy chủ). */

type AuthContext = { supabase: any; userId: string };

/** Quản trị viên hoặc người biên soạn đề. */
export async function assertImageEditor(context: AuthContext) {
  const [admin, editor] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" }),
  ]);
  if (!admin.data && !editor.data) throw new Error("Không có quyền thao tác kho ảnh câu hỏi.");
  return Boolean(admin.data);
}

/** Chỉ quản trị viên. */
export async function assertImageAdmin(context: AuthContext) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Chỉ quản trị viên mới được dọn kho ảnh.");
}
