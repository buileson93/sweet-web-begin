import { describe, expect, it } from "vitest";

import { buildContactList, buildReminderMessage, formatDeadline } from "@/lib/reminder";

describe("buildContactList", () => {
  it("mỗi người một dòng, đủ tên - đơn vị - điện thoại", () => {
    expect(
      buildContactList([
        { full_name: "Lê Sơn", unit_name: "Đài KSKL", phone: "0905123456" },
        { full_name: "Trần Đức", unit_name: "Kỹ thuật", phone: "0912000111" },
      ]),
    ).toBe("Lê Sơn - Đài KSKL - 0905123456\nTrần Đức - Kỹ thuật - 0912000111");
  });

  it("bỏ qua trường trống thay vì để dấu gạch thừa", () => {
    expect(buildContactList([{ full_name: "Lê Sơn", unit_name: "  ", phone: null }])).toBe("Lê Sơn");
  });

  it("danh sách rỗng trả về chuỗi rỗng", () => {
    expect(buildContactList([])).toBe("");
  });
});

describe("formatDeadline", () => {
  it("thời gian không hợp lệ hoặc trống thì báo chưa ấn định", () => {
    expect(formatDeadline(null)).toBe("chưa ấn định");
    expect(formatDeadline("không phải ngày")).toBe("chưa ấn định");
  });

  it("thời gian hợp lệ được định dạng theo tiếng Việt", () => {
    expect(formatDeadline("2026-08-01T03:00:00.000Z")).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });
});

describe("buildReminderMessage", () => {
  it("gồm tên, đơn vị, tên cuộc thi và hạn chót", () => {
    const msg = buildReminderMessage(
      { full_name: "Lê Sơn", unit_name: "Đài KSKL" },
      "Trắc nghiệm Không lưu",
      "17:00 01/08/2026",
    );
    expect(msg).toContain("Lê Sơn");
    expect(msg).toContain("(Đài KSKL)");
    expect(msg).toContain("Trắc nghiệm Không lưu");
    expect(msg).toContain("17:00 01/08/2026");
  });

  it("không có đơn vị thì bỏ phần ngoặc đơn", () => {
    const msg = buildReminderMessage({ full_name: "Lê Sơn" }, "Kỳ thi", "hôm nay");
    expect(msg).not.toContain("(");
  });
});
