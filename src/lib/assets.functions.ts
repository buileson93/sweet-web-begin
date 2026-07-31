import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { QuizAsset } from "@/lib/assets.server";

export type { QuizAsset };

/** Chỉ quản trị viên hoặc người soạn đề mới được dùng kho tài nguyên. */
async function assertAssetEditor(context: { supabase: any; userId: string }) {
  const [admin, editor] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" }),
  ]);
  if (!admin.data && !editor.data) throw new Error("Bạn không có quyền dùng kho tài nguyên.");
}

export const listAssets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().max(120).optional(), tag: z.string().max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<QuizAsset[]> => {
    await assertAssetEditor(context);
    const { listQuizAssets } = await import("@/lib/assets.server");
    return listQuizAssets(data);
  });

export const uploadAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().max(120).default(""),
        tags: z.array(z.string().max(40)).max(8).default([]),
        contentType: z.enum(["image/png", "image/jpeg", "image/webp"]),
        base64: z.string().min(16).max(6_000_000),
        width: z.number().int().min(0).max(10000).default(0),
        height: z.number().int().min(0).max(10000).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<QuizAsset> => {
    await assertAssetEditor(context);
    const { uploadQuizAsset } = await import("@/lib/assets.server");
    return uploadQuizAsset({ ...data, userId: context.userId });
  });

export const removeAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAssetEditor(context);
    const { deleteQuizAsset } = await import("@/lib/assets.server");
    return deleteQuizAsset(data.id);
  });
