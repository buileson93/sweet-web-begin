-- Create RPC to get fraud report
CREATE OR REPLACE FUNCTION public.get_fraud_report(
  _quiz_id UUID DEFAULT NULL,
  _min_integrity INTEGER DEFAULT 95,
  _limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  session_id UUID,
  candidate_name TEXT,
  unit TEXT,
  quiz_title TEXT,
  integrity_score INTEGER,
  started_at TIMESTAMPTZ,
  fingerprint TEXT,
  device_info JSONB,
  event_summary JSONB,
  risk_level TEXT,
  risk_reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH session_events AS (
    -- Summarize events for each session
    SELECT 
      e.session_id,
      jsonb_object_agg(e.kind, e.count) as counts
    FROM (
      SELECT 
        ev.session_id, 
        ev.kind, 
        COUNT(*) as count
      FROM exam_events ev
      GROUP BY ev.session_id, ev.kind
    ) e
    GROUP BY e.session_id
  ),
  fingerprint_counts AS (
    -- Count how many unique employee_ids are associated with each fingerprint
    SELECT 
      dl.fingerprint,
      COUNT(DISTINCT dl.user_id) as employee_count
    FROM device_locks dl
    WHERE dl.fingerprint IS NOT NULL
    GROUP BY dl.fingerprint
  )
  SELECT 
    s.id as session_id,
    s.candidate_name,
    s.unit,
    q.title as quiz_title,
    s.integrity_score,
    s.started_at,
    s.fingerprint,
    s.device_info,
    COALESCE(se.counts, '{}'::jsonb) as event_summary,
    CASE 
      WHEN s.integrity_score < 30 OR fc.employee_count > 2 THEN 'high'
      WHEN s.integrity_score < 70 OR fc.employee_count > 1 THEN 'medium'
      ELSE 'low'
    END as risk_level,
    CASE
      WHEN fc.employee_count > 2 THEN 'Thiết bị dùng cho > 2 người (' || fc.employee_count || ')'
      WHEN fc.employee_count > 1 THEN 'Thiết bị dùng cho 2 người'
      WHEN s.integrity_score < 50 THEN 'Điểm liêm chính rất thấp'
      WHEN s.integrity_score < 90 THEN 'Điểm liêm chính thấp'
      ELSE 'Nghi vấn nhẹ'
    END as risk_reason
  FROM exam_sessions s
  JOIN quizzes q ON s.quiz_id = q.id
  LEFT JOIN session_events se ON s.id = se.session_id
  LEFT JOIN fingerprint_counts fc ON s.fingerprint = fc.fingerprint
  WHERE 
    (s.integrity_score < _min_integrity OR fc.employee_count > 1 OR se.session_id IS NOT NULL)
    AND (_quiz_id IS NULL OR s.quiz_id = _quiz_id)
  ORDER BY 
    CASE WHEN s.integrity_score < 30 OR fc.employee_count > 2 THEN 0 WHEN s.integrity_score < 70 OR fc.employee_count > 1 THEN 1 ELSE 2 END ASC,
    s.started_at DESC
  LIMIT _limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_fraud_report TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fraud_report TO service_role;
