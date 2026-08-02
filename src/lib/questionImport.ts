/**
 * Lớp chuyển đổi & kiểm tra dữ liệu nhập câu hỏi (CSV / XLSX / DOCX).
 * Toàn bộ là hàm thuần để kiểm thử được, không đụng tới Supabase hay DOM.
 */
import type { CsvRow } from "@/lib/csv";
import type { ParsedQuestion } from "@/lib/docxParse";
import { normalizeText, type Difficulty, type QuestionKind } from "@/lib/questionKinds";
import { validateQuestionDraft } from "@/lib/questionValidation";

export type ImportPair = { left: string; right: string };

export type ImportDraft = {
  /** Dòng/thứ tự trong tệp nguồn, dùng để báo lỗi. */
  line: number;
  question: string;
  options: string[];
  correct_index: number;
  kind: QuestionKind;
  difficulty: Difficulty;
  points: number;
  explanation: string;
  tags: string[];
  /** Câu nhiều đáp án: danh sách chỉ số đúng. */
  correct_indices?: number[];
  /** Câu điền đáp án: các đáp án được chấp nhận. */
  accepted_answers?: string[];
  /** Câu nối cặp. */
  pairs?: ImportPair[];
  /** Câu sắp xếp: thứ tự đúng theo chỉ số phương án. */
  correct_order?: number[];
  /** Giải thích riêng cho từng phương án (song song với `options`). */
  option_explanations?: string[];
  /** Mô tả ảnh minh hoạ cho trình đọc màn hình. */
  image_alt?: string;
  /** Giới hạn thời gian riêng của câu (giây); null = dùng giờ chung. */
  time_limit_seconds?: number | null;
  /** Thứ tự hiển thị khi cuộc thi tắt xáo trộn câu hỏi. */
  order_index?: number;
  /** Chỉ số ảnh trong tệp .docx (lớp UI sẽ đổi thành tệp thật). */
  imageRef?: number | null;
  optionImageRefs?: (number | null)[];
};


export type ImportStatus = "ok" | "warn" | "error";

export type ImportItem = {
  draft: ImportDraft;
  status: ImportStatus;
  /** Trùng với câu đã có trong cuộc thi. */
  duplicate: boolean;
  messages: string[];
};

const DIFFICULTY_MAP: Record<string, Difficulty> = {
  de: "easy",
  "dễ": "easy",
  easy: "easy",
  tb: "medium",
  "trung bình": "medium",
  "trung binh": "medium",
  medium: "medium",
  kho: "hard",
  "khó": "hard",
  hard: "hard",
};

const KIND_MAP: Record<string, QuestionKind> = {
  "một đáp án": "single",
  "mot dap an": "single",
  single: "single",
  "đúng/sai": "true_false",
  "dung/sai": "true_false",
  "đúng sai": "true_false",
  "dung sai": "true_false",
  true_false: "true_false",
  "nhiều đáp án": "multi",
  "nhieu dap an": "multi",
  multi: "multi",
  "điền đáp án": "fill_blank",
  "dien dap an": "fill_blank",
  fill_blank: "fill_blank",
  "nối cặp": "matching",
  "noi cap": "matching",
  matching: "matching",
  "sắp xếp": "ordering",
  "sap xep": "ordering",
  ordering: "ordering",
};

export function parseDifficulty(raw: string | undefined): Difficulty {
  const key = (raw ?? "").trim().toLowerCase();
  return DIFFICULTY_MAP[key] ?? "medium";
}

export function parseKind(raw: string | undefined): QuestionKind {
  const key = (raw ?? "").trim().toLowerCase();
  return KIND_MAP[key] ?? "single";
}

/** Chuyển chữ cái đáp án (A/B/C/D hoặc 1/2/3/4) sang chỉ số. */
export function answerToIndex(raw: string | undefined): number {
  const value = (raw ?? "").trim().toUpperCase();
  if (!value) return -1;
  if (/^[1-9]$/.test(value)) return Number(value) - 1;
  const code = value.charCodeAt(0) - 65;
  return code >= 0 && code < 26 ? code : -1;
}

/** Nhiều đáp án hoặc thứ tự đúng: "A;B;D" / "1,3" → danh sách chỉ số. */
export function answerToIndices(raw: string | undefined): number[] {
  return (raw ?? "")
    .split(/[;,|/]/)
    .map((part) => answerToIndex(part))
    .filter((i) => i >= 0);
}

/** Ô "cap_ghep": "Vế trái = Vế phải" mỗi cặp một dòng hoặc cách nhau bởi dấu ;. */
export function parsePairsCell(raw: string | undefined): ImportPair[] {
  return (raw ?? "")
    .split(/[\n;]/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [left, ...rest] = line.split(/=|->|→|\|/);
      return { left: (left ?? "").trim(), right: rest.join("=").trim() };
    })
    .filter((p) => p.left || p.right);
}

/** Tách danh sách ngăn cách bởi xuống dòng, dấu ; hoặc |. */
export function splitList(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(/[\n;|]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Một dòng bảng tính (CSV hoặc XLSX) thành bản nháp câu hỏi. */
export function rowToDraft(row: CsvRow, line: number): ImportDraft {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k];
      if (v !== undefined && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  const letters = ["a", "b", "c", "d", "e", "f"];
  const options = letters
    .map((k) => get(`phuong_an_${k}`, `option_${k}`, k))
    .filter((v, i) => v !== "" || i < 2);

  const kind = parseKind(get("loai_cau", "kind"));
  const answerCell = get("dap_an", "answer", "dap_an_dung");
  const indices = answerToIndices(answerCell);
  const optionExplanations = letters
    .slice(0, options.length)
    .map((k) => get(`giai_thich_${k}`, `explanation_${k}`));
  const time = Number(get("thoi_gian", "time_limit_seconds"));
  const order = Number(get("thu_tu", "order_index"));

  const draft: ImportDraft = {
    line,
    question: get("cau_hoi", "question", "noi_dung"),
    options,
    correct_index: kind === "ordering" ? 0 : answerToIndex(answerCell),
    kind,
    difficulty: parseDifficulty(get("do_kho", "difficulty")),
    points: Math.max(1, Math.round(Number(get("diem", "points") || 1)) || 1),
    explanation: get("giai_thich", "explanation"),
    tags: get("nhan", "tags")
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter(Boolean),
    correct_indices: indices,
    accepted_answers: splitList(get("dap_an_dien", "accepted_answers")),
    pairs: parsePairsCell(get("cap_ghep", "pairs")),
    correct_order: kind === "ordering" ? indices : [],
    option_explanations: optionExplanations,
    image_alt: get("mo_ta_anh", "image_alt"),
    time_limit_seconds: Number.isFinite(time) && time > 0 ? Math.round(time) : null,
  };
  if (Number.isFinite(order) && order > 0) draft.order_index = Math.round(order);
  return draft;
}


/** Kết quả phân tích .docx thành bản nháp câu hỏi. */
export function parsedToDraft(q: ParsedQuestion, line: number): ImportDraft {
  return {
    line,
    question: q.question,
    options: q.options,
    correct_index: q.correct_index,
    kind: "single",
    difficulty: "medium",
    points: 1,
    explanation: q.explanation,
    tags: [],
    imageRef: q.imageRef,
    optionImageRefs: q.optionImageRefs,
  };
}

/**
 * Dựng bảng xem trước: gắn trạng thái Hợp lệ / Cảnh báo / Lỗi cho từng câu,
 * phát hiện trùng trong tệp và trùng với ngân hàng câu hỏi hiện có.
 */
export function buildImportPreview(
  drafts: ImportDraft[],
  existingKeys: Set<string>,
): ImportItem[] {
  const seen = new Set<string>();
  return drafts.map((draft) => {
    const messages: string[] = [];
    const result = validateQuestionDraft(
      {
        kind: draft.kind,
        question: draft.question,
        options: draft.options,
        correct_index: draft.correct_index,
        correct_indices: [],
        accepted_answers: "",
        pairs: [],
        points: draft.points,
        time_limit_seconds: null,
      },
      [],
    );
    Object.values(result.errors).forEach((m) => messages.push(String(m)));
    const warnCount = messages.length;
    Object.values(result.warnings).forEach((m) => messages.push(String(m)));

    const key = normalizeText(draft.question);
    let duplicate = false;
    if (key && seen.has(key)) {
      duplicate = true;
      messages.push("Trùng với một câu khác trong cùng tệp.");
    } else if (key && existingKeys.has(key)) {
      duplicate = true;
      messages.push("Cuộc thi đã có câu hỏi trùng nội dung.");
    }
    if (key) seen.add(key);

    const status: ImportStatus =
      warnCount > 0 ? "error" : duplicate || messages.length > 0 ? "warn" : "ok";
    return { draft, status, duplicate, messages };
  });
}

/** Danh sách câu sẽ được ghi, tuỳ chọn có nhập cả câu trùng hay không. */
export function selectImportable(items: ImportItem[], includeDuplicates: boolean): ImportItem[] {
  return items.filter((i) => i.status !== "error" && (includeDuplicates || !i.duplicate));
}

/** Nội dung CSV liệt kê các dòng lỗi để người soạn đề tải về sửa. */
export function issuesToCsv(items: ImportItem[]): string {
  const rows = [
    ["dong", "trang_thai", "cau_hoi", "ly_do"],
    ...items
      .filter((i) => i.status !== "ok")
      .map((i) => [
        String(i.draft.line),
        i.status === "error" ? "Lỗi" : "Cảnh báo",
        i.draft.question,
        i.messages.join(" | "),
      ]),
  ];
  return rows
    .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

/** Chia danh sách thành các lô nhỏ để ghi dần và hiển thị tiến trình. */
export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
