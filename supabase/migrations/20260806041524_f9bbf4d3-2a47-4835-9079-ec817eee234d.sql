-- Thêm cột fingerprint vào bảng device_locks để tăng cường định danh thiết bị
ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS fingerprint text;
CREATE INDEX IF NOT EXISTS device_locks_fingerprint_idx ON public.device_locks (fingerprint);

-- Cập nhật hàm claim_exam_device để hỗ trợ đối soát fingerprint
CREATE OR REPLACE FUNCTION public.claim_exam_device(
  p_device_id text,
  p_employee_id uuid,
  p_candidate_name text,
  p_cooldown_minutes integer DEFAULT 30
)
RETURNS TABLE(allowed boolean, wait_seconds integer, holder_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_row public.device_locks%ROWTYPE;
  v_wait integer;
  v_core_device_id text;
  v_fingerprint text;
  v_parts text[];
BEGIN
  IF p_device_id IS NULL OR length(btrim(p_device_id)) < 8 THEN
    RETURN QUERY SELECT true, 0, ''::text;
    RETURN;
  END IF;

  -- Phân tách device_id và fingerprint nếu có định dạng "uuid:fp"
  v_parts := string_to_array(p_device_id, ':');
  v_core_device_id := v_parts[1];
  IF array_length(v_parts, 1) > 1 THEN
    v_fingerprint := v_parts[2];
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_core_device_id, 0));

  -- 1. Tìm khóa theo core_device_id (bền vững nhất)
  SELECT * INTO v_row FROM public.device_locks WHERE device_id = v_core_device_id;

  -- 2. Nếu không thấy, thử tìm theo fingerprint (chống xóa cache/incognito)
  IF v_row.device_id IS NULL AND v_fingerprint IS NOT NULL AND length(v_fingerprint) > 10 THEN
     SELECT * INTO v_row FROM public.device_locks 
     WHERE fingerprint = v_fingerprint 
     ORDER BY last_used_at DESC LIMIT 1;
     
     -- Nếu tìm thấy theo fingerprint, ta sẽ cập nhật device_id mới cho fingerprint này
     -- (người dùng dùng trình duyệt khác hoặc ẩn danh)
     IF v_row.device_id IS NOT NULL THEN
        v_core_device_id := v_row.device_id;
     END IF;
  END IF;

  -- Kiểm tra quyền sở hữu thiết bị
  IF v_row.device_id IS NULL OR v_row.employee_id = p_employee_id THEN
    INSERT INTO public.device_locks (device_id, employee_id, candidate_name, last_used_at, fingerprint)
    VALUES (v_core_device_id, p_employee_id, COALESCE(p_candidate_name, ''), now(), v_fingerprint)
    ON CONFLICT (device_id) DO UPDATE
      SET employee_id = EXCLUDED.employee_id,
          candidate_name = EXCLUDED.candidate_name,
          last_used_at = now(),
          fingerprint = COALESCE(EXCLUDED.fingerprint, device_locks.fingerprint);
    RETURN QUERY SELECT true, 0, COALESCE(p_candidate_name, '');
    RETURN;
  END IF;

  -- Tính toán thời gian chờ
  v_wait := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (v_row.last_used_at + make_interval(mins => p_cooldown_minutes) - now())))::integer
  );

  IF v_wait > 0 THEN
    RETURN QUERY SELECT false, v_wait, v_row.candidate_name;
    RETURN;
  END IF;

  -- Cập nhật chủ sở hữu mới sau khi hết thời gian chờ
  UPDATE public.device_locks
  SET employee_id = p_employee_id, 
      candidate_name = COALESCE(p_candidate_name, ''), 
      last_used_at = now(),
      fingerprint = COALESCE(v_fingerprint, fingerprint)
  WHERE device_id = v_core_device_id;

  RETURN QUERY SELECT true, 0, COALESCE(p_candidate_name, '');
END;
$$;
