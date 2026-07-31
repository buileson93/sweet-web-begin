export type QuizRow = {
  id: string;
  title: string;
  description: string | null;
  intro_markdown: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  question_count: number;
  duration_minutes: number;
  shuffle_options: boolean;
  shuffle_questions: boolean;
  pass_percent: number;
  room_password: string | null;
  max_attempts: number | null;
  allow_fifty_fifty: boolean;
  allow_skip: boolean;
  streak_bonus: boolean;
  show_question_map: boolean;
  negative_marking: number;
  blueprint: { easy?: number; medium?: number; hard?: number; tags?: Record<string, number> } | null;
};

export const QUIZ_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã xuất bản",
  closed: "Đã đóng",
};
