import { describe, expect, it } from "vitest";

import { COVER_PRESETS, coverSeedIndex, resolveQuizCover } from "@/lib/quizCover";

describe("resolveQuizCover", () => {
  it("trả ảnh dựng sẵn khi chưa cấu hình", () => {
    const src = resolveQuizCover("", "quiz-1");
    expect(COVER_PRESETS.map((p) => p.src)).toContain(src);
  });

  it("ổn định theo mã cuộc thi", () => {
    expect(resolveQuizCover(null, "abc")).toBe(resolveQuizCover("", "abc"));
  });

  it("nhận đúng ảnh dựng sẵn theo id", () => {
    expect(resolveQuizCover("preset:plane", "x")).toBe(COVER_PRESETS[1].src);
  });

  it("giữ nguyên URL tuyệt đối", () => {
    expect(resolveQuizCover("https://a.vn/b.png")).toBe("https://a.vn/b.png");
  });

  it("đổi đường dẫn kho lưu trữ thành API đọc ảnh", () => {
    expect(resolveQuizCover("covers/q 1.webp")).toBe("/api/public/anh-bia/covers/q%201.webp");
  });

  it("băm nằm trong khoảng hợp lệ", () => {
    expect(coverSeedIndex("bất kỳ", 3)).toBeLessThan(3);
    expect(coverSeedIndex("", 0)).toBe(0);
  });
});
