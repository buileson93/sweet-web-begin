/**
 * Sinh tệp mẫu .xlsx cho việc nhập câu hỏi: mỗi loại câu một trang tính,
 * ĐỦ mọi trường mà ngân hàng câu hỏi hỗ trợ, kèm trang hướng dẫn và ràng buộc
 * dữ liệu cho các cột Loại câu / Độ khó / Điểm / Thời gian.
 */

const HEADERS = [
  "cau_hoi",
  "loai_cau",
  "phuong_an_a",
  "phuong_an_b",
  "phuong_an_c",
  "phuong_an_d",
  "phuong_an_e",
  "phuong_an_f",
  "dap_an",
  "dap_an_dien",
  "cap_ghep",
  "do_kho",
  "diem",
  "thoi_gian",
  "nhan",
  "giai_thich",
  "giai_thich_a",
  "giai_thich_b",
  "giai_thich_c",
  "giai_thich_d",
  "mo_ta_anh",
  "thu_tu",
] as const;

const HEADER_LABELS: Record<string, string> = {
  cau_hoi: "Nội dung câu hỏi (bắt buộc)",
  loai_cau: "Loại câu (Một đáp án / Đúng sai / Nhiều đáp án / Điền đáp án / Nối cặp / Sắp xếp)",
  phuong_an_a: "Phương án A",
  phuong_an_b: "Phương án B",
  phuong_an_c: "Phương án C",
  phuong_an_d: "Phương án D",
  phuong_an_e: "Phương án E (không bắt buộc)",
  phuong_an_f: "Phương án F (không bắt buộc)",
  dap_an: "Đáp án đúng: A | A;B;D (nhiều đáp án) | B;A;C;D (thứ tự đúng khi sắp xếp)",
  dap_an_dien: "Câu điền đáp án: các đáp án chấp nhận, cách nhau bởi dấu ;",
  cap_ghep: "Câu nối cặp: mỗi cặp ghi 'Vế trái = Vế phải', cách nhau bởi dấu ;",
  do_kho: "Độ khó (Dễ / Trung bình / Khó)",
  diem: "Điểm (số nguyên ≥ 1)",
  thoi_gian: "Giới hạn riêng cho câu này (giây, 0-600); để trống = dùng giờ chung",
  nhan: "Nhãn/chủ đề, cách nhau bởi dấu phẩy",
  giai_thich: "Giải thích chung sau khi chấm",
  giai_thich_a: "Giải thích riêng cho phương án A",
  giai_thich_b: "Giải thích riêng cho phương án B",
  giai_thich_c: "Giải thích riêng cho phương án C",
  giai_thich_d: "Giải thích riêng cho phương án D",
  mo_ta_anh: "Mô tả ảnh minh hoạ (cho trình đọc màn hình)",
  thu_tu: "Thứ tự hiển thị khi tắt xáo trộn câu hỏi (số nguyên ≥ 1)",
};

type Row = (string | number)[];
type SheetSpec = { name: string; rows: Row[] };

/** Dựng một hàng ví dụ theo tên cột để khỏi đếm nhầm vị trí. */
function row(values: Partial<Record<(typeof HEADERS)[number], string | number>>): Row {
  return HEADERS.map((h) => values[h] ?? "");
}

const SHEETS: SheetSpec[] = [
  {
    name: "Mot dap an",
    rows: [
      row({
        cau_hoi: "Sân bay Đà Nẵng có mã ICAO là gì?",
        loai_cau: "Một đáp án",
        phuong_an_a: "VVDN",
        phuong_an_b: "VVNB",
        phuong_an_c: "VVTS",
        phuong_an_d: "VVCR",
        dap_an: "A",
        do_kho: "Dễ",
        diem: 1,
        thoi_gian: 45,
        nhan: "ICAO, sân bay",
        giai_thich: "VVDN là mã ICAO của Cảng hàng không quốc tế Đà Nẵng.",
        giai_thich_a: "Đúng: VVDN là Đà Nẵng.",
        giai_thich_b: "VVNB là Nội Bài.",
        giai_thich_c: "VVTS là Tân Sơn Nhất.",
        giai_thich_d: "VVCR là Cam Ranh.",
        mo_ta_anh: "",
        thu_tu: 1,
      }),
    ],
  },
  {
    name: "Dung sai",
    rows: [
      row({
        cau_hoi: "Kiểm soát viên không lưu được phép rời vị trí khi chưa bàn giao?",
        loai_cau: "Đúng sai",
        phuong_an_a: "Đúng",
        phuong_an_b: "Sai",
        dap_an: "B",
        do_kho: "Trung bình",
        diem: 1,
        nhan: "quy trình",
        giai_thich: "Phải bàn giao đầy đủ trước khi rời vị trí.",
        thu_tu: 2,
      }),
    ],
  },
  {
    name: "Nhieu dap an",
    rows: [
      row({
        cau_hoi: "Những yếu tố nào ảnh hưởng tới tầm nhìn đường cất hạ cánh?",
        loai_cau: "Nhiều đáp án",
        phuong_an_a: "Sương mù",
        phuong_an_b: "Mưa lớn",
        phuong_an_c: "Tên đường lăn",
        phuong_an_d: "Khói bụi",
        dap_an: "A;B;D",
        do_kho: "Khó",
        diem: 2,
        nhan: "khí tượng",
        giai_thich: "Chọn tất cả yếu tố khí tượng.",
        thu_tu: 3,
      }),
    ],
  },
  {
    name: "Dien dap an",
    rows: [
      row({
        cau_hoi: "Tần số khẩn nguy hàng không quốc tế là bao nhiêu MHz?",
        loai_cau: "Điền đáp án",
        dap_an_dien: "121.5;121,5;121.5 MHz",
        do_kho: "Trung bình",
        diem: 2,
        thoi_gian: 60,
        nhan: "thông tin liên lạc",
        giai_thich: "121.5 MHz là tần số khẩn nguy quốc tế.",
        thu_tu: 4,
      }),
    ],
  },
  {
    name: "Noi cap",
    rows: [
      row({
        cau_hoi: "Nối tên sân bay với mã ICAO tương ứng.",
        loai_cau: "Nối cặp",
        cap_ghep: "Nội Bài = VVNB; Tân Sơn Nhất = VVTS; Đà Nẵng = VVDN",
        do_kho: "Trung bình",
        diem: 2,
        nhan: "ICAO",
        giai_thich: "Ba cảng hàng không quốc tế lớn nhất Việt Nam.",
        thu_tu: 5,
      }),
    ],
  },
  {
    name: "Sap xep",
    rows: [
      row({
        cau_hoi: "Sắp xếp đúng trình tự một chuyến bay.",
        loai_cau: "Sắp xếp",
        phuong_an_a: "Lăn ra đường cất hạ cánh",
        phuong_an_b: "Khởi hành động cơ",
        phuong_an_c: "Cất cánh",
        phuong_an_d: "Bay bằng",
        dap_an: "B;A;C;D",
        do_kho: "Dễ",
        diem: 2,
        nhan: "quy trình",
        giai_thich: "Cột dap_an ghi thứ tự đúng của các mục.",
        thu_tu: 6,
      }),
    ],
  },
];

const GUIDE_ROWS: string[][] = [
  ["HƯỚNG DẪN NHẬP CÂU HỎI"],
  [""],
  ["1. Mỗi loại câu hỏi nằm ở một trang tính riêng; giữ nguyên hàng tiêu đề (hàng 1) và hàng mô tả (hàng 2)."],
  ["2. Cột loai_cau: Một đáp án / Đúng sai / Nhiều đáp án / Điền đáp án / Nối cặp / Sắp xếp."],
  ["3. Cột dap_an — Một đáp án: ghi A, B, C hoặc D."],
  ["   • Nhiều đáp án: ghi nhiều chữ cái cách nhau bằng dấu chấm phẩy, ví dụ A;B;D."],
  ["   • Sắp xếp: ghi đủ thứ tự đúng của tất cả các mục, ví dụ B;A;C;D."],
  ["4. Câu điền đáp án dùng cột dap_an_dien, các cách viết được chấp nhận cách nhau bằng dấu ;."],
  ["5. Câu nối cặp dùng cột cap_ghep, mỗi cặp ghi 'Vế trái = Vế phải' và cách nhau bằng dấu ;."],
  ["6. Cột do_kho chỉ nhận: Dễ, Trung bình, Khó. Cột diem là số nguyên từ 1 trở lên (trống = 1 điểm)."],
  ["7. Cột thoi_gian là giới hạn riêng cho câu đó (0-600 giây); để trống thì dùng giờ chung của cuộc thi."],
  ["8. Các cột giai_thich_a…giai_thich_d là giải thích riêng cho từng phương án, hiện khi trả bài."],
  ["9. Cột mo_ta_anh dành cho ảnh minh hoạ (trình đọc màn hình); cột thu_tu quyết định thứ tự khi tắt xáo trộn."],
  ["10. Hệ thống tự bỏ qua câu trùng nội dung với ngân hàng hiện có, và luôn cho xem trước trước khi ghi."],
  ["11. Ảnh minh hoạ không nhập được qua Excel — hãy dùng tệp Word (.docx) có ảnh nhúng."],
];

const KIND_LIST = '"Một đáp án,Đúng sai,Nhiều đáp án,Điền đáp án,Nối cặp,Sắp xếp"';
const LAST_ROW = 500;

/** Tạo và tải về tệp mẫu .xlsx. */
export async function downloadQuestionTemplate(filename = "mau-nhap-cau-hoi.xlsx") {
  const ExcelJS = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();

  const guide = workbook.addWorksheet("Huong dan");
  GUIDE_ROWS.forEach((r) => guide.addRow(r));
  guide.getRow(1).font = { bold: true, size: 14 };
  guide.getColumn(1).width = 120;

  const wideCols = new Set(["cau_hoi", "giai_thich", "cap_ghep", "dap_an_dien", "loai_cau"]);

  for (const spec of SHEETS) {
    const sheet = workbook.addWorksheet(spec.name);
    sheet.addRow([...HEADERS]);
    sheet.addRow(HEADERS.map((h) => HEADER_LABELS[h] ?? h));
    spec.rows.forEach((r) => sheet.addRow(r));

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(2).font = { italic: true, color: { argb: "FF888888" } };
    sheet.getRow(2).alignment = { wrapText: true, vertical: "top" };
    sheet.views = [{ state: "frozen", ySplit: 2 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HEADERS.length } };
    HEADERS.forEach((h, i) => {
      sheet.getColumn(i + 1).width = wideCols.has(h) ? 46 : 20;
    });

    const col = (name: (typeof HEADERS)[number]) => HEADERS.indexOf(name) + 1;
    const letter = (name: (typeof HEADERS)[number]) => sheet.getColumn(col(name)).letter;

    // Ràng buộc dữ liệu cho các dòng nhập liệu.
    for (let r = 3; r <= LAST_ROW; r++) {
      sheet.getCell(`${letter("loai_cau")}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [KIND_LIST],
        showErrorMessage: true,
        errorTitle: "Loại câu không hợp lệ",
        error: "Chọn đúng một loại câu trong danh sách.",
      };
      sheet.getCell(`${letter("do_kho")}${r}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ['"Dễ,Trung bình,Khó"'],
        showErrorMessage: true,
        errorTitle: "Độ khó không hợp lệ",
        error: "Chỉ nhận Dễ, Trung bình hoặc Khó.",
      };
      sheet.getCell(`${letter("diem")}${r}`).dataValidation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        formulae: [1],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Điểm không hợp lệ",
        error: "Điểm phải là số nguyên từ 1 trở lên.",
      };
      sheet.getCell(`${letter("thoi_gian")}${r}`).dataValidation = {
        type: "whole",
        operator: "between",
        formulae: [0, 600],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Thời gian không hợp lệ",
        error: "Giới hạn thời gian từ 0 đến 600 giây.",
      };
      sheet.getCell(`${letter("thu_tu")}${r}`).dataValidation = {
        type: "whole",
        operator: "greaterThanOrEqual",
        formulae: [1],
        allowBlank: true,
        showErrorMessage: true,
        errorTitle: "Thứ tự không hợp lệ",
        error: "Thứ tự phải là số nguyên từ 1 trở lên.",
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
