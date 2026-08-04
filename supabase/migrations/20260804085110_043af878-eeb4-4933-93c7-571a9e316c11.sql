-- Hoàn điểm liêm chính cho các sự kiện bị tính oan:
-- nghi vấn script do trần tần suất autosave và do bằng chứng thao tác quá hạn.
WITH oan AS (
  SELECT id, session_id, weight
  FROM public.exam_events
  WHERE kind = 'script_suspect'
    AND weight > 0
    AND (
      (detail->>'reason') LIKE 'autosave_rate:%'
      OR (detail->>'reason') IN ('stale_proof', 'stale_proof_check')
    )
), tru AS (
  SELECT session_id, sum(weight) AS total
  FROM oan
  WHERE session_id IS NOT NULL
  GROUP BY session_id
), da_sua AS (
  UPDATE public.exam_sessions s
  SET integrity_score = GREATEST(0, s.integrity_score - t.total)
  FROM tru t
  WHERE s.id = t.session_id
  RETURNING s.id
)
UPDATE public.exam_events e
SET weight = 0,
    detail = e.detail || jsonb_build_object('refunded', true)
WHERE e.id IN (SELECT id FROM oan);

-- Đồng bộ lại điểm liêm chính đã lưu ở bảng kết quả.
UPDATE public.results r
SET integrity_score = s.integrity_score
FROM public.exam_sessions s
WHERE r.session_id = s.id
  AND r.integrity_score IS DISTINCT FROM s.integrity_score;