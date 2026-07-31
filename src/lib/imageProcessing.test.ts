import { describe, expect, it } from "vitest";

import {
  extractImageFromClipboard,
  isHeicFile,
  planResize,
  validateImageInput,
  type ClipboardItemLike,
} from "./imageProcessing";

describe("planResize", () => {
  it("giữ nguyên ảnh nhỏ hơn cạnh tối đa", () => {
    expect(planResize(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("thu nhỏ ảnh ngang 4000x3000 về 1280x960", () => {
    expect(planResize(4000, 3000)).toEqual({ width: 1280, height: 960 });
  });

  it("thu nhỏ ảnh dọc 3000x4000 về 960x1280", () => {
    expect(planResize(3000, 4000)).toEqual({ width: 960, height: 1280 });
  });

  it("không làm tròn về 0 với ảnh siêu dẹt", () => {
    const r = planResize(10000, 1);
    expect(r.width).toBe(1280);
    expect(r.height).toBe(1);
  });
});

describe("validateImageInput", () => {
  it("chấp nhận ảnh hợp lệ", () => {
    expect(validateImageInput(1024 * 1024, 4000, 3000)).toEqual({ ok: true });
  });

  it("từ chối tệp lớn hơn 25MB", () => {
    const r = validateImageInput(26 * 1024 * 1024);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("25 MB");
  });

  it("từ chối ảnh trên 50 triệu điểm ảnh", () => {
    const r = validateImageInput(1000, 10000, 6000);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("điểm ảnh");
  });
});

function item(type: string, file: File | null): ClipboardItemLike {
  return { type, getAsFile: () => file };
}

describe("extractImageFromClipboard", () => {
  const img = new File(["x"], "a.png", { type: "image/png" });

  it("trả null khi không có ảnh", () => {
    expect(extractImageFromClipboard([item("text/plain", null)])).toBeNull();
  });

  it("trả đúng tệp khi có một ảnh", () => {
    expect(extractImageFromClipboard([item("image/png", img)])).toBe(img);
  });

  it("bỏ qua text và lấy ảnh", () => {
    expect(extractImageFromClipboard([item("text/plain", null), item("image/png", img)])).toBe(img);
  });

  it("trả null với danh sách rỗng hoặc undefined", () => {
    expect(extractImageFromClipboard([])).toBeNull();
    expect(extractImageFromClipboard(undefined)).toBeNull();
  });
});

describe("isHeicFile", () => {
  it("nhận diện theo MIME và theo đuôi tệp", () => {
    expect(isHeicFile("a.jpg", "image/heic")).toBe(true);
    expect(isHeicFile("IMG_0001.HEIF", "")).toBe(true);
    expect(isHeicFile("a.png", "image/png")).toBe(false);
  });
});
