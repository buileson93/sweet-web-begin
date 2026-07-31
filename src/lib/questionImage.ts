import { supabase } from "@/integrations/supabase/client";

import {
  tempImagePath,
} from "@/lib/questionImagePaths";
import {
  HEIC_MESSAGE,
  isHeicFile,
  planResize,
  validateImageInput,
} from "@/lib/imageProcessing";

export { isTempImagePath, tempImagePath } from "@/lib/questionImagePaths";

export {
  extractImageFromClipboard,
  formatBytes,
  planResize,
  validateImageInput,
  SOFT_WARN_BYTES,
  HEIC_MESSAGE,
} from "@/lib/imageProcessing";

export const QUESTION_IMAGE_BUCKET = "question-images";

/** Kích thước cạnh dài tối đa sau khi nén (px). */
const MAX_EDGE = 1280;
/** Dung lượng mục tiêu sau khi nén (byte). */
const TARGET_BYTES = 180 * 1024;

/** Ảnh của từng phương án nhỏ hơn nhiều nên nén mạnh tay hơn. */
export const OPTION_IMAGE_MAX_EDGE = 640;
export const OPTION_IMAGE_TARGET_BYTES = 80 * 1024;

export type CompressOptions = { maxEdge?: number; targetBytes?: number };

export type CompressedImage = {
  blob: Blob;
  width: number;
  height: number;
  mime: string;
  ext: string;
};

/** Giải mã ảnh, ưu tiên giữ đúng hướng chụp (EXIF) của điện thoại. */
async function decode(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    try {
      return await createImageBitmap(file);
    } catch {
      if (isHeicFile(file.name, file.type)) throw new Error(HEIC_MESSAGE);
      throw new Error("Không đọc được tệp ảnh này. Vui lòng thử ảnh PNG hoặc JPG.");
    }
  }
}

/**
 * Nén ảnh ngay trên trình duyệt trước khi tải lên: thu nhỏ cạnh dài về tối đa
 * 1280px và mã hoá WebP (tự lùi về JPEG nếu trình duyệt không hỗ trợ WebP),
 * giảm dần chất lượng cho tới khi đạt dung lượng mục tiêu.
 */
export async function compressImage(
  file: File,
  opts: CompressOptions = {},
): Promise<CompressedImage> {
  const maxEdge = opts.maxEdge ?? MAX_EDGE;
  const targetBytes = opts.targetBytes ?? TARGET_BYTES;
  if (!file.type.startsWith("image/") && !isHeicFile(file.name, file.type))
    throw new Error("Tệp không phải là hình ảnh.");

  const sizeCheck = validateImageInput(file.size);
  if (!sizeCheck.ok) throw new Error(sizeCheck.message);

  const bitmap = await decode(file);
  const pixelCheck = validateImageInput(file.size, bitmap.width, bitmap.height);
  if (!pixelCheck.ok) {
    bitmap.close?.();
    throw new Error(pixelCheck.message);
  }

  const { width, height } = planResize(bitmap.width, bitmap.height, maxEdge);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ nén ảnh.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.82;
  let blob = await encode(canvas, quality);
  while (blob.size > targetBytes && quality > 0.4) {
    quality -= 0.12;
    blob = await encode(canvas, quality);
  }
  const mime = blob.type || "image/jpeg";
  return { blob, width, height, mime, ext: mime === "image/webp" ? "webp" : "jpg" };
}

/** Mã hoá canvas: thử WebP trước, không được thì lùi về JPEG. */
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", 0.85);
  if (jpeg) return jpeg;
  throw new Error("Không nén được ảnh.");
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/** Nén rồi tải ảnh lên kho lưu trữ nội bộ, trả về đường dẫn đối tượng. */
export async function uploadQuestionImage(
  file: File,
  quizId: string,
  onStage?: (stage: "compressing" | "uploading") => void,
  opts: CompressOptions = {},
) {
  onStage?.("compressing");
  const { blob, width, height, mime, ext } = await compressImage(file, opts);
  onStage?.("uploading");
  // Tải lên thư mục tạm; chỉ khi lưu câu hỏi thành công ảnh mới được chuyển
  // sang thư mục chính thức. Ảnh tạm bị dọn tự động sau 24 giờ.
  const path = tempImagePath(quizId, ext, crypto.randomUUID());
  const { error } = await supabase.storage
    .from(QUESTION_IMAGE_BUCKET)
    .upload(path, blob, { contentType: mime, cacheControl: "31536000", upsert: false });
  if (error) throw new Error(error.message);
  return { path, bytes: blob.size, originalBytes: file.size, width, height, mime };
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

/**
 * Tải ảnh cho MỘT PHƯƠNG ÁN trả lời: nén về cạnh dài tối đa 640px, mục tiêu 80KB.
 */
export async function uploadOptionImage(
  file: File,
  quizId: string,
  onStage?: (stage: "compressing" | "uploading") => void,
) {
  return uploadQuestionImage(file, quizId, onStage, {
    maxEdge: OPTION_IMAGE_MAX_EDGE,
    targetBytes: OPTION_IMAGE_TARGET_BYTES,
  });
}
