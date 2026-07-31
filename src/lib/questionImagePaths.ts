/**
 * Các hàm thuần xử lý đường dẫn ảnh câu hỏi trong kho lưu trữ.
 *
 * Quy ước:
 * - Ảnh vừa tải lên nhưng CHƯA lưu câu hỏi nằm ở `tmp/{quizId}/{uuid}.ext`.
 * - Khi lưu câu hỏi thành công, ảnh được chuyển sang `{quizId}/{questionId}/{uuid}.ext`.
 */

export const TMP_PREFIX = "tmp/";

/** Thời gian tối đa một tệp được phép nằm trong thư mục tạm (24 giờ). */
export const TMP_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Đường dẫn tạm cho ảnh vừa tải lên. */
export function tempImagePath(quizId: string, ext: string, uuid: string) {
  return `${TMP_PREFIX}${quizId}/${uuid}.${ext}`;
}

/** Ảnh có đang nằm trong thư mục tạm hay không. */
export function isTempImagePath(path: string | null | undefined): boolean {
  return typeof path === "string" && path.startsWith(TMP_PREFIX);
}

/** Tên tệp cuối cùng của một đường dẫn. */
export function fileNameOf(path: string) {
  return path.split("/").filter(Boolean).pop() ?? path;
}

/** Đường dẫn chính thức sau khi câu hỏi đã được lưu. */
export function committedImagePath(tmpPath: string, quizId: string, questionId: string) {
  return `${quizId}/${questionId}/${fileNameOf(tmpPath)}`;
}

export type StoredFile = {
  path: string;
  size: number;
  createdAt: string | null;
};

export type CleanupPlan = {
  toDelete: string[];
  bytes: number;
  tmpCount: number;
  orphanCount: number;
};

/**
 * Lên danh sách tệp cần thu hồi:
 * - mọi tệp trong `tmp/` cũ hơn `maxAgeMs`;
 * - mọi tệp ngoài `tmp/` không được bất kỳ câu hỏi nào tham chiếu.
 */
export function planOrphanCleanup(
  files: StoredFile[],
  referenced: Set<string>,
  now: number,
  maxAgeMs: number = TMP_MAX_AGE_MS,
): CleanupPlan {
  const plan: CleanupPlan = { toDelete: [], bytes: 0, tmpCount: 0, orphanCount: 0 };
  for (const f of files) {
    let drop = false;
    if (isTempImagePath(f.path)) {
      const created = f.createdAt ? Date.parse(f.createdAt) : NaN;
      // Không xác định được thời điểm tạo thì coi như còn mới, giữ lại cho an toàn.
      if (Number.isFinite(created) && now - created > maxAgeMs) {
        drop = true;
        plan.tmpCount += 1;
      }
    } else if (!referenced.has(f.path)) {
      drop = true;
      plan.orphanCount += 1;
    }
    if (drop) {
      plan.toDelete.push(f.path);
      plan.bytes += Math.max(0, f.size || 0);
    }
  }
  return plan;
}

/** Chia danh sách thành từng lô nhỏ để thao tác an toàn với dữ liệu lớn. */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
