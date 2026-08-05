-- 1. Tạo bảng thống kê lượt thi
CREATE TABLE IF NOT EXISTS public.candidate_quiz_stats (
    quiz_id uuid REFERENCES public.quizzes(id) ON DELETE CASCADE,
    employee_id uuid, -- Có thể null nếu không có employee_id (dùng name|unit)
    candidate_name text,
    unit text,
    attempt_count integer DEFAULT 0,
    submitted_count integer DEFAULT 0,
    last_updated_at timestamp with time zone DEFAULT now(),
    PRIMARY KEY (quiz_id, employee_id)
);

-- Thêm index để truy vấn nhanh
CREATE INDEX IF NOT EXISTS idx_candidate_quiz_stats_quiz ON public.candidate_quiz_stats(quiz_id);

-- 2. Cấp quyền
GRANT SELECT ON public.candidate_quiz_stats TO authenticated;
GRANT ALL ON public.candidate_quiz_stats TO service_role;

-- 3. Bật RLS
ALTER TABLE public.candidate_quiz_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read candidate_quiz_stats" ON public.candidate_quiz_stats
    FOR SELECT TO authenticated USING (true);

-- 4. Hàm trigger để tự động cập nhật thống kê
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
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger trên bảng exam_sessions
DROP TRIGGER IF EXISTS trg_sync_candidate_quiz_stats ON public.exam_sessions;
CREATE TRIGGER trg_sync_candidate_quiz_stats
AFTER INSERT ON public.exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.sync_candidate_quiz_stats();

-- 6. Đồng bộ dữ liệu cũ (Init data)
-- Xóa stats cũ để tránh trùng lặp nếu chạy lại
TRUNCATE public.candidate_quiz_stats;

INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, attempt_count)
SELECT 
    quiz_id, 
    employee_id, 
    MAX(candidate_name) as candidate_name, 
    MAX(unit) as unit, 
    COUNT(*) as attempt_count
FROM public.exam_sessions
WHERE employee_id IS NOT NULL
GROUP BY quiz_id, employee_id;
