import { supabase } from "@/integrations/supabase/client";

export const QUESTION_IMAGE_BUCKET = "question-images";

/** Kích thước cạnh dài tối đa sau khi nén (px). */
const MAX_EDGE = 1280;
/** Dung lượng mục tiêu sau khi nén (byte). */
const TARGET_BYTES = 180 * 1024;

/**
 * Nén ảnh ngay trên trình duyệt trước khi tải lên: thu nhỏ cạnh dài về tối đa
 * 1280px và mã hoá WebP, giảm dần chất lượng cho tới khi đạt dung lượng mục tiêu.
 */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  if (!file.type.startsWith("image/")) throw new Error("Tệp không phải là hình ảnh.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ nén ảnh.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.82;
  let blob = await toBlob(canvas, quality);
  while (blob.size > TARGET_BYTES && quality > 0.4) {
    quality -= 0.12;
    blob = await toBlob(canvas, quality);
  }
  return { blob, width, height };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Không nén được ảnh."))),
      "image/webp",
      quality,
    );
  });
}

/** Nén rồi tải ảnh lên kho lưu trữ nội bộ, trả về đường dẫn đối tượng. */
export async function uploadQuestionImage(file: File, quizId: string) {
  const { blob } = await compressImage(file);
  const path = `${quizId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return { path, bytes: blob.size };
}

export async function removeQuestionImage(path: string) {
  await supabase.storage.from(QUESTION_IMAGE_BUCKET).remove([path]);
}

/** Đường dẫn hiển thị ảnh câu hỏi (máy chủ đọc hộ, kho lưu trữ không mở công khai). */
export function questionImageSrc(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return `/api/public/anh-cau-hoi/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
