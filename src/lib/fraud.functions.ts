import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FraudAttempt } from "./fraudTypes";

const reportSchema = z.object({
  quizId: z.string().uuid().optional(),
  minIntegrity: z.number().int().min(0).max(100).default(95),
  limit: z.number().int().min(1).max(500).default(100),
});

/** Lấy báo cáo các trường hợp nghi vấn gian lận. */
export const getFraudReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => reportSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<FraudAttempt[]> => {
    const { assertMonitorRole, fetchFraudReport } = await import("./fraud.server");
    await assertMonitorRole(context.supabase, context.userId);

    return fetchFraudReport(data.quizId, data.minIntegrity, data.limit);
  });

/** Lấy nhật ký sự kiện chi tiết của một phiên thi nghi vấn. */
export const getAttemptEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { assertMonitorRole, fetchAttemptEvents } = await import("./fraud.server");
    await assertMonitorRole(context.supabase, context.userId);
    
    return fetchAttemptEvents(data.sessionId);
  });
