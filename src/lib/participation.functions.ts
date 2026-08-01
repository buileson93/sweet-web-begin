import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ quizId: z.string().uuid() });

/** Chỉ quản trị viên / cán bộ tổ chức thi mới được xem danh bạ dự thi. */
async function assertCanViewRoster(context: { supabase: any; userId: string }) {
  const [admin, staff] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
  ]);
  if (admin.error || staff.error) throw new Error("Không kiểm tra được quyền truy cập.");
  if (!admin.data && !staff.data) {
    throw new Error("Bạn không có quyền xem danh sách dự thi.");
  }
}

/**
 * Danh sách nhân viên đã dự thi và chưa dự thi của một cuộc thi.
 * Chỉ trả về họ tên và đơn vị (không kèm số điện thoại/ngày sinh) để nhắc nhở dự thi.
 */
export const getQuizParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    // Dùng supabaseAdmin (bỏ qua RLS) nên BẮT BUỘC chặn quyền trước khi đọc danh bạ.
    await assertCanViewRoster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { splitParticipation } = await import("@/lib/participation");

    // Đối tượng dự thi: nếu cuộc thi giới hạn đơn vị thì chỉ lấy nhân viên các đơn vị đó.
    const { data: audiences, error: audienceError } = await supabaseAdmin
      .from("quiz_audiences")
      .select("unit_id")
      .eq("quiz_id", data.quizId);
    if (audienceError) throw new Error(audienceError.message);

    let unitNames: string[] | null = null;
    if (audiences && audiences.length > 0) {
      const { data: units, error: unitError } = await supabaseAdmin
        .from("units")
        .select("name")
        .in(
          "id",
          audiences.map((a) => a.unit_id),
        );
      if (unitError) throw new Error(unitError.message);
      unitNames = (units ?? []).map((u) => u.name);
    }

    let rosterQuery = supabaseAdmin
      .from("employees")
      .select("id, full_name, unit_name")
      .eq("is_active", true)
      .order("full_name", { ascending: true })
      .limit(5000);
    if (unitNames) rosterQuery = rosterQuery.in("unit_name", unitNames);

    const [{ data: roster, error: rosterError }, { data: attempts, error: attemptError }] = await Promise.all([
      rosterQuery,
      supabaseAdmin
        .from("results")
        .select("employee_id, score, total, submitted_at")
        .eq("quiz_id", data.quizId)
        .eq("disqualified", false)
        .limit(20000),
    ]);
    if (rosterError) throw new Error(rosterError.message);
    if (attemptError) throw new Error(attemptError.message);

    return splitParticipation(roster ?? [], attempts ?? []);
  });
