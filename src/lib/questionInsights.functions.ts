import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  DuplicateHit,
  QuestionStats,
  QuestionVersion,
} from "@/lib/questionInsights.server";

export type { DuplicateHit, QuestionStats, QuestionVersion };

/** Chỉ quản trị viên hoặc người soạn đề mới được xem dữ liệu ngân hàng câu hỏi. */
async function assertQuestionEditor(context: { supabase: any; userId: string }) {
  const [admin, editor] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" }),
  ]);
  if (!admin.data && !editor.data) throw new Error("Bạn không có quyền xem dữ liệu câu hỏi.");
}

/** Kiểm tra câu hỏi có bị soạn trùng ở bất kỳ cuộc thi nào không. */
export const checkDuplicateQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ question: z.string(), excludeId: z.string().uuid().nullable().optional() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<DuplicateHit[]> => {
    await assertQuestionEditor(context);
    const { findGlobalDuplicates } = await import("@/lib/questionInsights.server");
    return findGlobalDuplicates(data);
  });

/** Độ khó thực tế theo dữ liệu thi + lịch sử chỉnh sửa của một câu hỏi. */
export const getQuestionInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ questionId: z.string().uuid() }).parse(input))
  .handler(
    async ({ data, context }): Promise<{ stats: QuestionStats; versions: QuestionVersion[] }> => {
      await assertQuestionEditor(context);
      const { questionInsights } = await import("@/lib/questionInsights.server");
      return questionInsights(data.questionId);
    },
  );

/** Khôi phục câu hỏi về một phiên bản cũ (chỉ quản trị viên / người soạn đề). */
export const restoreQuestionVersionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ questionId: z.string().uuid(), versionId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ version: number }> => {
    await assertQuestionEditor(context);
    const { restoreQuestionVersion } = await import("@/lib/questionInsights.server");
    return restoreQuestionVersion(data);
  });
