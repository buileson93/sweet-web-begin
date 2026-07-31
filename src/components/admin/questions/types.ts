import type { Difficulty, QuestionKind } from "@/lib/questionKinds";

export type Pair = { left: string; right: string };

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
  image_url: string | null;
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
  image_url: null as string | null,
};

export type QuestionFormState = typeof emptyForm;

export type EditorProps = {
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
  /** Thông báo lỗi/cảnh báo gắn theo trường, hiện ngay dưới ô nhập. */
  errors?: Partial<Record<string, string>>;
  warnings?: Partial<Record<string, string>>;
};

export type CsvQuestion = { question: string; options: string[]; correct_index: number };

/** Bộ lọc trạng thái lưu trữ. */
export type ArchiveFilter = "active" | "archived" | "all";
