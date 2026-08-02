import { describe, expect, it } from "vitest";

import {
  answerToIndices,
  buildImportPreview,
  parsePairsCell,
  parseKind,
  rowToDraft,
  splitList,
} from "@/lib/questionImport";

describe("answerToIndices", () => {
  it("đọc nhiều đáp án cách nhau bằng ; hoặc ,", () => {
    expect(answerToIndices("A;B;D")).toEqual([0, 1, 3]);
    expect(answerToIndices("1,3")).toEqual([0, 2]);
    expect(answerToIndices("")).toEqual([]);
  });
});

describe("parsePairsCell", () => {
  it("tách các cặp ghép theo dấu = và dấu ;", () => {
    expect(parsePairsCell("Nội Bài = VVNB; Đà Nẵng = VVDN")).toEqual([
      { left: "Nội Bài", right: "VVNB" },
      { left: "Đà Nẵng", right: "VVDN" },
    ]);
  });
});

describe("splitList", () => {
  it("tách danh sách theo ; | và xuống dòng", () => {
    expect(splitList("121.5;121,5|121.5 MHz")).toEqual(["121.5", "121,5", "121.5 MHz"]);
  });
});

describe("parseKind mở rộng", () => {
  it("nhận thêm nối cặp và sắp xếp", () => {
    expect(parseKind("Nối cặp")).toBe("matching");
    expect(parseKind("sap xep")).toBe("ordering");
  });
});

describe("rowToDraft với đầy đủ trường", () => {
  it("đọc câu nhiều đáp án, thời gian riêng và giải thích từng phương án", () => {
    const d = rowToDraft(
      {
        cau_hoi: "Chọn các yếu tố khí tượng?",
        loai_cau: "Nhiều đáp án",
        phuong_an_a: "Sương mù",
        phuong_an_b: "Mưa",
        phuong_an_c: "Tên đường lăn",
        dap_an: "A;B",
        thoi_gian: "60",
        thu_tu: "3",
        giai_thich_a: "Đúng",
        mo_ta_anh: "Ảnh sân bay",
      },
      2,
    );
    expect(d.kind).toBe("multi");
    expect(d.correct_indices).toEqual([0, 1]);
    expect(d.time_limit_seconds).toBe(60);
    expect(d.order_index).toBe(3);
    expect(d.option_explanations?.[0]).toBe("Đúng");
    expect(d.image_alt).toBe("Ảnh sân bay");
  });

  it("câu sắp xếp lấy thứ tự đúng từ cột dap_an", () => {
    const d = rowToDraft(
      {
        cau_hoi: "Sắp xếp trình tự?",
        loai_cau: "Sắp xếp",
        phuong_an_a: "Lăn",
        phuong_an_b: "Khởi hành",
        phuong_an_c: "Cất cánh",
        dap_an: "B;A;C",
      },
      2,
    );
    expect(d.correct_order).toEqual([1, 0, 2]);
    const [item] = buildImportPreview([d], new Set<string>());
    expect(item.status).not.toBe("error");
  });

  it("câu sắp xếp thiếu thứ tự đúng bị báo lỗi", () => {
    const d = rowToDraft(
      {
        cau_hoi: "Sắp xếp trình tự?",
        loai_cau: "Sắp xếp",
        phuong_an_a: "Lăn",
        phuong_an_b: "Khởi hành",
        dap_an: "B",
      },
      2,
    );
    const [item] = buildImportPreview([d], new Set<string>());
    expect(item.status).toBe("error");
  });

  it("câu điền đáp án nhận nhiều cách viết", () => {
    const d = rowToDraft(
      { cau_hoi: "Tần số khẩn nguy?", loai_cau: "Điền đáp án", dap_an_dien: "121.5;121,5" },
      2,
    );
    expect(d.accepted_answers).toEqual(["121.5", "121,5"]);
  });
});
