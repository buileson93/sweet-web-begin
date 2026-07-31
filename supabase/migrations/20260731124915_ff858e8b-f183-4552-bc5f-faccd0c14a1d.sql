ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS streak_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_max_bonus integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS double_points_after integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.quizzes.streak_step IS 'Điểm cộng thêm luỹ tiến cho mỗi câu đúng liên tiếp (từ câu thứ 3)';
COMMENT ON COLUMN public.quizzes.streak_max_bonus IS 'Trần điểm thưởng chuỗi cho mỗi câu';
COMMENT ON COLUMN public.quizzes.double_points_after IS 'Số câu đúng liên tiếp để nhân đôi điểm câu đó; 0 = tắt';