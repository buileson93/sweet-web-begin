-- Chốt đơn vị điểm đạt là PHẦN TRĂM (0-100).
-- Trước đây cột pass_score được hiểu lẫn lộn: server so sánh với SỐ CÂU ĐÚNG tuyệt đối,
-- còn giao diện/mặc định lại hiểu là phần trăm.
ALTER TABLE public.quizzes RENAME COLUMN pass_score TO pass_percent;

-- BACKFILL: mọi giá trị cũ > 0 đều là "số câu đúng cần đạt" nên phải quy đổi sang phần trăm:
--   pass_percent = LEAST(100, ROUND(số_câu_cần_đúng / question_count * 100))
-- Ví dụ: 18 câu trên đề 30 câu -> 60%.
UPDATE public.quizzes
SET pass_percent = LEAST(100, ROUND(pass_percent::numeric / NULLIF(question_count, 0) * 100))
WHERE pass_percent > 0
  AND question_count > 0;

-- Trường hợp thiếu question_count mà giá trị vượt dải phần trăm thì kẹp về 100.
UPDATE public.quizzes
SET pass_percent = 100
WHERE pass_percent > 100;

-- Cuộc thi chưa cấu hình (0) dùng mức mặc định 50%.
UPDATE public.quizzes
SET pass_percent = 50
WHERE pass_percent <= 0;

ALTER TABLE public.quizzes ALTER COLUMN pass_percent SET DEFAULT 50;

-- Ràng buộc đơn vị phần trăm.
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_pass_percent_range;
ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_pass_percent_range CHECK (pass_percent >= 0 AND pass_percent <= 100);

COMMENT ON COLUMN public.quizzes.pass_percent IS 'Mức điểm đạt tính theo phần trăm số câu đúng (0-100). 0 = dùng mặc định 50%.';