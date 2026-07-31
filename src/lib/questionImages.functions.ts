import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const commitSchema = z.object({
  path: z.string().min(1).max(400),
  quizId: z.string().uuid(),
  questionId: z.string().uuid(),
});

/** Chỉ quản trị viên hoặc người biên soạn đề mới được thao tác kho ảnh. */
async function assertEditor(context: { supabase: any; userId: string }) {
  const [admin, editor] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "editor" }),
  ]);
  if (!admin.data && !editor.data) throw new Error("Không có quyền thao tác kho ảnh câu hỏi.");
  return Boolean(admin.data);
}

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!data) throw new Error("Chỉ quản trị viên mới được dọn kho ảnh.");
}

/**
 * Chuyển ảnh từ thư mục tạm sang thư mục chính thức của câu hỏi rồi cập nhật
 * `questions.image_url`. Gọi sau khi lưu câu hỏi thành công.
 */
export const commitQuestionImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => commitSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertEditor(context);
    const { isTempImagePath, committedImagePath } = await import("@/lib/questionImagePaths");
    if (!isTempImagePath(data.path)) return { path: data.path, moved: false };

    const target = committedImagePath(data.path, data.quizId, data.questionId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("question-images")
      .move(data.path, target);
    if (error) throw new Error(error.message);

    const { error: updateError } = await supabaseAdmin
      .from("questions")
      .update({ image_url: target })
      .eq("id", data.questionId);
    if (updateError) throw new Error(updateError.message);

    return { path: target, moved: true };
  });

/** Liệt kê đệ quy toàn bộ tệp trong kho ảnh câu hỏi. */
async function listAllFiles(storage: any, prefix = ""): Promise<
  { path: string; size: number; createdAt: string | null }[]
> {
  const out: { path: string; size: number; createdAt: string | null }[] = [];
  const stack: string[] = [prefix];
  while (stack.length) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await storage.list(dir, { limit: 1000, offset });
      if (error) throw new Error(error.message);
      const items = data ?? [];
      for (const item of items) {
        const path = dir ? `${dir}/${item.name}` : item.name;
        if (item.id) {
          out.push({
            path,
            size: Number(item.metadata?.size ?? 0),
            createdAt: item.created_at ?? null,
          });
        } else {
          stack.push(path);
        }
      }
      if (items.length < 1000) break;
      offset += items.length;
    }
  }
  return out;
}

/** Tập hợp mọi đường dẫn ảnh đang được câu hỏi tham chiếu (đọc theo lô). */
async function referencedPaths(admin: any): Promise<Set<string>> {
  const set = new Set<string>();
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from("questions")
      .select("image_url")
      .not("image_url", "is", null)
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) if (row.image_url) set.add(row.image_url as string);
    if (!data || data.length < PAGE) break;
  }
  return set;
}

export type ImageStorageStats = { files: number; bytes: number; tmpFiles: number };

/** Thống kê dung lượng kho ảnh câu hỏi. */
export const getQuestionImageStats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ImageStorageStats> => {
    await assertEditor(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { isTempImagePath } = await import("@/lib/questionImagePaths");
    const files = await listAllFiles(supabaseAdmin.storage.from("question-images"));
    return {
      files: files.length,
      bytes: files.reduce((s, f) => s + (f.size || 0), 0),
      tmpFiles: files.filter((f) => isTempImagePath(f.path)).length,
    };
  });

export type CleanupResult = {
  deleted: number;
  bytes: number;
  tmpCount: number;
  orphanCount: number;
};

/** Xoá ảnh tạm quá hạn và ảnh mồ côi. Dùng chung cho nút quản trị và cron. */
export async function cleanupOrphanImages(): Promise<CleanupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { planOrphanCleanup, chunk } = await import("@/lib/questionImagePaths");
  const storage = supabaseAdmin.storage.from("question-images");

  const [files, referenced] = await Promise.all([
    listAllFiles(storage),
    referencedPaths(supabaseAdmin),
  ]);
  const plan = planOrphanCleanup(files, referenced, Date.now());

  for (const batch of chunk(plan.toDelete, 100)) {
    const { error } = await storage.remove(batch);
    if (error) throw new Error(error.message);
  }

  return {
    deleted: plan.toDelete.length,
    bytes: plan.bytes,
    tmpCount: plan.tmpCount,
    orphanCount: plan.orphanCount,
  };
}

/** Nút "Dọn ảnh không dùng" trong màn quản trị (chỉ quản trị viên). */
export const cleanupOrphanQuestionImages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CleanupResult> => {
    await assertAdmin(context);
    return cleanupOrphanImages();
  });
