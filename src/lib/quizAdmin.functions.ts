import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AudienceStats, QuizPreview } from "@/lib/quizAdmin.server";
import type { PoolStats } from "@/lib/quizHealth";

export type { AudienceStats, QuizPreview };

/** Chỉ quản trị viên hoặc người soạn đề mới được dùng các chức năng này. */
async function assertQuizEditor(context: { supabase: any; userId: string }) {
  const [admin, editor] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" }),
  ]);
  if (!admin.data && !editor.data) throw new Error("Bạn không có quyền thao tác với cuộc thi.");
}

const quizIdSchema = z.object({ quizId: z.string().uuid() });

/** Sinh thử một đề để duyệt — không tạo phiên thi, không trả về đáp án đúng. */
export const previewQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quizIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<QuizPreview> => {
    await assertQuizEditor(context);
    const { previewQuizPaper } = await import("@/lib/quizAdmin.server");
    return previewQuizPaper(data.quizId);
  });

/** Thống kê kho câu hỏi (theo độ khó và theo thẻ) phục vụ bảng sức khoẻ đề. */
export const getQuizPoolStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quizIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<PoolStats> => {
    await assertQuizEditor(context);
    const { quizPoolStats } = await import("@/lib/quizAdmin.server");
    return quizPoolStats(data.quizId);
  });

/** Số người thuộc đối tượng dự thi và tỉ lệ đã thi. */
export const getQuizAudienceStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => quizIdSchema.parse(input))
  .handler(async ({ data, context }): Promise<AudienceStats> => {
    await assertQuizEditor(context);
    const { quizAudienceStats } = await import("@/lib/quizAdmin.server");
    return quizAudienceStats(data.quizId);
  });

/** Nhân bản cuộc thi (kèm hoặc không kèm ngân hàng câu hỏi). */
export const duplicateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    quizIdSchema.extend({ copyQuestions: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertQuizEditor(context);
    const { duplicateQuizRow } = await import("@/lib/quizAdmin.server");
    return duplicateQuizRow(data);
  });
