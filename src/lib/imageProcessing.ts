/**
 * Các hàm thuần phục vụ xử lý ảnh câu hỏi (không phụ thuộc trình duyệt hay mạng),
 * tách riêng để kiểm thử được bằng vitest.
 */

/** Dung lượng tệp đầu vào tối đa (byte). */
export const MAX_INPUT_BYTES = 25 * 1024 * 1024;
/** Tổng số điểm ảnh tối đa cho phép. */
export const MAX_PIXELS = 50_000_000;
/** Ngưỡng cảnh báo mềm sau khi nén (byte). */
export const SOFT_WARN_BYTES = 400 * 1024;

export const HEIC_MESSAGE =
  "Ảnh định dạng HEIC của iPhone chưa được hỗ trợ. Vui lòng chụp màn hình ảnh đó rồi dán lại, hoặc đổi cài đặt Máy ảnh sang 'Tương thích nhất'.";

/** Tính kích thước sau khi thu nhỏ sao cho cạnh dài không vượt maxEdge. */
export function planResize(w: number, h: number, maxEdge = 1280): { width: number; height: number } {
  const longest = Math.max(w, h);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/** Kiểm tra giới hạn đầu vào; trả về thông báo tiếng Việt nếu không hợp lệ. */
export function validateImageInput(
  sizeBytes: number,
  width?: number,
  height?: number,
): { ok: true } | { ok: false; message: string } {
  if (sizeBytes > MAX_INPUT_BYTES)
    return { ok: false, message: "Tệp ảnh vượt quá 25 MB. Vui lòng chọn ảnh nhỏ hơn." };
  if (width && height && width * height > MAX_PIXELS)
    return {
      ok: false,
      message: "Ảnh có độ phân giải quá lớn (trên 50 triệu điểm ảnh). Vui lòng giảm kích thước.",
    };
  return { ok: true };
}

/** Kiểu tối thiểu của một mục trong clipboard, đủ dùng cho hàm thuần bên dưới. */
export type ClipboardItemLike = {
  type: string;
  getAsFile: () => File | null;
};

/** Lấy tệp ảnh đầu tiên trong danh sách mục clipboard. */
export function extractImageFromClipboard(
  items: ArrayLike<ClipboardItemLike> | null | undefined,
): File | null {
  if (!items) return null;
  for (const item of Array.from(items)) {
    if (item?.type?.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/** Nhận diện ảnh HEIC/HEIF của iPhone theo kiểu MIME hoặc phần mở rộng. */
export function isHeicFile(name: string, type: string): boolean {
  return /image\/hei[cf]/i.test(type) || /\.hei[cf]$/i.test(name);
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
