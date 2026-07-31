import type { Difficulty, QuestionKind } from "@/lib/questionKinds";

export type Pair = { left: string; right: string };

export type QuestionRow = {
  id: string;
  quiz_id: string;
  question: string;
  options: string[];
  correct_index: number;
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
};

export const emptyForm = {
  question: "",
  options: ["", "", "", ""],
  correct_index: 0,
  correct_indices: [] as number[],
  accepted_answers: "",
  pairs: [] as Pair[],
  kind: "single" as QuestionKind,
  difficulty: "medium" as Difficulty,
  points: 1,
  order_index: 0,
  tags: "",
  explanation: "",
  image_url: null as string | null,
};

export type QuestionFormState = typeof emptyForm;

export type EditorProps = {
  form: QuestionFormState;
  setForm: React.Dispatch<React.SetStateAction<QuestionFormState>>;
};

export type CsvQuestion = { question: string; options: string[]; correct_index: number };
