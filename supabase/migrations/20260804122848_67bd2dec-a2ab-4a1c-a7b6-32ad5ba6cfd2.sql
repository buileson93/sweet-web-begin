DELETE FROM public.exam_events
WHERE kind = 'devtools_open'
  AND coalesce(detail->>'via','') IN ('console_bait','size','size_persist','');