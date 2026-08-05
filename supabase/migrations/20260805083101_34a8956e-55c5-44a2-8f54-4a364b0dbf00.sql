-- Cập nhật trigger function để đếm số lần nộp bài (submitted_count)
CREATE OR REPLACE FUNCTION public.sync_candidate_quiz_stats()
RETURNS TRIGGER AS $$
BEGIN
    -- Khi có session mới (INSERT)
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, attempt_count, last_updated_at)
        VALUES (NEW.quiz_id, NEW.employee_id, NEW.candidate_name, NEW.unit, 1, now())
        ON CONFLICT (quiz_id, employee_id) DO UPDATE
        SET attempt_count = candidate_quiz_stats.attempt_count + 1,
            candidate_name = EXCLUDED.candidate_name,
            unit = EXCLUDED.unit,
            last_updated_at = now();
    
    -- Khi cập nhật session (UPDATE) để đếm số lần nộp bài
    ELSIF TG_OP = 'UPDATE' THEN
        -- Nếu trạng thái chuyển từ 'active' hoặc 'grading' sang 'submitted' (hoặc 'disqualified' - vẫn tính là đã hoàn thành)
        IF (OLD.submitted_at IS NULL AND NEW.submitted_at IS NOT NULL) OR 
           (OLD.status IN ('active', 'grading') AND NEW.status IN ('submitted', 'disqualified')) THEN
            
            INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, submitted_count, last_updated_at)
            VALUES (NEW.quiz_id, NEW.employee_id, NEW.candidate_name, NEW.unit, 1, now())
            ON CONFLICT (quiz_id, employee_id) DO UPDATE
            SET submitted_count = candidate_quiz_stats.submitted_count + 1,
                last_updated_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Gắn trigger cho UPDATE
DROP TRIGGER IF EXISTS trg_sync_candidate_quiz_stats_update ON public.exam_sessions;
CREATE TRIGGER trg_sync_candidate_quiz_stats_update
AFTER UPDATE ON public.exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_candidate_quiz_stats();

-- Đồng bộ submitted_count cho dữ liệu lịch sử
WITH submission_counts AS (
    SELECT 
        quiz_id, 
        employee_id, 
        COUNT(*) as s_count
    FROM public.exam_sessions
    WHERE employee_id IS NOT NULL 
      AND (submitted_at IS NOT NULL OR status IN ('submitted', 'disqualified'))
    GROUP BY quiz_id, employee_id
)
UPDATE public.candidate_quiz_stats s
SET submitted_count = sc.s_count
FROM submission_counts sc
WHERE s.quiz_id = sc.quiz_id AND s.employee_id = sc.employee_id;
