-- 1. Thêm cột is_featured vào bảng quizzes
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT false;

-- 2. Đảm bảo chỉ có tối đa 1 cuộc thi được "nổi bật" (Featured)
CREATE OR REPLACE FUNCTION public.ensure_single_featured_quiz()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_featured THEN
        UPDATE public.quizzes 
        SET is_featured = false 
        WHERE id != NEW.id AND is_featured = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_ensure_single_featured_quiz ON public.quizzes;
CREATE TRIGGER trg_ensure_single_featured_quiz
BEFORE INSERT OR UPDATE OF is_featured ON public.quizzes
FOR EACH ROW
WHEN (NEW.is_featured = true)
EXECUTE FUNCTION public.ensure_single_featured_quiz();

-- 3. Cập nhật GRANT
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;
GRANT SELECT ON public.quizzes TO anon;

-- 4. Đặt cuộc thi "Luật Hàng không dân dụng Việt Nam" làm nổi bật nếu tồn tại
UPDATE public.quizzes 
SET is_featured = true 
WHERE title ILIKE '%Luật Hàng không dân dụng Việt Nam%' 
   OR id = 'de4a7cfd-f3ad-45bb-9245-39fdbb8da514';

-- 5. Đồng bộ lại dữ liệu lịch sử cho candidate_quiz_stats (đảm bảo attempt_count cũng đúng)
WITH session_stats AS (
    SELECT 
        quiz_id, 
        employee_id,
        MIN(candidate_name) as candidate_name,
        MIN(unit) as unit,
        COUNT(*) as a_count,
        COUNT(*) FILTER (WHERE submitted_at IS NOT NULL OR status IN ('submitted', 'disqualified')) as s_count
    FROM public.exam_sessions
    WHERE employee_id IS NOT NULL
    GROUP BY quiz_id, employee_id
)
INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, attempt_count, submitted_count, last_updated_at)
SELECT quiz_id, employee_id, candidate_name, unit, a_count, s_count, now()
FROM session_stats
ON CONFLICT (quiz_id, employee_id) DO UPDATE
SET attempt_count = EXCLUDED.attempt_count,
    submitted_count = EXCLUDED.submitted_count,
    candidate_name = EXCLUDED.candidate_name,
    unit = EXCLUDED.unit,
    last_updated_at = now();
