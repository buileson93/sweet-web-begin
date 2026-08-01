import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const credentialSchema = z.object({
  name: z.string().min(2).max(120),
  credential: z.string().min(4).max(20),
  extraCredential: z.string().max(20).optional(),
});

const answerSchema = z.union([
  z.number().int().min(0).max(50),
  z.array(z.number().int().min(0).max(50)).max(20),
  z.string().max(200),
  z.record(z.string(), z.number().int().min(0).max(50)),
]);

/** Số thẻ đến hạn ôn của một nhân viên (sau khi xác thực danh tính). */
export const getDueCount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialSchema.parse(input))
  .handler(async ({ data }) => {
    const { getDueSummary } = await import("@/lib/tower/due.server");
    return getDueSummary(data);
  });

/** Kiến trúc nhẹ máy chủ: mở Leo Tháp — một lượt đi về cho cả phiên chơi. */
export const openTowerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialSchema.parse(input))
  .handler(async ({ data }) => {
    const { openTower } = await import("@/lib/tower/progress.server");
    return openTower(data);
  });

/** Tải gói đề ôn tập (chỉ khi phiên bản trên máy đã cũ). */
export const getTowerBankFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialSchema.parse(input))
  .handler(async ({ data }) => {
    const { buildQuestionBank } = await import("@/lib/tower/bank.server");
    return buildQuestionBank(data);
  });

/** Đồng bộ tiến trình sau phiên chơi (gộp một lần ghi). */
export const syncTowerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    credentialSchema
      .extend({
        state: z.unknown(),
        runs: z.number().int().min(0).max(100000).optional(),
        bestStage: z.number().int().min(0).max(50).optional(),
        coins: z.number().int().min(0).max(1000000).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { syncTower } = await import("@/lib/tower/progress.server");
    return syncTower(data);
  });

/** Mở một phiên Leo Tháp (một lượt đi về cho cả phiên). */
export const startTower = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    credentialSchema.extend({ quizId: z.string().uuid().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { startTowerRun } = await import("@/lib/tower/run.server");
    return startTowerRun(data);
  });

/** Nộp cả một chặng 5 câu — máy chủ chấm lại và cập nhật lịch ôn theo lô. */
export const submitTowerStageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        runId: z.string().uuid(),
        token: z.string().uuid(),
        stageIndex: z.number().int().min(0).max(20),
        answers: z.record(z.string(), answerSchema),
        msTaken: z.record(z.string(), z.number().int().min(0).max(600000)).optional(),
        boonId: z.string().max(40).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { submitTowerStage } = await import("@/lib/tower/run.server");
    return submitTowerStage(data);
  });

/** Tổng kết phiên. */
export const finishTower = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ runId: z.string().uuid(), token: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { finishTowerRun } = await import("@/lib/tower/run.server");
    return finishTowerRun(data);
  });

/** Bản đồ năng lực cá nhân + dự báo sẵn sàng thi (chỉ tham khảo). */
export const getSkillMapFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialSchema.parse(input))
  .handler(async ({ data }) => {
    const { getSkillMap } = await import("@/lib/tower/topics.server");
    return getSkillMap(data);
  });

/** Báo cáo chủ đề yếu toàn đơn vị — chỉ quản trị viên, chỉ đọc, có phân trang. */
export const getOrgWeakTopicsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        page: z.number().int().min(1).max(1000).optional(),
        pageSize: z.number().int().min(5).max(50).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const admin = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!admin.data) throw new Error("Bạn không có quyền xem báo cáo này.");
    const { getOrgWeakTopics } = await import("@/lib/tower/topics.server");
    return getOrgWeakTopics(data);
  });
