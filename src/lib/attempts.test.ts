import { describe, expect, it } from "vitest";
import {
  MAX_ATTEMPTS_CODE,
  isMaxAttemptsError,
  mapStartExamError,
  maxAttemptsMessage,
} from "./attempts";

describe("isMaxAttemptsError", () => {
  it("nhận diện lỗi Postgres RAISE EXCEPTION", () => {
    expect(
      isMaxAttemptsError({ message: `MAX_ATTEMPTS_REACHED`, code: "P0001" }),
    ).toBe(true);
  });

  it("nhận diện khi mã lỗi nằm trong details hoặc hint", () => {
    expect(isMaxAttemptsError({ message: "boom", details: MAX_ATTEMPTS_CODE })).toBe(true);
    expect(isMaxAttemptsError({ message: "boom", hint: MAX_ATTEMPTS_CODE })).toBe(true);
  });

  it("nhận diện chuỗi lỗi thuần", () => {
    expect(isMaxAttemptsError("error: MAX_ATTEMPTS_REACHED")).toBe(true);
  });

  it("bỏ qua lỗi khác và giá trị rỗng", () => {
    expect(isMaxAttemptsError({ message: "deadlock detected" })).toBe(false);
    expect(isMaxAttemptsError(null)).toBe(false);
    expect(isMaxAttemptsError(undefined)).toBe(false);
  });
});

describe("mapStartExamError", () => {
  it("giữ nguyên thông báo tiếng Việt khi hết lượt thi", () => {
    expect(mapStartExamError({ message: MAX_ATTEMPTS_CODE }, 1).message).toBe(
      "Cuộc thi này chỉ cho phép tối đa 1 lượt thi.",
    );
    expect(maxAttemptsMessage(3)).toBe("Cuộc thi này chỉ cho phép tối đa 3 lượt thi.");
  });

  it("giữ nguyên nội dung lỗi khác", () => {
    expect(mapStartExamError({ message: "mất kết nối" }, 2).message).toBe("mất kết nối");
  });

  it("có thông báo mặc định khi lỗi không rõ hình dạng", () => {
    expect(mapStartExamError(123, 2).message).toBe(
      "Không tạo được phiên thi. Vui lòng thử lại.",
    );
  });
});

/**
 * Kiểm thử song song (cần DB thật, không chạy trong CI):
 * 1. Đặt max_attempts = 1 cho một cuộc thi.
 * 2. Bắn 5 request startExam song song cho cùng một nhân viên.
 * 3. Kỳ vọng: đúng 1 request tạo được phiên, 4 request nhận
 *    "Cuộc thi này chỉ cho phép tối đa 1 lượt thi." nhờ pg_advisory_xact_lock
 *    trong start_exam_session_tx.
 */
describe.skip("tích hợp: 5 request song song với max_attempts = 1", () => {
  it("chỉ 1 request thành công", () => {
    // Chạy thủ công theo hướng dẫn ở trên với DB thật.
  });
});
