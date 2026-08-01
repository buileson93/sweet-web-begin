import type { Difficulty, QuestionKind } from "@/lib/questionKinds";

/** `id` chỉ tồn tại phía trình soạn thảo (làm khoá React ổn định), không lưu xuống CSDL. */
export type Pair = { left: string; right: string; id?: string };

let pairSeq = 0;
/** Sinh mã cặp ổn định cho một phiên soạn thảo. */
export function newPairId(): string {
  pairSeq += 1;
  return `p${Date.now().toString(36)}-${pairSeq}`;
}

/** Gắn id cho các cặp đọc từ CSDL (chúng chỉ có left/right). */
export function withPairIds(pairs: Pair[]): Pair[] {
  return pairs.map((p) => ({ ...p, id: p.id ?? newPairId() }));
}

export type QuestionRow = {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
  option_images: string[] | null;
  correct_indices: number[] | null;
  accepted_answers: string[] | null;
  pairs: Pair[] | null;
  kind: QuestionKind | null;
  difficulty: Difficulty | null;
  points: number | null;
  /** Thứ tự hiển thị ổn định khi cuộc thi tắt "Xáo trộn câu hỏi". */
  order_index: number | null;
  tags: string[] | null;
  explanation: string | null;
  /** Giải thích riêng cho từng phương án (song song với `options`). */
  option_explanations: string[] | null;
  image_url: string | null;
  /** Mô tả ảnh (alt) cho trình đọc màn hình. */
  image_alt: string | null;
  /** Giới hạn thời gian riêng cho câu này (giây); null = dùng giờ chung. */
  time_limit_seconds: number | null;
  /** Câu đã lưu trữ sẽ không được bốc vào đề thi. */
  is_archived: boolean | null;
};

export const emptyForm = {
  question: "",
  options: ["", "", "", ""],
  option_images: ["", "", "", ""],
  correct_index: 0,
  correct_indices: [] as number[],
  accepted_answers: "",
  pairs: [] as Pair[],
  kind: "single" as QuestionKind,
  difficulty: "medium" as Difficulty,
  points: 1,
  order_index: 0,
  /** Chuỗi để ô nhập cho phép để trống = dùng thời gian chung của cuộc thi. */
  time_limit_seconds: "" as string,
  tags: "",
  explanation: "",
  /** Giải thích riêng cho từng phương án, cùng chỉ số với `options`. */
  option_explanations: ["", "", "", ""] as string[],
  image_url: null as string | null,
  /** Mô tả ảnh cho trình đọc màn hình (bắt buộc khi có ảnh minh hoạ). */
  image_alt: "",
};

export type QuestionFormState = typeof emptyForm;

export type EditorProps = {
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
  /** Thông báo lỗi/cảnh báo gắn theo trường, hiện ngay dưới ô nhập. */
  errors?: Partial<Record<string, string>>;
  warnings?: Partial<Record<string, string>>;
  /** Mã cuộc thi để tải ảnh phương án lên đúng phạm vi. */
  quizId?: string;
};

export type CsvQuestion = { question: string; options: string[]; correct_index: number };

/** Bộ lọc trạng thái lưu trữ. */
export type ArchiveFilter = "active" | "archived" | "all";
