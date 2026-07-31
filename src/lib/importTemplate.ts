/**
 * Sinh tệp mẫu .xlsx cho việc nhập câu hỏi: mỗi loại câu một trang tính,
 * kèm trang hướng dẫn và ràng buộc dữ liệu cho cột Độ khó / Loại câu.
 */

const HEADERS = [
  "cau_hoi",
  "phuong_an_a",
  "phuong_an_b",
  "phuong_an_c",
  "phuong_an_d",
  "dap_an",
  "do_kho",
  "diem",
  "nhan",
  "giai_thich",
];

const HEADER_LABELS: Record<string, string> = {
  cau_hoi: "Nội dung câu hỏi (bắt buộc)",
  phuong_an_a: "Phương án A",
  phuong_an_b: "Phương án B",
  phuong_an_c: "Phương án C",
  phuong_an_d: "Phương án D",
  dap_an: "Đáp án đúng (A/B/C/D)",
  do_kho: "Độ khó (Dễ / Trung bình / Khó)",
  diem: "Điểm (số nguyên ≥ 1)",
  nhan: "Nhãn, cách nhau bởi dấu phẩy",
  giai_thich: "Giải thích sau khi chấm",
};

type SheetSpec = { name: string; rows: (string | number)[][] };

const SHEETS: SheetSpec[] = [
  {
    name: "Mot dap an",
    rows: [
      [
        "Sân bay Đà Nẵng có mã ICAO là gì?",
        "VVDN",
        "VVNB",
        "VVTS",
        "VVCR",
        "A",
        "Dễ",
        1,
        "ICAO, sân bay",
        "VVDN là mã ICAO của Cảng hàng không quốc tế Đà Nẵng.",
      ],
    ],
  },
  {
    name: "Dung sai",
    rows: [
      [
        "Kiểm soát viên không lưu được phép rời vị trí khi chưa bàn giao?",
        "Đúng",
        "Sai",
        "",
        "",
        "B",
        "Trung bình",
        1,
        "quy trình",
        "Phải bàn giao đầy đủ trước khi rời vị trí.",
      ],
    ],
  },
  {
    name: "Nhieu dap an",
    rows: [
      [
        "Những yếu tố nào ảnh hưởng tới tầm nhìn đường cất hạ cánh?",
        "Sương mù",
        "Mưa lớn",
        "Tên đường lăn",
        "Khói bụi",
        "A;B;D",
        "Khó",
        2,
        "khí tượng",
        "Chọn tất cả yếu tố khí tượng.",
      ],
    ],
  },
];

const GUIDE_ROWS: string[][] = [
  ["HƯỚNG DẪN NHẬP CÂU HỎI"],
  [""],
  ["1. Mỗi loại câu hỏi nằm ở một trang tính riêng, giữ nguyên hàng tiêu đề."],
  ["2. Cột dap_an ghi chữ cái phương án đúng: A, B, C hoặc D."],
  ["3. Câu nhiều đáp án: ghi nhiều chữ cái, cách nhau bằng dấu chấm phẩy (A;B;D)."],
  ["4. Cột do_kho chỉ nhận: Dễ, Trung bình, Khó."],
  ["5. Cột diem là số nguyên từ 1 trở lên; để trống sẽ tính 1 điểm."],
  ["6. Hệ thống tự bỏ qua câu trùng nội dung với ngân hàng hiện có."],
  ["7. Ảnh minh hoạ không nhập được qua Excel — hãy dùng tệp Word (.docx)."],
];

/** Tạo và tải về tệp mẫu .xlsx. */
export async function downloadQuestionTemplate(filename = "mau-nhap-cau-hoi.xlsx") {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const guide = workbook.addWorksheet("Huong dan");
  GUIDE_ROWS.forEach((r) => guide.addRow(r));
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.getColumn(1).width = 100;

  for (const spec of SHEETS) {
    const sheet = workbook.addWorksheet(spec.name);
    sheet.addRow(HEADERS);
    sheet.addRow(HEADERS.map((h) => HEADER_LABELS[h]));
    spec.rows.forEach((r) => sheet.addRow(r));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: "FF888888" } };
    sheet.columns.forEach((col, i) => {
      col.width = i === 0 || i === 9 ? 52 : 20;
    });

    // Ràng buộc dữ liệu cho 500 dòng đầu.
    for (let row = 3; row <= 500; row++) {
      sheet.getCell(`F${row}`).dataValidation = {
        type: "list",
        allowBlank: false,
        formulae: ['"A,B,C,D"'],
        showErrorMessage: true,
        errorTitle: "Đáp án không hợp lệ",
        error: "Chỉ nhận A, B, C hoặc D.",
      };
      sheet.getCell(`G${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Dễ,Trung bình,Khó"'],
        showErrorMessage: true,
        errorTitle: "Độ khó không hợp lệ",
        error: "Chỉ nhận Dễ, Trung bình hoặc Khó.",
      };
      sheet.getCell(`H${row}`).dataValidation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        formulae: [1],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Điểm không hợp lệ",
        error: "Điểm phải là số nguyên từ 1 trở lên.",
      };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Đọc TẤT CẢ trang tính của tệp .xlsx thành danh sách bản ghi theo tiêu đề. */
export async function readAllSheetRows(file: File): Promise<Record<string, string>[]> {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());

  const out: Record<string, string>[] = [];
  workbook.worksheets.forEach((sheet) => {
    const grid: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (row) => {
      const values = row.values as unknown[];
      grid.push(values.slice(1).map((v) => cellText(v)));
    });
    if (grid.length < 2) return;
    const headers = grid[0].map((h) => h.trim().toLowerCase());
    if (!headers.includes("cau_hoi")) return; // bỏ trang hướng dẫn
    grid.slice(1).forEach((cells) => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        record[h] = (cells[i] ?? "").trim();
      });
      // Bỏ hàng mô tả tiêu đề trong tệp mẫu.
      if (record["cau_hoi"] && record["cau_hoi"] !== HEADER_LABELS["cau_hoi"]) out.push(record);
    });
  });
  return out;
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const v = value as { text?: unknown; result?: unknown; richText?: { text: string }[] };
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (typeof v.text === "string") return v.text;
    if (v.result !== undefined) return String(v.result);
  }
  return String(value);
}
