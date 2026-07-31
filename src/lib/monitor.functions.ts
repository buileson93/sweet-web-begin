import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { LivePage, SessionDetail } from "@/lib/monitorTypes";

export type { LivePage, LiveSession, SessionAnswer, SessionDetail } from "@/lib/monitorTypes";

const pageSchema = z.object({
  limit: z.number().int().min(10).max(100).default(25),
  offset: z.number().int().min(0).max(1000).default(0),
  /** Phiên bản dữ liệu client đang giữ — trùng thì máy chủ không gửi lại. */
  knownVersion: z.string().max(32).optional(),
});

/** Danh sách phiên thi (2 giờ gần nhất) theo trang, chỉ trả dữ liệu khi có thay đổi. */
export const listLiveSessions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => pageSchema.parse(input ?? {}))
  .handler(async ({ data, context }): Promise<LivePage> => {
    const { assertMonitorRole, loadLivePage } = await import("@/lib/monitor.server");
    await assertMonitorRole(context.supabase, context.userId);

    const page = await loadLivePage(data.limit, data.offset);
    if (data.knownVersion && data.knownVersion === page.version) {
      return { ...page, rows: [], changed: false };
    }
    return { ...page, changed: true };
  });

/** Chi tiết một phiên thi: từng câu hỏi, đáp án thí sinh chọn và đáp án đúng. */
export const getSessionDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<SessionDetail> => {
    const { assertMonitorRole, loadSessionDetail } = await import("@/lib/monitor.server");
    await assertMonitorRole(context.supabase, context.userId);
    return loadSessionDetail(data.sessionId);
  });
