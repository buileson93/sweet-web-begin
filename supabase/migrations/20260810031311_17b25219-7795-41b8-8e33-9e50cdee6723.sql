CREATE OR REPLACE FUNCTION public.claim_exam_device(p_device_id text, p_employee_id uuid, p_candidate_name text, p_cooldown_minutes integer DEFAULT 30)
 RETURNS TABLE(allowed boolean, wait_seconds integer, holder_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row public.device_locks%ROWTYPE;
  v_wait integer;
  v_core_device_id text;
  v_fingerprint text;
  v_parts text[];
  v_fp_collision_count integer;
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

  -- 2. Nếu không thấy theo device_id, thử kiểm tra fingerprint
  IF v_row.device_id IS NULL AND v_fingerprint IS NOT NULL AND length(v_fingerprint) > 10 THEN
     -- Kiểm tra xem fingerprint này có quá phổ biến không (nhiều người dùng chung một loại phần cứng/trình duyệt)
     SELECT count(DISTINCT employee_id) INTO v_fp_collision_count 
     FROM public.device_locks 
     WHERE fingerprint = v_fingerprint;

     -- Nếu fingerprint này đã được dùng bởi hơn 3 người khác nhau, nó không còn là định danh tin cậy
     -- Chúng ta sẽ bỏ qua việc chặn theo fingerprint để tránh false positive cho các thiết bị giống hệt nhau
     IF v_fp_collision_count <= 3 THEN
        SELECT * INTO v_row FROM public.device_locks 
        WHERE fingerprint = v_fingerprint 
        ORDER BY last_used_at DESC LIMIT 1;
        
        -- Nếu tìm thấy theo fingerprint tin cậy, ta đồng bộ core_device_id
        IF v_row.device_id IS NOT NULL THEN
           v_core_device_id := v_row.device_id;
        END IF;
     END IF;
  END IF;

  -- Kiểm tra quyền sở hữu thiết bị
  -- Nếu là chủ cũ hoặc thiết bị chưa ai nhận, cho phép và cập nhật
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
$function$;
