/**
 * Kho tài nguyên ảnh dùng chung cho người thiết kế cuộc thi.
 * Ảnh nằm trong bucket `quiz-covers`, siêu dữ liệu nằm ở bảng `quiz_assets`.
 */
import { QUIZ_COVER_BUCKET } from "@/lib/quizCover";

export type QuizAsset = {
  id: string;
  title: string;
  storagePath: string;
  kind: string;
  tags: string[];
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
  /** Đường dẫn hiển thị qua proxy công khai. */
  url: string;
};

function shape(row: Record<string, unknown>): QuizAsset {
  const path = String(row.storage_path ?? "");
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    storagePath: path,
    kind: String(row.kind ?? "cover"),
    tags: (row.tags as string[]) ?? [],
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    sizeBytes: Number(row.size_bytes ?? 0),
    createdAt: String(row.created_at ?? ""),
    url: `/api/public/anh-bia/${path.split("/").map(encodeURIComponent).join("/")}`,
  };
}

/** Danh sách tài nguyên, lọc theo từ khoá/thẻ. */
export async function listQuizAssets(input: { search?: string; tag?: string } = {}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let query = supabaseAdmin
    .from("quiz_assets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  const search = (input.search ?? "").trim();
  if (search) query = query.ilike("title", `%${search}%`);
  if (input.tag) query = query.contains("tags", [input.tag]);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => shape(row as never));
}

/** Tải một ảnh mới lên kho dùng chung. */
export async function uploadQuizAsset(input: {
  title: string;
  tags: string[];
  contentType: string;
  base64: string;
  width: number;
  height: number;
  userId: string;
}): Promise<QuizAsset> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const bytes = Buffer.from(input.base64, "base64");
  if (bytes.byteLength > 3 * 1024 * 1024) throw new Error("Ảnh vượt quá 3MB.");
  const ext = input.contentType.includes("png")
    ? "png"
    : input.contentType.includes("webp")
      ? "webp"
      : "jpg";
  const path = `library/${crypto.randomUUID()}.${ext}`;

  const { error: upErr } = await supabaseAdmin.storage
    .from(QUIZ_COVER_BUCKET)
    .upload(path, bytes, { contentType: input.contentType, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { data, error } = await supabaseAdmin
    .from("quiz_assets")
    .insert({
      title: input.title.slice(0, 120) || "Ảnh không tên",
      storage_path: path,
      kind: "cover",
      tags: input.tags.slice(0, 8),
      width: input.width,
      height: input.height,
      size_bytes: bytes.byteLength,
      created_by: input.userId,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return shape(data as never);
}

/** Xoá tài nguyên khỏi kho (xoá cả tệp trong kho lưu trữ). */
export async function deleteQuizAsset(id: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("quiz_assets")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { ok: true };
  await supabaseAdmin.storage.from(QUIZ_COVER_BUCKET).remove([data.storage_path as string]);
  const { error: delErr } = await supabaseAdmin.from("quiz_assets").delete().eq("id", id);
  if (delErr) throw new Error(delErr.message);
  return { ok: true };
}
