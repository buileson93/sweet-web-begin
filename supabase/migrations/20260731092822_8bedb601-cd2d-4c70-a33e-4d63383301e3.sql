-- Đánh dấu bài nộp sau giờ (chỉ chấm theo đáp án đã lưu trên máy chủ).
ALTER TABLE public.results ADD COLUMN IF NOT EXISTS late_submit boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.results.late_submit IS 'True khi bài được nộp sau expires_at + thời gian ân hạn; đáp án gửi từ máy khách bị bỏ qua.';

-- Chỉ mục phục vụ job tự động nộp các phiên quá giờ.
CREATE INDEX IF NOT EXISTS exam_sessions_status_expires_idx
  ON public.exam_sessions (status, expires_at);