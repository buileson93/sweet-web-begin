/**
 * Đọc/ghi tệp .xlsx bằng exceljs (thay cho thư viện xlsx có lỗ hổng bảo mật).
 * Chỉ chạy phía trình duyệt, luôn nạp động để không làm nặng bundle chính.
 */
import { escapeFormula, sheetDataToRows, type SheetData } from "@/lib/sheet";

export type SheetSpec = { name: string; data: SheetData };

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Tên trang tính hợp lệ trong Excel: tối đa 31 ký tự, không chứa : \ / ? * [ ] */
function safeSheetName(name: string, fallback: string) {
  const cleaned = name.replace(/[:\\/?*[\]]/g, " ").trim();
  return (cleaned || fallback).slice(0, 31);
}

/** Ghi nhiều trang tính ra một tệp .xlsx và tải về. */
export async function downloadXlsx(sheets: SheetSpec[], filename: string) {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  sheets.forEach((spec, index) => {
    const sheet = workbook.addWorksheet(safeSheetName(spec.name, `Sheet${index + 1}`));
    spec.data.forEach((cells) => sheet.addRow(cells.map(escapeFormula)));
    const header = sheet.getRow(1);
    if (spec.data.length > 0) header.font = { bold: true };
    // Độ rộng cột vừa nội dung để tiếng Việt không bị cắt.
    sheet.columns.forEach((column, col) => {
      const longest = spec.data.reduce(
        (max, row) => Math.max(max, String(row[col] ?? "").length),
        10,
      );
      column.width = Math.min(60, longest + 2);
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename,
  );
}

/** Đọc trang tính đầu tiên của tệp .xlsx thành mảng hai chiều. */
export async function readXlsxSheetData(file: File | ArrayBuffer): Promise<SheetData> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  const buffer = file instanceof ArrayBuffer ? file : await file.arrayBuffer();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const data: SheetData = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values as unknown[];
    // exceljs đánh chỉ số ô từ 1, phần tử 0 luôn rỗng.
    const cells = values.slice(1).map((v) => cellToPrimitive(v));
    if (cells.some((c) => String(c ?? "").trim() !== "")) data.push(cells);
  });
  return data;
}

/** Đọc trang tính đầu tiên thành danh sách bản ghi theo tiêu đề cột. */
export async function readXlsxRows(file: File | ArrayBuffer): Promise<Record<string, string>[]> {
  return sheetDataToRows(await readXlsxSheetData(file));
}

function cellToPrimitive(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (typeof v.text === "string") return v.text;
    if (typeof v.result === "string" || typeof v.result === "number") return v.result;
  }
  return String(value);
}
