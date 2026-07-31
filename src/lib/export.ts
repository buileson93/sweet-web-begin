import { rowsToCsv, rowsToSheetData, UTF8_BOM, type ExportRow } from "@/lib/sheet";
import { downloadXlsx } from "@/lib/xlsxIo";

export type { ExportRow };

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(rows: ExportRow[], filename: string) {
  // BOM để Excel đọc đúng tiếng Việt
  download(new Blob([UTF8_BOM + rowsToCsv(rows)], { type: "text/csv;charset=utf-8;" }), filename);
}

export async function downloadExcel(rows: ExportRow[], filename: string, sheetName = "Ket qua") {
  await downloadXlsx([{ name: sheetName, data: rowsToSheetData(rows) }], filename);
}
