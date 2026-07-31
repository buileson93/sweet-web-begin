-- 1) Sửa địa chỉ cron: điểm cuối đã chuyển sang /api/public/... để không bị chặn (403)
DO $$
DECLARE v_secret text := 'fbca136ff66b40d13785d43c8e8b3fcdd531a711ec62781e3767eb1710e20e32';
BEGIN
  PERFORM cron.schedule('auto-submit-expired-exams', '*/5 * * * *',
    format($f$select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/auto-submit',headers:='{"Content-Type":"application/json","x-cron-secret":"%s"}'::jsonb,body:='{}'::jsonb) as request_id;$f$, v_secret));
  PERFORM cron.schedule('cleanup-question-images', '0 3 * * *',
    format($f$select net.http_post(url:='https://project--e18a9a92-c822-4f4e-aa3d-fe075ccaef3d.lovable.app/api/public/cron/don-anh',headers:='{"Content-Type":"application/json","x-cron-secret":"%s"}'::jsonb,body:='{}'::jsonb) as request_id;$f$, v_secret));
END $$;

-- 2) Hai cuộc thi đã có đủ câu hỏi nhưng còn ở trạng thái nháp nên không hiện ngoài trang chủ
UPDATE public.quizzes
SET status = 'published', is_active = true
WHERE status = 'draft'
  AND EXISTS (SELECT 1 FROM public.questions q WHERE q.quiz_id = quizzes.id AND q.is_archived = false);

-- 3) Dọn các phiên thi đã quá hạn nhưng còn kẹt ở trạng thái "đang thi" (do cron trước đây bị chặn)
UPDATE public.exam_sessions
SET status = 'abandoned', submitted_at = now()
WHERE status = 'active' AND expires_at < now();