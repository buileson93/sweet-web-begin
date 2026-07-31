/**
 * Lớp chuyển đổi thuần tuý giữa danh sách bản ghi và dữ liệu bảng (sheet data).
 * Không phụ thuộc DOM hay thư viện ngoài nên test được offline.
 */

export type CellValue = string | number | null | undefined;
export type ExportRow = Record<string, string | number>;
export type SheetData = (string | number)[][];

/** Định dạng ngày dd/MM/yyyy — giữ nguyên quy ước hiển thị cũ. */
export function formatDateCell(value: Date | string | number): string {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/**
 * Chuyển danh sách bản ghi thành dữ liệu bảng: dòng đầu là tiêu đề,
 * thứ tự cột lấy theo thứ tự khoá của bản ghi đầu tiên.
 */
export function rowsToSheetData(rows: ExportRow[]): SheetData {
  if (rows.length === 0) return [];
  const headers = Object.keys(rows[0]);
  return [headers, ...rows.map((r) => headers.map((h) => normalizeCell(r[h])))];
}

/** Chuyển dữ liệu bảng ngược lại thành bản ghi (khoá viết thường, đã cắt khoảng trắng). */
export function sheetDataToRows(data: SheetData): Record<string, string>[] {
  if (data.length === 0) return [];
  const headers = data[0].map((h) => String(h ?? "").trim().toLowerCase());
  return data
    .slice(1)
    .filter((cells) => cells.some((c) => String(c ?? "").trim() !== ""))
    .map((cells) => {
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h) row[h] = String(cells[i] ?? "").trim();
      });
      return row;
    });
}

/** Ô rỗng thành chuỗi rỗng, số 0 giữ nguyên là số. */
function normalizeCell(value: CellValue): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  return value;
}

/**
 * Chống CSV injection: ô dạng chuỗi bắt đầu bằng "=" được thêm dấu nháy đơn
 * để Excel/LibreOffice hiểu là văn bản, không phải công thức.
 */
export function escapeFormula(value: string | number): string | number {
  if (typeof value === "string" && value.startsWith("=")) return `'${value}`;
  return value;
}

/** Bọc ô cho CSV: luôn đặt trong dấu ngoặc kép và nhân đôi dấu ngoặc kép bên trong. */
export function escapeCsvCell(value: CellValue): string {
  const safe = escapeFormula(normalizeCell(value));
  return `"${String(safe).replace(/"/g, '""')}"`;
}

/** Sinh nội dung CSV (CRLF) từ dữ liệu bảng. */
export function sheetDataToCsv(data: SheetData): string {
  return data.map((cells) => cells.map(escapeCsvCell).join(",")).join("\r\n");
}

/** Sinh nội dung CSV từ danh sách bản ghi. */
export function rowsToCsv(rows: ExportRow[]): string {
  return sheetDataToCsv(rowsToSheetData(rows));
}

/** BOM UTF-8 để Excel tiếng Việt hiển thị đúng dấu. */
export const UTF8_BOM = "\uFEFF";
