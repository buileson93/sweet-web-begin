import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "staff" | "editor" | "user";

/**
 * Lấy vai trò của tài khoản đang đăng nhập.
 * - admin: toàn quyền (tạo/sửa/xoá, đổi cấu hình)
 * - editor (biên soạn đề): tạo/sửa cuộc thi và câu hỏi, không đổi cấu hình hệ thống
 * - staff (kỹ thuật): chỉ xem và xuất báo cáo
 */
export function useMyRoles() {
  const query = useQuery({
    queryKey: ["my-role"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      return data.map((r) => r.role as AppRole);
    },
  });

  const roles = query.data ?? [];
  const isAdmin = roles.includes("admin");
  const isStaff = roles.includes("staff");
  const isEditor = roles.includes("editor");

  return {
    ...query,
    roles,
    isAdmin,
    isStaff,
    isEditor,
    /** Được vào khu quản trị */
    canAccessAdmin: isAdmin || isStaff || isEditor,
    /** Được thay đổi dữ liệu / cấu hình */
    canEdit: isAdmin || isEditor,
    /** Được soạn đề (câu hỏi, cuộc thi) */
    canAuthor: isAdmin || isEditor,
    /** Chỉ quản trị viên: cấu hình hệ thống, sao lưu, nhập dữ liệu */
    canManageSystem: isAdmin,
    /** Được xuất báo cáo */
    canExport: isAdmin || isStaff || isEditor,
    roleLabel: isAdmin
      ? "Quản trị viên"
      : isEditor
        ? "Biên soạn đề"
        : isStaff
          ? "Kỹ thuật (chỉ xem)"
          : "Chưa cấp quyền",
  };
}

