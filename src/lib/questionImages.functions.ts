import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { CleanupResult, ImageStorageStats } from "@/lib/questionImages.server";

export type { CleanupResult, ImageStorageStats };

const commitSchema = z.object({
  path: z.string().min(1).max(400),
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
});

/**
 * Chuyển ảnh từ thư mục tạm sang thư mục chính thức của câu hỏi rồi cập nhật
 * `questions.image_url`. Gọi sau khi lưu câu hỏi thành công.
 */
export const commitQuestionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => commitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { moveImageToQuestion } = await import("@/lib/questionImages.server");
    return moveImageToQuestion(data.path, data.quizId, data.questionId);
  });

const optionCommitSchema = z.object({
  paths: z.array(z.string().max(400)).max(30),
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
});

/** Chuyển ảnh của từng phương án từ thư mục tạm sang thư mục chính thức. */
export const commitOptionImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => optionCommitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { commitOptionImages: run } = await import("@/lib/questionImages.server");
    return run(data.paths, data.quizId, data.questionId);
  });

/** Nhân bản ảnh phương án cho câu hỏi bản sao. */
export const duplicateOptionImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => optionCommitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { copyOptionImagesForQuestion } = await import("@/lib/questionImages.server");
    return copyOptionImagesForQuestion(data.paths, data.quizId, data.questionId);
  });

/** Thống kê số tệp và dung lượng kho ảnh câu hỏi. */
export const getQuestionImageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageStorageStats> => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { computeImageStats } = await import("@/lib/questionImages.server");
    return computeImageStats();
  });

/** Nút "Dọn ảnh không dùng" trong màn quản trị (chỉ quản trị viên). */
export const cleanupOrphanQuestionImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CleanupResult> => {
    const { assertImageAdmin } = await import("@/lib/questionImageAuth.server");
    await assertImageAdmin(context);
    const { cleanupOrphanImages } = await import("@/lib/questionImages.server");
    return cleanupOrphanImages();
  });

/** Thu hồi ảnh của mọi câu hỏi thuộc một cuộc thi TRƯỚC khi xoá cuộc thi. */
export const purgeQuizImages = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ quizId: z.string().uuid() }).parse(input))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }): Promise<{ removed: number }> => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("questions")
      .select("image_url, option_images")
      .eq("quiz_id", data.quizId);
    if (error) throw new Error(error.message);
    const paths = (rows ?? [])
      .flatMap((r) => [r.image_url as string | null, ...((r.option_images ?? []) as string[])])
      .filter((p): p is string => Boolean(p));
    const { removeImages } = await import("@/lib/questionImages.server");
    return { removed: await removeImages(paths) };
  });

/** Nhân bản ảnh sang đường dẫn riêng của câu hỏi bản sao. */
export const duplicateQuestionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => commitSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { copyImageForQuestion } = await import("@/lib/questionImages.server");
    return copyImageForQuestion(data.path, data.quizId, data.questionId);
  });

/** Chuyển ảnh của các câu hỏi vừa đổi cuộc thi sang thư mục cuộc thi mới. */
export const relocateQuestionImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ questionIds: z.array(z.string().uuid()).min(1).max(500), quizId: z.string().uuid() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ moved: number }> => {
    const { assertImageEditor } = await import("@/lib/questionImageAuth.server");
    await assertImageEditor(context);
    const { relocateImagesToQuiz } = await import("@/lib/questionImages.server");
    return { moved: await relocateImagesToQuiz(data.questionIds, data.quizId) };
  });
