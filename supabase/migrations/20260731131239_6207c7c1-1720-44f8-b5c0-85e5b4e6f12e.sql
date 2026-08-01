-- Ghi chú bảo mật: khối lịch chạy tự động ở migration này từng ghi thẳng khoá bí mật
-- vào mã nguồn. Khoá đó đã bị thu hồi. Việc đặt lịch nay nằm ở migration muộn hơn
-- (private.cron_post + private.app_config), không còn khoá bí mật trong repo.

-- 2) Hai cuộc thi đã có đủ câu hỏi nhưng còn ở trạng thái nháp nên không hiện ngoài trang chủ
UPDATE public.quizzes
SET status = 'published', is_active = true
WHERE status = 'draft'
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.quiz_id = quizzes.id AND q.is_archived = false);

-- 3) Dọn các phiên thi đã quá hạn nhưng còn kẹt ở trạng thái "đang thi"
UPDATE public.exam_sessions
SET status = 'abandoned', submitted_at = now()
WHERE status = 'active' AND expires_at < now();
