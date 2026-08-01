-- Bỏ chỉ mục trùng: (quiz_id, difficulty) partial đã được idx_questions_quiz_difficulty bao trọn
DROP INDEX IF EXISTS public.questions_quiz_difficulty_idx;
-- Bỏ chỉ mục trùng: (employee_id) đã là tiền tố trái của (employee_id, joined_at DESC)
DROP INDEX IF EXISTS public.duel_players_employee_idx;
-- Trigger snapshot_question_version() lấy max(version) theo question_id
CREATE INDEX IF NOT EXISTS question_versions_question_version_idx
  ON public.question_versions (question_id, version DESC);