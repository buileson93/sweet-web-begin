import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({ quizId: z.string().uuid().or(z.literal("all")) });

export const getQuizStatsSummary = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId } = data;

    // 1. Lấy danh sách nhân viên để biết tổng số người cần thi
    // Nếu có quizId cụ thể, ta có thể lọc theo quiz_audiences nếu muốn chính xác hơn
    // Ở đây ta lấy tổng nhân viên đang hoạt động làm mốc tham chiếu "Tổng số người"
    const { count: totalEmployees } = await supabaseAdmin
      .from("employees")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true);

    // 2. Đếm số người ĐÃ NỘP bài (Deduplicated by employee_id)
    let submittedQuery = supabaseAdmin
      .from("exam_sessions")
      .select("employee_id", { count: "exact", head: false })
      .in("status", ["submitted", "grading"]);
    
    if (quizId !== "all") {
      submittedQuery = submittedQuery.eq("quiz_id", quizId);
    }
    
    const { data: submittedData } = await submittedQuery;
    const submittedUniqueCount = new Set(submittedData?.map(d => d.employee_id).filter(Boolean)).size;

    // 3. Đếm số người ĐẠT (score >= 50%) - Deduplicated by employee_id
    // Lấy bài tốt nhất của mỗi người
    let passedQuery = supabaseAdmin
      .from("results")
      .select("employee_id")
      .eq("disqualified", false)
      .eq("passed", true);
    
    if (quizId !== "all") {
      passedQuery = passedQuery.eq("quiz_id", quizId);
    }
    
    const { data: passedData } = await passedQuery;
    const passedUniqueCount = new Set(passedData?.map(d => d.employee_id).filter(Boolean)).size;

    // 4. Tổng số lượt thi (không deduplicate)
    let totalAttemptsQuery = supabaseAdmin
      .from("exam_sessions")
      .select("*", { count: "exact", head: true })
      .in("status", ["submitted", "grading"]);
    
    if (quizId !== "all") {
      totalAttemptsQuery = totalAttemptsQuery.eq("quiz_id", quizId);
    }
    const { count: totalAttempts } = await totalAttemptsQuery;

    const total = totalEmployees ?? 0;
    
    return {
      totalEmployees: total,
      submittedCount: submittedUniqueCount,
      notSubmittedCount: Math.max(0, total - submittedUniqueCount),
      passedCount: passedUniqueCount,
      failedCount: Math.max(0, submittedUniqueCount - passedUniqueCount),
      totalAttempts: totalAttempts ?? 0
    };
  });
