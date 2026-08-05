
CREATE OR REPLACE FUNCTION public.sync_candidate_quiz_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, attempt_count, last_updated_at)
        VALUES (NEW.quiz_id, NEW.employee_id, NEW.candidate_name, NEW.unit, 1, now())
        ON CONFLICT (quiz_id, employee_id) DO UPDATE
        SET attempt_count = candidate_quiz_stats.attempt_count + 1,
            candidate_name = EXCLUDED.candidate_name,
            unit = EXCLUDED.unit,
            last_updated_at = now();
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status IS DISTINCT FROM NEW.status
           AND NEW.status IN ('submitted', 'disqualified') THEN
            INSERT INTO public.candidate_quiz_stats (quiz_id, employee_id, candidate_name, unit, submitted_count, last_updated_at)
            VALUES (NEW.quiz_id, NEW.employee_id, NEW.candidate_name, NEW.unit, 1, now())
            ON CONFLICT (quiz_id, employee_id) DO UPDATE
            SET submitted_count = candidate_quiz_stats.submitted_count + 1,
                last_updated_at = now();
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;

WITH agg AS (
  SELECT quiz_id, employee_id,
         count(*) AS attempts,
         count(*) FILTER (WHERE status IN ('submitted','disqualified')) AS submitted
  FROM public.exam_sessions
  WHERE employee_id IS NOT NULL
  GROUP BY quiz_id, employee_id
)
UPDATE public.candidate_quiz_stats s
SET attempt_count = agg.attempts,
    submitted_count = agg.submitted,
    last_updated_at = now()
FROM agg
WHERE s.quiz_id = agg.quiz_id AND s.employee_id = agg.employee_id;
