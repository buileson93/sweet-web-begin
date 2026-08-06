import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ quizIds: z.array(z.string().uuid()).min(1).max(30) });

export type ParticipationRate = { done: number; total: number; percent: number };

/**
 * Tỉ lệ tham gia công khai cho từng cuộc thi sử dụng candidate_quiz_stats làm nguồn sự thật.
 */
export const getPublicParticipationRates = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Lấy danh sách đối tượng và đơn vị
    const [{ data: audiences, error: audErr }, { data: units, error: unitErr }, { data: roster, error: rosterErr }] =
      await Promise.all([
        supabaseAdmin.from("quiz_audiences").select("quiz_id, unit_id").in("quiz_id", data.quizIds),
        supabaseAdmin.from("units").select("id, name"),
        supabaseAdmin.from("employees").select("id, unit_name").eq("is_active", true).limit(10000),
      ]);
    if (audErr) throw new Error(audErr.message);
    if (unitErr) throw new Error(unitErr.message);
    if (rosterErr) throw new Error(rosterErr.message);

    // 2. Lấy thống kê đã nộp từ candidate_quiz_stats (chứa số người nộp thực tế)
    const { data: stats, error: statsErr } = await supabaseAdmin
      .from("candidate_quiz_stats")
      .select("quiz_id, employee_id, submitted_count")
      .in("quiz_id", data.quizIds)
      .gt("submitted_count", 0);
    if (statsErr) throw new Error(statsErr.message);

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
    for (const s of stats ?? []) {
      if (!s.quiz_id || !s.employee_id) continue;
      const set = doneByQuiz.get(s.quiz_id) ?? new Set<string>();
      set.add(s.employee_id);
      doneByQuiz.set(s.quiz_id, set);
    }

    const out: Record<string, ParticipationRate> = {};
    for (const quizId of data.quizIds) {
      const targetUnits = audienceByQuiz.get(quizId);
      // Lọc danh sách nhân viên thuộc diện tham gia
      const eligible = targetUnits 
        ? (roster ?? []).filter((e) => e.unit_name && targetUnits.has(e.unit_name)) 
        : (roster ?? []);
      
      const total = eligible.length;
      const eligibleIds = new Set(eligible.map((e) => e.id));
      
      // Chỉ đếm những nhân viên thuộc diện tham gia và đã có bản nộp
      const done = [...(doneByQuiz.get(quizId) ?? [])].filter((id) => eligibleIds.has(id)).length;
      
      out[quizId] = { 
        done, 
        total, 
        percent: total === 0 ? 0 : Math.round((done / total) * 100) 
      };
    }
    return out;
  });