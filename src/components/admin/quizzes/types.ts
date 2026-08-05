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
  combo_fx: boolean;
  instant_feedback: boolean;
  streak_step: number;
  streak_max_bonus: number;
  double_points_after: number;
  show_question_map: boolean;
  negative_marking: number;
  cover_url: string | null;
  cover_fit: string | null;
  peek_rewards: string[] | null;
  blueprint: { easy?: number; medium?: number; hard?: number; tags?: Record<string, number> } | null;
  strict_mode: boolean;
  disqualify_threshold: number;
  is_featured: boolean;
};

export const QUIZ_STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã xuất bản",
  closed: "Đã đóng",
};
