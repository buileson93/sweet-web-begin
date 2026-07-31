import { describe, expect, it } from "vitest";

import {
  TMP_MAX_AGE_MS,
  chunk,
  committedImagePath,
  isTempImagePath,
  planOrphanCleanup,
  tempImagePath,
} from "./questionImagePaths";

const HOUR = 60 * 60 * 1000;
const NOW = Date.parse("2026-01-02T00:00:00.000Z");
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

describe("đường dẫn ảnh câu hỏi", () => {
  it("tạo đường dẫn tạm theo cuộc thi", () => {
    expect(tempImagePath("quiz-1", "webp", "abc")).toBe("tmp/quiz-1/abc.webp");
  });

  it("nhận biết đường dẫn tạm", () => {
    expect(isTempImagePath("tmp/quiz-1/abc.webp")).toBe(true);
    expect(isTempImagePath("quiz-1/q1/abc.webp")).toBe(false);
    expect(isTempImagePath(null)).toBe(false);
  });

  it("chuyển đường dẫn tạm sang đường dẫn chính thức", () => {
    expect(committedImagePath("tmp/quiz-1/abc.webp", "quiz-1", "q9")).toBe("quiz-1/q9/abc.webp");
  });
});

describe("planOrphanCleanup", () => {
  it("thu hồi tệp tạm cũ hơn 24 giờ, giữ tệp tạm còn mới", () => {
    const plan = planOrphanCleanup(
      [
        { path: "tmp/q/a.webp", size: 100, createdAt: iso(25 * HOUR) },
        { path: "tmp/q/b.webp", size: 200, createdAt: iso(2 * HOUR) },
      ],
      new Set(),
      NOW,
      TMP_MAX_AGE_MS,
    );
    expect(plan.toDelete).toEqual(["tmp/q/a.webp"]);
    expect(plan.bytes).toBe(100);
    expect(plan.tmpCount).toBe(1);
  });

  it("giữ tệp tạm không rõ thời điểm tạo", () => {
    const plan = planOrphanCleanup(
      [{ path: "tmp/q/a.webp", size: 10, createdAt: null }],
      new Set(),
      NOW,
    );
    expect(plan.toDelete).toEqual([]);
  });

  it("xoá tệp chính thức không được câu hỏi nào tham chiếu", () => {
    const plan = planOrphanCleanup(
      [
        { path: "q1/qq/used.webp", size: 50, createdAt: iso(HOUR) },
        { path: "q1/qq/orphan.webp", size: 70, createdAt: iso(HOUR) },
      ],
      new Set(["q1/qq/used.webp"]),
      NOW,
    );
    expect(plan.toDelete).toEqual(["q1/qq/orphan.webp"]);
    expect(plan.orphanCount).toBe(1);
    expect(plan.bytes).toBe(70);
  });

  it("không xoá gì khi mọi tệp đều hợp lệ", () => {
    const plan = planOrphanCleanup(
      [{ path: "q1/qq/used.webp", size: 50, createdAt: iso(HOUR) }],
      new Set(["q1/qq/used.webp"]),
      NOW,
    );
    expect(plan).toEqual({ toDelete: [], bytes: 0, tmpCount: 0, orphanCount: 0 });
  });
});

describe("chunk", () => {
  it("chia theo lô", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 2)).toEqual([]);
  });
});
