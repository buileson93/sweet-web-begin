import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ quizIds: z.array(z.string().uuid()).min(1).max(30) });

export type ParticipationRate = { done: number; total: number; percent: number };

/**
 * Tỉ lệ tham gia công khai cho từng cuộc thi (chỉ trả về con số tổng hợp,
 * không kèm bất kỳ thông tin cá nhân nào) để vẽ thanh tiến độ ở trang chủ.
 */
export const getPublicParticipationRates = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: audiences, error: audErr }, { data: units, error: unitErr }, { data: roster, error: rosterErr }] =
      await Promise.all([
        supabaseAdmin.from("quiz_audiences").select("quiz_id, unit_id").in("quiz_id", data.quizIds),
        supabaseAdmin.from("units").select("id, name"),
        supabaseAdmin.from("employees").select("id, unit_name").eq("is_active", true).limit(5000),
      ]);
    if (audErr) throw new Error(audErr.message);
    if (unitErr) throw new Error(unitErr.message);
    if (rosterErr) throw new Error(rosterErr.message);

    const { data: attempts, error: attemptErr } = await supabaseAdmin
      .from("results")
      .select("quiz_id, employee_id")
      .in("quiz_id", data.quizIds)
      .eq("disqualified", false)
      .limit(50000);
    if (attemptErr) throw new Error(attemptErr.message);

    const unitName = new Map((units ?? []).map((u) => [u.id, u.name]));
    const audienceByQuiz = new Map<string, Set<string>>();
    for (const a of audiences ?? []) {
      const name = unitName.get(a.unit_id);
      if (!name) continue;
      const set = audienceByQuiz.get(a.quiz_id) ?? new Set<string>();
      set.add(name);
      audienceByQuiz.set(a.quiz_id, set);
    }

    const doneByQuiz = new Map<string, Set<string>>();
    for (const r of attempts ?? []) {
      if (!r.quiz_id || !r.employee_id) continue;
      const set = doneByQuiz.get(r.quiz_id) ?? new Set<string>();
      set.add(r.employee_id);
      doneByQuiz.set(r.quiz_id, set);
    }

    const out: Record<string, ParticipationRate> = {};
    for (const quizId of data.quizIds) {
      const units = audienceByQuiz.get(quizId);
      const eligible = units ? (roster ?? []).filter((e) => e.unit_name && units.has(e.unit_name)) : (roster ?? []);
      const total = eligible.length;
      const eligibleIds = new Set(eligible.map((e) => e.id));
      const done = [...(doneByQuiz.get(quizId) ?? [])].filter((id) => eligibleIds.has(id)).length;
      out[quizId] = { done, total, percent: total === 0 ? 0 : Math.round((done / total) * 100) };
    }
    return out;
  });
