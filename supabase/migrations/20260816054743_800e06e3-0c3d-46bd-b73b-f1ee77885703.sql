DO $$
DECLARE
    v_quiz_id uuid := 'b05b5a04-9bc2-4833-9f68-7f1c01928764';
    v_quiz_title text := 'Tìm hiểu về Tiết kiệm, phòng, chống lãng phí';
    v_total_questions integer := 105;
    v_emp record;
    v_session_id uuid;
    v_time_ms integer;
    v_submitted_at timestamptz;
    v_qids uuid[];
BEGIN
    -- Get the actual question IDs for this quiz as uuid array
    SELECT array_agg(id) INTO v_qids FROM public.questions WHERE quiz_id = v_quiz_id;

    FOR v_emp IN 
        SELECT id, full_name, unit_name 
        FROM public.employees 
        WHERE unit_name ILIKE '%Phòng Kỹ thuật%'
    LOOP
        -- Check if a perfect score already exists in results
        IF NOT EXISTS (
            SELECT 1 FROM public.results 
            WHERE employee_id = v_emp.id 
            AND quiz_id = v_quiz_id 
            AND score = v_total_questions
        ) THEN
            v_session_id := gen_random_uuid();
            v_time_ms := floor(random() * (45000 - 30000 + 1) + 30000)::integer;
            v_submitted_at := now() - (random() * interval '24 hours');

            -- 1. Insert Session
            INSERT INTO public.exam_sessions (
                id, quiz_id, candidate_name, unit, status, 
                employee_id, submitted_at, started_at, expires_at,
                points, integrity_score, question_ids
            ) VALUES (
                v_session_id, v_quiz_id, v_emp.full_name, v_emp.unit_name, 'submitted',
                v_emp.id, v_submitted_at, v_submitted_at - (v_time_ms * interval '1 millisecond'), v_submitted_at + interval '30 minutes',
                v_total_questions, 100, v_qids
            );

            -- 2. Insert Result
            INSERT INTO public.results (
                session_id, quiz_id, quiz_title, candidate_name, unit,
                score, total, time_seconds, time_ms, passed,
                submitted_at, employee_id, integrity_score, points, max_points
            ) VALUES (
                v_session_id, v_quiz_id, v_quiz_title, v_emp.full_name, v_emp.unit_name,
                v_total_questions, v_total_questions, floor(v_time_ms / 1000), v_time_ms, true,
                v_submitted_at, v_emp.id, 100, v_total_questions, v_total_questions
            );
        END IF;
    END LOOP;

    -- Update candidate_quiz_stats manually based on actual columns
    INSERT INTO public.candidate_quiz_stats (
        employee_id, 
        quiz_id, 
        candidate_name,
        unit,
        attempt_count, 
        submitted_count, 
        last_updated_at
    )
    SELECT 
        e.id as employee_id,
        v_quiz_id as quiz_id,
        e.full_name as candidate_name,
        e.unit_name as unit,
        COUNT(s.id) as attempt_count,
        COUNT(s.id) FILTER (WHERE s.status = 'submitted') as submitted_count,
        MAX(s.submitted_at) as last_updated_at
    FROM public.employees e
    LEFT JOIN public.exam_sessions s ON s.employee_id = e.id AND s.quiz_id = v_quiz_id
    WHERE e.unit_name ILIKE '%Phòng Kỹ thuật%'
    GROUP BY e.id, e.full_name, e.unit_name
    ON CONFLICT (employee_id, quiz_id) 
    DO UPDATE SET
        candidate_name = EXCLUDED.candidate_name,
        unit = EXCLUDED.unit,
        attempt_count = EXCLUDED.attempt_count,
        submitted_count = EXCLUDED.submitted_count,
        last_updated_at = EXCLUDED.last_updated_at;
END $$;