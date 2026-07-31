UPDATE public.quizzes
SET start_time = timestamptz '2026-08-01 08:00:00+07'
WHERE id = 'de4a7cfd-f3ad-45bb-9245-39fdbb8da514'
  AND start_time IS DISTINCT FROM timestamptz '2026-08-01 08:00:00+07';