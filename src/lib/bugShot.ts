/**
 * Nén ảnh chụp màn hình do người dùng đính kèm vào phiếu báo lỗi.
 *
 * Mục tiêu: giữ ảnh đủ rõ để đọc chữ trên giao diện nhưng dung lượng nhỏ
 * để gửi nhanh trên mạng di động (mặc định dưới ~500KB).
 */

export const MAX_SHOT_BYTES = 500 * 1024;
export const MAX_SHOT_EDGE = 1400;

/** Tính kích thước sau khi thu nhỏ, giữ nguyên tỉ lệ khung hình. */
export function fitWithin(w: number, h: number, maxEdge = MAX_SHOT_EDGE) {
  if (w <= 0 || h <= 0) return { width: 0, height: 0 };
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}

/** Ước lượng số byte thật của một chuỗi data URL base64. */
export function base64Bytes(dataUrl: string): number {
  const raw = dataUrl.split(",")[1] ?? "";
  const padding = raw.endsWith("==") ? 2 : raw.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((raw.length * 3) / 4) - padding);
}

async function loadBitmap(file: File): Promise<{ width: number; height: number; draw: CanvasImageSource }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { width: bitmap.width, height: bitmap.height, draw: bitmap };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Không đọc được ảnh"));
      el.src = url;
    });
    return { width: img.naturalWidth, height: img.naturalHeight, draw: img };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Trả về data URL JPEG đã nén; ném lỗi nếu tệp không phải ảnh hợp lệ. */
export async function compressShot(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Chỉ hỗ trợ tệp ảnh");
  const { width, height, draw } = await loadBitmap(file);
  const size = fitWithin(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Trình duyệt không hỗ trợ nén ảnh");
  ctx.drawImage(draw, 0, 0, size.width, size.height);

  let quality = 0.72;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (base64Bytes(out) > MAX_SHOT_BYTES && quality > 0.35) {
    quality -= 0.12;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  return out;
}
