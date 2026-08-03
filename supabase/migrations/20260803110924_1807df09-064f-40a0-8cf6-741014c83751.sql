UPDATE public.results
SET disqualified = true,
    passed = false,
    score = 0,
    points = 0,
    disqualify_reason = 'Nộp bài quá nhanh bất thường (4s cho 20 câu)'
WHERE id = '44cb5deb-b022-4062-adf9-0ac373049238';

UPDATE public.exam_sessions
SET status = 'disqualified'
WHERE id = '64bb6850-924b-4b24-9fbc-1da20df11360';