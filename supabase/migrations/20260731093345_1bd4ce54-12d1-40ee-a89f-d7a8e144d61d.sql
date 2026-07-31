-- Bộ đếm thứ tự lưu tạm đáp án: máy khách gửi clientSeq tăng dần,
-- máy chủ bỏ qua mọi request có clientSeq <= answers_seq hiện tại (chống ghi lùi).
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS answers_seq integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.exam_sessions.answers_seq IS
  'Số thứ tự lần lưu tạm đáp án gần nhất (chống ghi lùi khi mạng chậm). Backfill = 0 cho dữ liệu cũ.';

-- Backfill dữ liệu cũ: mọi phiên trước đây chưa có bộ đếm -> 0 (DEFAULT đã xử lý, giữ lệnh cho rõ ràng).
UPDATE public.exam_sessions SET answers_seq = 0 WHERE answers_seq IS NULL;