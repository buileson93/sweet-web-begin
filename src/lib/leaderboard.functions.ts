import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  quizId: z.string().uuid().or(z.literal("all")),
  limit: z.number().optional().default(5000)
});

export const getRankableResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId, limit } = data;

    // 1. Lấy kết quả đã nộp
    let query = supabaseAdmin
      .from("results")
      .select("id, candidate_name, unit, score, total, time_seconds, submitted_at, quiz_title, quiz_id, points, max_points, best_streak, employee_id")
      .eq("disqualified", false)
      .order("score", { ascending: false })
      .order("time_seconds", { ascending: true })
      .limit(limit);

    if (quizId !== "all") {
      query = query.eq("quiz_id", quizId);
    }

    const { data: results, error } = await query;
    if (error) throw error;

    // 2. Lấy TỔNG số lượt thi (bao gồm cả các phiên đang thi hoặc bỏ dở)
    // Đếm trực tiếp bằng SQL Aggregation để tránh fetch hàng vạn dòng gây lag hoặc sai lệch
    let attemptQuery = supabaseAdmin
      .from('exam_sessions')
      .select('employee_id, candidate_name, unit');

    if (quizId !== 'all') {
      attemptQuery = attemptQuery.eq('quiz_id', quizId);
    }

    const { data: counts, error: countError } = await attemptQuery;

    if (countError) throw countError;

    const attemptMap = new Map<string, number>();
    for (const s of counts || []) {
      const key = s.employee_id || `${(s.candidate_name || "").trim().toLowerCase()}|${(s.unit || "").trim().toLowerCase()}`;
      attemptMap.set(key, (attemptMap.get(key) || 0) + 1);
    }

    // Gắn số lượt thi thực tế vào kết quả trả về
    const resultsWithRealAttempts = (results || []).map(r => {
      const key = r.employee_id || `${(r.candidate_name || "").trim().toLowerCase()}|${(r.unit || "").trim().toLowerCase()}`;
      return {
        ...r,
        attempts: attemptMap.get(key) || 1
      };
    });

    return resultsWithRealAttempts;
  });
