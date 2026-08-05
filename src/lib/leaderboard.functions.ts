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
    // SỬ DỤNG TRUY VẤN SELECT COUNT(*) ĐỂ KHÔNG BỊ GIỚI HẠN DÒNG CỦA CLIENT SDK
    const countQuery = supabaseAdmin
      .from('exam_sessions')
      .select('employee_id, candidate_name, unit', { count: 'exact' });

    if (quizId !== 'all') {
      countQuery.eq('quiz_id', quizId);
    }
    
    // Ở đây chúng ta vẫn cần list để map, nhưng để tránh giới hạn 1000 dòng của Supabase JS Client, 
    // chúng ta sẽ fetch theo từng trang (pagination) nếu cần, hoặc dùng limit lớn.
    // Thực tế, supabaseAdmin (service_role) vẫn bị giới hạn default 1000 nếu không set limit.
    const { data: allSessions, error: sessionsError } = await countQuery.limit(50000);
    if (sessionsError) throw sessionsError;

    const finalAttemptMap = new Map<string, number>();
    for (const s of allSessions || []) {
      const key = s.employee_id || `${(s.candidate_name || "").trim().toLowerCase()}|${(s.unit || "").trim().toLowerCase()}`;
      finalAttemptMap.set(key, (finalAttemptMap.get(key) || 0) + 1);
    }

    // Gắn số lượt thi thực tế vào kết quả trả về
    const resultsWithRealAttempts = (results || []).map(r => {
      const key = r.employee_id || `${(r.candidate_name || "").trim().toLowerCase()}|${(r.unit || "").trim().toLowerCase()}`;
      return {
        ...r,
        attempts: finalAttemptMap.get(key) || 1
      };
    });

    return resultsWithRealAttempts;
  });
