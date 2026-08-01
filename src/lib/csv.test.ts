import { describe, expect, it } from "vitest";

import { normalizeKey, parseCsv, validateRows, type CsvRow } from "@/lib/csv";

describe("parseCsv", () => {
  it("đọc CSV dấu phẩy, hạ chữ thường tiêu đề và cắt khoảng trắng", () => {
    const { headers, rows } = parseCsv("Cau_Hoi, Dap_An\n Sân bay ,A");
    expect(headers).toEqual(["cau_hoi", "dap_an"]);
    expect(rows).toEqual([{ cau_hoi: "Sân bay", dap_an: "A" }]);
  });

  it("tự nhận dấu chấm phẩy và tab", () => {
    expect(parseCsv("a;b\n1;2").rows).toEqual([{ a: "1", b: "2" }]);
    expect(parseCsv("a\tb\n1\t2").rows).toEqual([{ a: "1", b: "2" }]);
  });

  it("giữ nguyên dấu phẩy bên trong ô có ngoặc kép", () => {
    const { rows } = parseCsv('cau_hoi,nhan\n"Mực bay, độ cao","khong luu"');
    expect(rows[0]["cau_hoi"]).toBe("Mực bay, độ cao");
  });

  it("hai dấu ngoặc kép liền nhau là một dấu ngoặc kép", () => {
    const { rows } = parseCsv('a\n"Gọi ""Mayday"" ba lần"');
    expect(rows[0]["a"]).toBe('Gọi "Mayday" ba lần');
  });

  it("bỏ BOM đầu tệp và chấp nhận xuống dòng kiểu Windows", () => {
    const { headers, rows } = parseCsv("\uFEFFa,b\r\n1,2\r\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toHaveLength(1);
  });

  it("bỏ qua dòng trắng và điền chuỗi rỗng cho ô thiếu", () => {
    const { rows } = parseCsv("a,b,c\n1\n\n2,3,4");
    expect(rows).toEqual([
      { a: "1", b: "", c: "" },
      { a: "2", b: "3", c: "4" },
    ]);
  });

  it("tệp rỗng trả về danh sách rỗng", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("\n \n")).toEqual({ headers: [], rows: [] });
  });
});

describe("normalizeKey", () => {
  it("bỏ dấu, đổi chữ đ và không phân biệt hoa thường", () => {
    expect(normalizeKey("Nguyễn Văn Đức")).toBe("nguyen van duc");
    expect(normalizeKey("NGUYEN  VAN   DUC")).toBe("nguyen van duc");
  });

  it("gộp khoảng trắng thừa", () => {
    expect(normalizeKey(" Tổ 1, Đài KSKL ")).toBe("to 1, dai kskl");
  });
});

describe("validateRows", () => {
  const mapRow = (row: CsvRow) =>
    row["ten"]
      ? ({ ok: true, value: { ten: row["ten"] } } as const)
      : ({ ok: false, message: "Thiếu tên" } as const);

  it("đánh số dòng theo tệp gốc (tính cả hàng tiêu đề)", () => {
    const res = validateRows({
      rows: [{ ten: "" }],
      mapRow,
      keyOf: (v) => v.ten,
      existingKeys: new Set<string>(),
    });
    expect(res.issues).toEqual([{ line: 2, message: "Thiếu tên" }]);
    expect(res.valid).toHaveLength(0);
  });

  it("phát hiện trùng trong tệp bất kể dấu và hoa thường", () => {
    const res = validateRows({
      rows: [{ ten: "Lê Sơn" }, { ten: "le son" }],
      mapRow,
      keyOf: (v) => v.ten,
      existingKeys: new Set<string>(),
    });
    expect(res.valid).toHaveLength(1);
    expect(res.duplicatesInFile).toBe(1);
  });

  it("phát hiện trùng với dữ liệu đã có trong hệ thống", () => {
    const res = validateRows({
      rows: [{ ten: "Trần Đức" }],
      mapRow,
      keyOf: (v) => v.ten,
      existingKeys: new Set(["tran duc"]),
    });
    expect(res.valid).toHaveLength(0);
    expect(res.duplicatesInDb).toBe(1);
  });
});
