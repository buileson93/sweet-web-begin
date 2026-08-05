import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  quizId: z.string().uuid().or(z.literal("all")),
  limit: z.number().optional().default(3000)
});

export const getRankableResults = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { quizId, limit } = data;

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

    return results;
  });
