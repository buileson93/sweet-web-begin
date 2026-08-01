import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
