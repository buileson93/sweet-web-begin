import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ExamEventRow = {
  id: string;
  kind: string;
  weight: number;
  detail: { hiddenMs?: number; documentVisible?: boolean; clientHint?: boolean; reason?: string };
  createdAt: string;
};

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error("Không kiểm tra được quyền quản trị.");
  if (!data) throw new Error("Chỉ quản trị viên mới được thực hiện thao tác này.");
}

/** Danh sách sự kiện liêm chính của một phiên thi (chỉ quản trị/giám sát xem được). */
export const listExamEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ExamEventRow[]> => {
    const { data: allowed } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    const { data: staff } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "staff",
    });
    if (!allowed && !staff) throw new Error("Không có quyền xem nhật ký hành vi.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("exam_events")
      .select("id, kind, weight, detail, created_at")
      .eq("session_id", data.sessionId)
      .order("created_at", { ascending: true })
      .limit(50);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id,
      kind: r.kind,
      weight: r.weight,
      detail: (r.detail ?? {}) as ExamEventRow["detail"],
      createdAt: r.created_at,
    }));
  });

/** Phục hồi bài thi bị huỷ: bỏ cờ huỷ, lưu người/thời điểm phục hồi và ghi nhật ký. */
export const restoreResult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ resultId: z.string().uuid(), reason: z.string().trim().min(5).max(300) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error: readError } = await supabaseAdmin
      .from("results")
      .select("id, candidate_name, session_id, score, total, disqualified")
      .eq("id", data.resultId)
      .maybeSingle();
    if (readError) throw new Error(readError.message);
    if (!row) throw new Error("Không tìm thấy kết quả cần phục hồi.");

    const { data: quizPass } = await supabaseAdmin
      .from("results")
      .select("quiz_id")
      .eq("id", data.resultId)
      .maybeSingle();
    const { data: quiz } = quizPass?.quiz_id
      ? await supabaseAdmin.from("quizzes").select("pass_percent").eq("id", quizPass.quiz_id).maybeSingle()
      : { data: null };

    const passPercent = quiz?.pass_percent ?? 50;
    const passed = row.total > 0 && (row.score / row.total) * 100 >= passPercent;

    const { error } = await supabaseAdmin
      .from("results")
      .update({
        disqualified: false,
        passed,
        disqualify_reason: `Đã phục hồi: ${data.reason}`,
        restored_by: context.userId,
        restored_at: new Date().toISOString(),
      })
      .eq("id", data.resultId);
    if (error) throw new Error(error.message);

    if (row.session_id) {
      await supabaseAdmin.from("exam_sessions").update({ status: "submitted" }).eq("id", row.session_id);
    }

    await supabaseAdmin.from("audit_logs").insert({
      user_id: context.userId,
      actor_email: (context.claims?.email as string) ?? "",
      action: "restore",
      entity: "result",
      entity_id: data.resultId,
      entity_label: row.candidate_name,
      details: { reason: data.reason } as never,
    });

    return { ok: true };
  });
