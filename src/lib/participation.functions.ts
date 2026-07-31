import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ quizId: z.string().uuid() });

/**
 * Danh sách nhân viên đã dự thi và chưa dự thi của một cuộc thi.
 * Chỉ trả về họ tên và đơn vị (không kèm số điện thoại/ngày sinh) để nhắc nhở dự thi.
 */
export const getQuizParticipation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
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
