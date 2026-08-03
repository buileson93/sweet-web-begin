/**
 * Kiểm soát "cửa nhận đáp án" — biện pháp KỸ THUẬT thay cho luật tốc độ.
 *
 * Vì sao: đo tốc độ làm bài (giây/câu) luôn có nguy cơ phạt oan người thi nhanh thật.
 * Thay vào đó, máy chủ chỉ chấm những đáp án ĐÃ ĐƯỢC LƯU qua tiến trình làm bài bình thường,
 * và mỗi request chỉ được ghi thêm một số lượng câu MỚI có hạn.
 *
 * Hệ quả: không thể gửi trọn bộ đáp án trong đúng một request rồi nộp bài;
 * còn người thi (dù nhanh) vẫn autosave liên tục nên không bao giờ chạm trần.
 * Phần vượt trần chỉ bị BỎ QUA, không bị phạt điểm liêm chính, không huỷ bài.
 */

/** Số câu MỚI tối đa được ghi thêm trong một lần autosave. */
export const MAX_NEW_ANSWERS_PER_SAVE = 5;
/** Số câu MỚI tối đa được nhận kèm trong chính request nộp bài (phần đuôi chưa kịp autosave). */
export const MAX_NEW_ANSWERS_ON_SUBMIT = 5;

export type AnswerRecord = Record<string, unknown>;

/**
 * Lọc gói đáp án gửi lên: luôn cho phép SỬA câu đã lưu, nhưng giới hạn số câu MỚI.
 * Trả về phần được chấp nhận (giữ nguyên thứ tự chỉ số tăng dần cho ổn định).
 */
export function limitNewAnswers<T extends AnswerRecord>(
  saved: AnswerRecord,
  incoming: T,
  cap: number,
): T {
  const limit = Number.isFinite(cap) && cap > 0 ? Math.trunc(cap) : 0;
  const out: AnswerRecord = {};
  const fresh: string[] = [];

  for (const key of Object.keys(incoming)) {
    if (Object.prototype.hasOwnProperty.call(saved, key)) out[key] = incoming[key];
    else fresh.push(key);
  }

  fresh
    .sort((a, b) => Number(a) - Number(b))
    .slice(0, limit)
    .forEach((key) => {
      out[key] = incoming[key];
    });

  return out as T;
}

/** Số câu mới bị bỏ qua vì vượt trần (chỉ để ghi nhật ký cho quản trị). */
export function droppedNewAnswers(saved: AnswerRecord, incoming: AnswerRecord, cap: number): number {
  const fresh = Object.keys(incoming).filter(
    (key) => !Object.prototype.hasOwnProperty.call(saved, key),
  ).length;
  const limit = Number.isFinite(cap) && cap > 0 ? Math.trunc(cap) : 0;
  return Math.max(0, fresh - limit);
}
