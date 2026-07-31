import { describe, expect, it } from "vitest";
import {
  escapeCsvCell,
  escapeFormula,
  formatDateCell,
  rowsToCsv,
  rowsToSheetData,
  sheetDataToRows,
  UTF8_BOM,
  type ExportRow,
} from "./sheet";

const rows: ExportRow[] = [
  { "Họ tên": "Nguyễn Thị Ánh Tuyết", "Đơn vị": "Đài KSKL Nội Bài", Điểm: 0, "Ngày thi": "31/07/2026" },
  { "Họ tên": "Trần Đức Hải", "Đơn vị": "", Điểm: 18.5, "Ngày thi": "01/08/2026" },
];

describe("rowsToSheetData", () => {
  it("giữ nguyên tên cột và thứ tự cột theo bản ghi đầu tiên", () => {
    const data = rowsToSheetData(rows);
    expect(data[0]).toEqual(["Họ tên", "Đơn vị", "Điểm", "Ngày thi"]);
  });

  it("giữ tiếng Việt có dấu, ô rỗng và số 0", () => {
    const data = rowsToSheetData(rows);
    expect(data[1]).toEqual(["Nguyễn Thị Ánh Tuyết", "Đài KSKL Nội Bài", 0, "31/07/2026"]);
    expect(data[2][1]).toBe("");
    expect(data[1][2]).toBe(0);
    expect(typeof data[1][2]).toBe("number");
  });

  it("trả về mảng rỗng khi không có dữ liệu", () => {
    expect(rowsToSheetData([])).toEqual([]);
  });

  it("điền chuỗi rỗng cho khoá thiếu ở bản ghi sau", () => {
    const data = rowsToSheetData([{ a: "1", b: "2" }, { a: "3" } as ExportRow]);
    expect(data[2]).toEqual(["3", ""]);
  });
});

describe("sheetDataToRows", () => {
  it("chuyển ngược về bản ghi với khoá viết thường", () => {
    const out = sheetDataToRows([
      ["Full_Name", " Đơn Vị ", "Điểm"],
      ["Lê Văn Bình", "Đài Cát Bi", 0],
    ]);
    expect(out).toEqual([{ full_name: "Lê Văn Bình", "đơn vị": "Đài Cát Bi", điểm: "0" }]);
  });

  it("bỏ qua dòng trống hoàn toàn", () => {
    const out = sheetDataToRows([["a"], [""], ["  "], ["x"]]);
    expect(out).toEqual([{ a: "x" }]);
  });

  it("khứ hồi rows -> sheet -> rows giữ nguyên giá trị dạng chuỗi", () => {
    const back = sheetDataToRows(rowsToSheetData(rows));
    expect(back[0]["họ tên"]).toBe("Nguyễn Thị Ánh Tuyết");
    expect(back[0]["điểm"]).toBe("0");
    expect(back[1]["đơn vị"]).toBe("");
  });
});

describe("chống CSV injection", () => {
  it("thêm dấu nháy đơn cho chuỗi bắt đầu bằng =", () => {
    expect(escapeFormula("=1+1")).toBe("'=1+1");
    expect(escapeFormula('=HYPERLINK("http://evil","x")')).toBe(
      "'=HYPERLINK(\"http://evil\",\"x\")",
    );
    expect(escapeCsvCell("=cmd|' /c calc'!A0")).toBe("\"'=cmd|' /c calc'!A0\"");
  });

  it("không đụng đến giá trị bình thường", () => {
    expect(escapeFormula("Nguyễn Văn A")).toBe("Nguyễn Văn A");
    expect(escapeFormula("+84912345678")).toBe("+84912345678");
    expect(escapeFormula(0)).toBe(0);
  });
});

describe("escapeCsvCell", () => {
  it("bọc ngoặc kép và nhân đôi dấu nháy kép bên trong", () => {
    expect(escapeCsvCell('Đài "Nội Bài"')).toBe('"Đài ""Nội Bài"""');
  });

  it("ô rỗng, null và undefined thành chuỗi rỗng có ngoặc", () => {
    expect(escapeCsvCell("")).toBe('""');
    expect(escapeCsvCell(null)).toBe('""');
    expect(escapeCsvCell(undefined)).toBe('""');
  });

  it("số 0 giữ nguyên là 0", () => {
    expect(escapeCsvCell(0)).toBe('"0"');
  });
});

describe("rowsToCsv", () => {
  it("xuất CSV đúng thứ tự cột, dùng CRLF", () => {
    const csv = rowsToCsv(rows);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"Họ tên","Đơn vị","Điểm","Ngày thi"');
    expect(lines[1]).toBe('"Nguyễn Thị Ánh Tuyết","Đài KSKL Nội Bài","0","31/07/2026"');
    expect(lines[2]).toBe('"Trần Đức Hải","","18.5","01/08/2026"');
  });

  it("BOM UTF-8 để Excel tiếng Việt không lỗi font", () => {
    expect(UTF8_BOM).toBe("\uFEFF");
    expect((UTF8_BOM + rowsToCsv(rows)).startsWith("\uFEFF")).toBe(true);
  });
});

describe("formatDateCell", () => {
  it("định dạng ngày dd/MM/yyyy", () => {
    expect(formatDateCell(new Date(2026, 6, 31))).toBe("31/07/2026");
    expect(formatDateCell(new Date(2026, 0, 5))).toBe("05/01/2026");
  });

  it("giữ nguyên chuỗi khi không phải ngày hợp lệ", () => {
    expect(formatDateCell("không rõ")).toBe("không rõ");
  });
});
