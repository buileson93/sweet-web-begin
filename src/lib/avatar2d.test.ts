import { describe, expect, it } from "vitest";

import { avatarDataUri, decodeAvatar, encodeAvatar, isAvatar2d, optionGroups, optionValueLabel, suggestSeeds } from "@/lib/avatar2d";

describe("avatar2d", () => {
  it("mã hoá rồi giải mã giữ nguyên mô tả", () => {
    const spec = { style: "personas" as const, seed: "Nguyễn Văn A", background: "dcfce7" };
    const decoded = decodeAvatar(encodeAvatar(spec));
    expect(decoded).toEqual(spec);
  });

  it("chuỗi lạ rơi về nhân vật mặc định theo tên", () => {
    expect(decodeAvatar("https://cu.example/a.glb", "Trần B").seed).toBe("Trần B");
    expect(decodeAvatar(undefined, "Trần B").style).toBe("notionists");
  });

  it("nhận diện đúng chuỗi avatar 2D", () => {
    expect(isAvatar2d("2d:personas:dbeafe:abc")).toBe(true);
    expect(isAvatar2d("https://x/y.glb")).toBe(false);
    expect(isAvatar2d(undefined)).toBe(false);
  });

  it("dựng được ảnh SVG dạng data URI", () => {
    expect(avatarDataUri(decodeAvatar(undefined, "VATM"))).toMatch(/^data:image\/svg\+xml/);
  });

  it("gợi ý hạt giống bắt đầu bằng chính tên", () => {
    const seeds = suggestSeeds("Lê C", 5);
    expect(seeds).toHaveLength(5);
    expect(seeds[0]).toBe("Lê C");
    expect(new Set(seeds).size).toBe(5);
  });
});

describe("avatar2d tuỳ chỉnh", () => {
  it("giữ nguyên tuỳ chỉnh khi mã hoá/giải mã", () => {
    const spec = {
      style: "notionists" as const,
      seed: "Lê D",
      background: "dbeafe",
      options: { beard: "variant03", glasses: "off" },
    };
    expect(decodeAvatar(encodeAvatar(spec))).toEqual(spec);
  });

  it("bỏ qua tuỳ chọn tự động", () => {
    expect(encodeAvatar({ style: "notionists", seed: "A", background: "dbeafe", options: { beard: "auto" } })).not.toContain("#");
  });

  it("liệt kê nhóm tuỳ chỉnh có râu và kính", () => {
    const keys = optionGroups("notionists").map((g) => g.key);
    expect(keys).toContain("beard");
    expect(keys).toContain("glasses");
    expect(optionGroups("notionists").find((g) => g.key === "beard")?.optional).toBe(true);
  });

  it("nhãn biến thể dễ đọc", () => {
    expect(optionValueLabel("variant07")).toBe("Kiểu 7");
    expect(optionValueLabel("beardMustache")).toBe("Beard Mustache");
  });

  it("tuỳ chỉnh khác nhau cho ảnh khác nhau", () => {
    const a = avatarDataUri({ style: "notionists", seed: "A", background: "dbeafe", options: { beard: "variant01" } });
    const b = avatarDataUri({ style: "notionists", seed: "A", background: "dbeafe", options: { beard: "off" } });
    expect(a).not.toBe(b);
  });
});
