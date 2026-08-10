-- Thêm các cột để định danh chính xác hơn, chống false positive khi trùng fingerprint
ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS last_ip text;
ALTER TABLE public.device_locks ADD COLUMN IF NOT EXISTS last_ua text;

-- Cập nhật hàm claim_exam_device để hỗ trợ đối soát fingerprint kết hợp IP
CREATE OR REPLACE FUNCTION public.claim_exam_device(
  p_device_id text,
  p_employee_id uuid,
  p_candidate_name text,
  p_cooldown_minutes integer DEFAULT 30,
  p_ip text DEFAULT NULL,
  p_ua text DEFAULT NULL
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

  -- 1. Tìm khóa theo core_device_id (bền vững nhất - do localStorage cấp)
  SELECT * INTO v_row FROM public.device_locks WHERE device_id = v_core_device_id;

  -- 2. Nếu không thấy (do Incognito/Xóa cache), thử tìm theo fingerprint
  IF v_row.device_id IS NULL AND v_fingerprint IS NOT NULL AND length(v_fingerprint) > 10 THEN
     -- CHỐNG FALSE POSITIVE: Chỉ coi là cùng thiết bị nếu Fingerprint khớp VÀ (IP khớp HOẶC UA khớp)
     -- Nếu dùng chung máy tính công ty nhưng khác trình duyệt/khác IP mạng thì fingerprint vẫn có thể trùng.
     SELECT * INTO v_row FROM public.device_locks 
     WHERE fingerprint = v_fingerprint 
       AND (
         (p_ip IS NOT NULL AND last_ip = p_ip) OR
         (p_ua IS NOT NULL AND last_ua = p_ua)
       )
     ORDER BY last_used_at DESC LIMIT 1;
     
     -- Nếu tìm thấy, ta sẽ kế thừa device_id cũ cho định danh mới này
     IF v_row.device_id IS NOT NULL THEN
        v_core_device_id := v_row.device_id;
     END IF;
  END IF;

  -- Kiểm tra quyền sở hữu thiết bị
  -- Nếu máy chưa có chủ HOẶC chủ cũ chính là người này
  IF v_row.device_id IS NULL OR v_row.employee_id = p_employee_id THEN
    INSERT INTO public.device_locks (device_id, employee_id, candidate_name, last_used_at, fingerprint, last_ip, last_ua)
    VALUES (v_core_device_id, p_employee_id, COALESCE(p_candidate_name, ''), now(), v_fingerprint, p_ip, p_ua)
    ON CONFLICT (device_id) DO UPDATE
      SET employee_id = EXCLUDED.employee_id,
          candidate_name = EXCLUDED.candidate_name,
          last_used_at = now(),
          fingerprint = COALESCE(EXCLUDED.fingerprint, device_locks.fingerprint),
          last_ip = COALESCE(EXCLUDED.last_ip, device_locks.last_ip),
          last_ua = COALESCE(EXCLUDED.last_ua, device_locks.last_ua);
    RETURN QUERY SELECT true, 0, COALESCE(p_candidate_name, '');
    RETURN;
  END IF;

  -- Tính toán thời gian chờ nếu máy đang thuộc về người khác
  v_wait := GREATEST(
    0,
    CEIL(EXTRACT(EPOCH FROM (v_row.last_used_at + make_interval(mins => p_cooldown_minutes) - now())))::integer
  );

  -- Vẫn trong thời gian cooldown
  IF v_wait > 0 THEN
    RETURN QUERY SELECT false, v_wait, v_row.candidate_name;
    RETURN;
  END IF;

  -- Đã hết thời gian cooldown, cho phép đổi chủ sở hữu thiết bị
  UPDATE public.device_locks
  SET employee_id = p_employee_id, 
      candidate_name = COALESCE(p_candidate_name, ''), 
      last_used_at = now(),
      fingerprint = COALESCE(v_fingerprint, fingerprint),
      last_ip = COALESCE(p_ip, last_ip),
      last_ua = COALESCE(p_ua, last_ua)
  WHERE device_id = v_core_device_id;

  RETURN QUERY SELECT true, 0, COALESCE(p_candidate_name, '');
END;
$$;

-- Cấp lại quyền thực thi
GRANT EXECUTE ON FUNCTION public.claim_exam_device(text, uuid, text, integer, text, text) TO service_role;
