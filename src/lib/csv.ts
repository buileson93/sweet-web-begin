export type CsvRow = Record<string, string>;

/** Tách nội dung CSV (hỗ trợ dấu phẩy, chấm phẩy, tab và ô có dấu ngoặc kép). */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const delimiter = detectDelimiter(clean);
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n") {
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += ch;
  }
  record.push(field);
  records.push(record);

  const nonEmpty = records.filter((r) => r.some((c) => c.trim() !== ""));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };

  const headers = nonEmpty[0].map((h) => h.trim().toLowerCase());
  const rows = nonEmpty.slice(1).map((cells) => {
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = (cells[idx] ?? "").trim();
    });
    return row;
  });
  return { headers, rows };
}

function detectDelimiter(text: string) {
  const line = text.split("\n")[0] ?? "";
  const counts: Array<[string, number]> = [
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["\t", (line.match(/\t/g) ?? []).length],
  ];
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export type ValidationIssue = { line: number; message: string };
export type ValidationResult<T> = {
  valid: T[];
  issues: ValidationIssue[];
  duplicatesInFile: number;
  duplicatesInDb: number;
};

/** Chuẩn hoá chuỗi để so trùng (bỏ dấu, bỏ khoảng trắng thừa, không phân biệt hoa thường). */
export function normalizeKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Kiểm tra dữ liệu từng dòng + phát hiện trùng trong tệp và trùng với dữ liệu đã có. */
export function validateRows<T>({
  rows,
  mapRow,
  keyOf,
  existingKeys,
}: {
  rows: CsvRow[];
  mapRow: (row: CsvRow, line: number) => { ok: true; value: T } | { ok: false; message: string };
  keyOf: (value: T) => string;
  existingKeys: Set<string>;
}): ValidationResult<T> {
  const valid: T[] = [];
  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();
  let duplicatesInFile = 0;
  let duplicatesInDb = 0;

  rows.forEach((row, idx) => {
    const line = idx + 2; // +1 tiêu đề, +1 vì đếm từ 1
    const mapped = mapRow(row, line);
    if (!mapped.ok) {
      issues.push({ line, message: mapped.message });
      return;
    }
    const key = normalizeKey(keyOf(mapped.value));
    if (seen.has(key)) {
      duplicatesInFile++;
      issues.push({ line, message: "Trùng với dòng khác trong tệp — sẽ bỏ qua." });
      return;
    }
    if (existingKeys.has(key)) {
      duplicatesInDb++;
      issues.push({ line, message: "Đã tồn tại trong hệ thống — sẽ bỏ qua." });
      return;
    }
    seen.add(key);
    valid.push(mapped.value);
  });

  return { valid, issues, duplicatesInFile, duplicatesInDb };
}

export function downloadTemplate(fileName: string, headers: string[], sample: string[][]) {
  const escape = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = [headers, ...sample].map((r) => r.map(escape).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}
