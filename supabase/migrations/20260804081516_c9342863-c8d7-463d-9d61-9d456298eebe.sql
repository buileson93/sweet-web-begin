-- 1) Mở rộng danh mục sự kiện liêm chính (các loại chống-script trước đây bị CHECK từ chối)
ALTER TABLE public.exam_events DROP CONSTRAINT IF EXISTS exam_events_kind_check;
ALTER TABLE public.exam_events ADD CONSTRAINT exam_events_kind_check CHECK (kind = ANY (ARRAY[
  'tab_hidden','window_blur','copy','paste','contextmenu','fullscreen_exit','resize_suspect',
  'reconnect','multi_tab','devtools_open','liveness_failed','untrusted_input','automation_detected',
  'script_suspect','captcha_failed','honeypot_hit','liveness_rekey'
]));

-- 2) Gộp phần vá vào helpers một cách nguyên tử
CREATE OR REPLACE FUNCTION public.exam_merge_helpers(p_session uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v jsonb;
BEGIN
  UPDATE public.exam_sessions
  SET helpers = coalesce(helpers, '{}'::jsonb) || coalesce(p_patch, '{}'::jsonb)
  WHERE id = p_session
  RETURNING helpers INTO v;
  RETURN coalesce(v, '{}'::jsonb);
END;
$$;

-- 3) Chốt một câu đã chấm-ngay (không mất phần tử do ghi đè song song)
CREATE OR REPLACE FUNCTION public.exam_mark_checked(p_session uuid, p_index integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE v_list jsonb;
BEGIN
  SELECT coalesce(helpers->'checked', '[]'::jsonb) INTO v_list
  FROM public.exam_sessions WHERE id = p_session FOR UPDATE;
  IF v_list IS NULL THEN RETURN; END IF;
  IF NOT (v_list @> to_jsonb(p_index)) THEN
    v_list := v_list || to_jsonb(p_index);
  END IF;
  UPDATE public.exam_sessions
  SET helpers = coalesce(helpers, '{}'::jsonb) || jsonb_build_object('checked', v_list)
  WHERE id = p_session;
END;
$$;

-- 4) Xin suất autosave: kiểm tra + cập nhật trần tần suất trong cùng một giao dịch có khoá hàng
CREATE OR REPLACE FUNCTION public.exam_claim_save(
  p_session uuid,
  p_now_ms bigint,
  p_source text,
  p_fingerprint text,
  p_min_gap integer,
  p_max_saves integer,
  p_max_beacons integer,
  p_seen_limit integer
)
RETURNS TABLE(ok boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  s jsonb;
  v_at bigint;
  v_count integer;
  v_beacons integer;
  v_seen jsonb;
  v_reason text := NULL;
  v_len integer;
BEGIN
  SELECT coalesce(helpers->'save', '{}'::jsonb) INTO s
  FROM public.exam_sessions WHERE id = p_session FOR UPDATE;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'no_session'::text;
    RETURN;
  END IF;

  v_at := coalesce((s->>'at')::bigint, 0);
  v_count := coalesce((s->>'count')::integer, 0);
  v_beacons := coalesce((s->>'beacons')::integer, 0);
  v_seen := coalesce(s->'seen', '[]'::jsonb);

  IF v_at > 0 AND (p_now_ms - v_at) < p_min_gap THEN
    v_reason := 'too_fast';
  ELSIF v_count >= p_max_saves THEN
    v_reason := 'too_many';
  ELSIF p_source = 'beacon' AND v_beacons >= p_max_beacons THEN
    v_reason := 'too_many_beacons';
  ELSIF coalesce(p_fingerprint, '') <> '' AND v_seen @> to_jsonb(p_fingerprint) THEN
    v_reason := 'replay';
  END IF;

  IF v_reason IS NOT NULL THEN
    RETURN QUERY SELECT false, v_reason;
    RETURN;
  END IF;

  IF coalesce(p_fingerprint, '') <> '' THEN
    v_seen := v_seen || to_jsonb(p_fingerprint);
    v_len := jsonb_array_length(v_seen);
    IF v_len > p_seen_limit THEN
      SELECT coalesce(jsonb_agg(e ORDER BY i), '[]'::jsonb) INTO v_seen
      FROM jsonb_array_elements(v_seen) WITH ORDINALITY AS t(e, i)
      WHERE i > v_len - p_seen_limit;
    END IF;
  END IF;

  UPDATE public.exam_sessions
  SET helpers = coalesce(helpers, '{}'::jsonb) || jsonb_build_object('save', jsonb_build_object(
        'at', p_now_ms,
        'count', v_count + 1,
        'beacons', v_beacons + CASE WHEN p_source = 'beacon' THEN 1 ELSE 0 END,
        'seen', v_seen
      ))
  WHERE id = p_session;

  RETURN QUERY SELECT true, ''::text;
END;
$$;

-- 5) Ghi đáp án + seq + phần vá helpers trong một câu lệnh
CREATE OR REPLACE FUNCTION public.exam_apply_answers(
  p_session uuid,
  p_answers jsonb,
  p_seq integer,
  p_helpers jsonb
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.exam_sessions
  SET answers = coalesce(answers, '{}'::jsonb) || coalesce(p_answers, '{}'::jsonb),
      answers_seq = greatest(coalesce(answers_seq, 0), p_seq),
      helpers = coalesce(helpers, '{}'::jsonb) || coalesce(p_helpers, '{}'::jsonb)
  WHERE id = p_session AND status = 'active';
$$;

REVOKE ALL ON FUNCTION public.exam_merge_helpers(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exam_mark_checked(uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exam_claim_save(uuid, bigint, text, text, integer, integer, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.exam_apply_answers(uuid, jsonb, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.exam_merge_helpers(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.exam_mark_checked(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.exam_claim_save(uuid, bigint, text, text, integer, integer, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.exam_apply_answers(uuid, jsonb, integer, jsonb) TO service_role;