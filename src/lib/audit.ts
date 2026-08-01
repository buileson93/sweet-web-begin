import { supabase } from "@/integrations/supabase/client";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "import"
  | "export"
  | "restore"
  | "login_success"
  | "login_failed"
  /** Hành vi nhạy cảm — tách riêng để truy vết nhanh khi có khiếu nại kết quả thi. */
  | "role_grant"
  | "role_revoke"
  | "quiz_config";
export type AuditEntity = "quiz" | "question" | "unit" | "result" | "employee" | "role";

export const AUDIT_ACTION_LABEL: Record<AuditAction, string> = {
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xoá",
  import: "Nhập hàng loạt",
  export: "Xuất báo cáo",
  restore: "Khôi phục",
  login_success: "Đăng nhập nhanh",
  login_failed: "Đăng nhập thất bại",
  role_grant: "Cấp quyền quản trị",
  role_revoke: "Thu hồi quyền quản trị",
  quiz_config: "Sửa cấu hình cuộc thi",
};

export const AUDIT_ENTITY_LABEL: Record<AuditEntity, string> = {
  quiz: "Cuộc thi",
  question: "Câu hỏi",
  unit: "Đơn vị",
  result: "Kết quả",
  employee: "Nhân viên",
  role: "Phân quyền",
};


export type AuditLogRow = {
  id: string;
  user_id: string | null;
  actor_email: string;
  action: string;
  entity: string;
  entity_id: string | null;
  entity_label: string;
  details: unknown;
  created_at: string;
};

/**
 * Ghi lại một thao tác quản trị. Không bao giờ ném lỗi ra ngoài để tránh
 * làm hỏng luồng nghiệp vụ chính khi ghi nhật ký thất bại.
 */
export async function logAudit(input: {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string | null;
  entityLabel?: string;
  details?: Record<string, unknown>;
}) {
  try {
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user) return;
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      actor_email: user.email ?? "",
      action: input.action,
      entity: input.entity,
      entity_id: input.entityId ?? null,
      entity_label: input.entityLabel ?? "",
      details: (input.details ?? {}) as never,
    });
  } catch {
    /* nhật ký là phụ trợ - bỏ qua lỗi */
  }
}
