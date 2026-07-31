-- Thêm cột thứ tự ổn định cho ngân hàng câu hỏi (idempotent).
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS order_index int NOT NULL DEFAULT 0;

-- Backfill: đánh số theo created_at trong từng cuộc thi, bắt đầu từ 1.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY quiz_id ORDER BY created_at, id) AS rn
  FROM public.questions
)
UPDATE public.questions q
SET order_index = ranked.rn
FROM ranked
WHERE q.id = ranked.id AND q.order_index = 0;

-- Chỉ mục phục vụ truy vấn pool theo thứ tự.
CREATE INDEX IF NOT EXISTS questions_quiz_order_idx
  ON public.questions (quiz_id, order_index, created_at);

COMMENT ON COLUMN public.questions.order_index IS 'Thứ tự hiển thị ổn định trong cuộc thi; dùng khi quizzes.shuffle_questions = false.';