# Plan - Database Seed for "Phòng Kỹ Thuật" Employees

The user wants to seed the database with perfect exam scores for all employees in "Phòng Kỹ Thuật" for the quiz "Tìm hiểu về Tiết kiệm, phòng, chống lãng phí" (ID: `b05b5a04-9bc2-4833-9f68-7f1c01928764`). The duration should be randomized between 30s and 45s, and every question should be marked as correct (105/105).

## Objectives
- Identify all employees in "Phòng Kỹ Thuật".
- Generate perfect score results for each employee for the specific quiz.
- Use random durations between 30,000ms and 45,000ms.
- Insert records into `exam_sessions` and `results`.
- Update `candidate_quiz_stats` via the existing trigger or manual sync if needed.

## Technical Details

### Quiz Info
- Title: Tìm hiểu về Tiết kiệm, phòng, chống lãng phí
- ID: `b05b5a04-9bc2-4833-9f68-7f1c01928764`
- Total Questions: 105

### Target Employees (Phòng Kỹ Thuật)
- Nguyễn Lương Giám (`e780ca70...`)
- Trần Quang Vinh (`9b5591c0...`)
- Mai Quang Hưng (`a554433f...`)
- Nguyễn Thị Thùy Dung (`9f77d1c8...`)
- Hứa Thị Phương (`0b8bf728...`)
- Phạm Quốc Phú (`0be378eb...`)
- Nguyễn Thị Hoài Phương (`f2b283a3...`)
- Đinh Văn Toan (`d1b6b391...`)
- Đoàn Hữu Tuấn (`738f42ea...`)
- Châu Quang Huy (`be27171c...`)
- Bùi Lê Sơn (`e1ccaa9c...`)
- Trần Thuận Hoàng (`241e8043...`)

### Data Generation Strategy
For each employee, we will generate:
1. An `exam_sessions` record with status 'submitted'.
2. A `results` record with `score` = 105, `total` = 105, `passed` = true.
3. `time_ms` randomly between 30000 and 45000.

### Steps
1. Create a SQL migration to perform the insertion.
2. The SQL will use a loop or a bulk insert joining the employees list.
3. Ensure `candidate_quiz_stats` is updated.

## Proposed SQL Migration

```sql
DO $$
DECLARE
    v_quiz_id uuid := 'b05b5a04-9bc2-4833-9f68-7f1c01928764';
    v_quiz_title text := 'Tìm hiểu về Tiết kiệm, phòng, chống lãng phí';
    v_total_questions integer := 105;
    v_emp record;
    v_session_id uuid;
    v_time_ms integer;
    v_submitted_at timestamptz;
BEGIN
    FOR v_emp IN 
        SELECT id, full_name, unit_name 
        FROM public.employees 
        WHERE unit_name ILIKE '%Phòng Kỹ thuật%'
    LOOP
        -- Check if a perfect score already exists to avoid duplicates if re-run
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
                points, score, integrity_score
            ) VALUES (
                v_session_id, v_quiz_id, v_emp.full_name, v_emp.unit_name, 'submitted',
                v_emp.id, v_submitted_at, v_submitted_at - (v_time_ms * interval '1 millisecond'), v_submitted_at + interval '30 minutes',
                v_total_questions, v_total_questions, 100
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
END $$;

-- Force sync stats
SELECT public.sync_candidate_quiz_stats();
```
