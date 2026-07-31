import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Ghi nhật ký quản trị cho các sự kiện quan trọng của Đấu trường. */
export async function logArenaAudit(
  action: "create" | "update" | "delete",
  duelId: string,
  label: string,
  details: Record<string, unknown> = {},
) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: null,
      actor_email: "Đấu trường",
      action,
      entity: "result",
      entity_id: duelId,
      entity_label: label,
      details: details as never,
    });
  } catch {
    /* nhật ký là phụ trợ */
  }
}
