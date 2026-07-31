/**
 * Trợ giúp phía máy chủ cho kho ảnh câu hỏi (bucket `question-images`).
 * Tách riêng khỏi tệp *.functions.ts để tệp đó chỉ còn phần khai báo mỏng.
 */

const BUCKET = "question-images";

export type StoredImage = { path: string; size: number; createdAt: string | null };

/** Liệt kê đệ quy toàn bộ tệp trong kho ảnh câu hỏi. */
export async function listAllImages(storage: any, prefix = ""): Promise<StoredImage[]> {
  const out: StoredImage[] = [];
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
export async function referencedImagePaths(admin: any): Promise<Set<string>> {
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

export async function computeImageStats(): Promise<ImageStorageStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { isTempImagePath } = await import("@/lib/questionImagePaths");
  const files = await listAllImages(supabaseAdmin.storage.from(BUCKET));
  return {
    files: files.length,
    bytes: files.reduce((s, f) => s + (f.size || 0), 0),
    tmpFiles: files.filter((f) => isTempImagePath(f.path)).length,
  };
}

export type CleanupResult = {
  deleted: number;
  bytes: number;
  tmpCount: number;
  orphanCount: number;
};

/** Xoá ảnh tạm quá hạn 24 giờ và ảnh không còn câu hỏi nào tham chiếu. */
export async function cleanupOrphanImages(): Promise<CleanupResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { planOrphanCleanup, chunk } = await import("@/lib/questionImagePaths");
  const storage = supabaseAdmin.storage.from(BUCKET);

  const [files, referenced] = await Promise.all([
    listAllImages(storage),
    referencedImagePaths(supabaseAdmin),
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

/** Chuyển ảnh từ thư mục tạm sang thư mục chính thức của câu hỏi. */
export async function moveImageToQuestion(path: string, quizId: string, questionId: string) {
  const { isTempImagePath, committedImagePath } = await import("@/lib/questionImagePaths");
  if (!isTempImagePath(path)) return { path, moved: false };

  const target = committedImagePath(path, quizId, questionId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage.from(BUCKET).move(path, target);
  if (error) throw new Error(error.message);

  const { error: updateError } = await supabaseAdmin
    .from("questions")
    .update({ image_url: target })
    .eq("id", questionId);
  if (updateError) throw new Error(updateError.message);

  return { path: target, moved: true };
}

/** Xoá hẳn một danh sách ảnh khỏi kho (dùng khi xoá câu hỏi / cuộc thi). */
export async function removeImages(paths: string[]) {
  if (!paths.length) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { chunk } = await import("@/lib/questionImagePaths");
  const storage = supabaseAdmin.storage.from(BUCKET);
  for (const batch of chunk(paths, 100)) {
    const { error } = await storage.remove(batch);
    if (error) throw new Error(error.message);
  }
  return paths.length;
}
