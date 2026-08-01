-- 1) Kết quả: khách vãng lai chỉ đọc được các cột an toàn cho bảng xếp hạng
REVOKE SELECT ON public.results FROM anon;
GRANT SELECT (id, quiz_id, quiz_title, candidate_name, unit, score, total, time_seconds, disqualified, submitted_at, points, max_points, best_streak, passed)
  ON public.results TO anon;

-- Nhân sự quản trị vẫn đọc đầy đủ
DROP POLICY IF EXISTS "results staff read" ON public.results;
CREATE POLICY "results staff read" ON public.results
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'staff') OR public.has_role(auth.uid(), 'editor'));

-- 2) Cuộc thi: ẩn mật khẩu phòng thi với khách vãng lai
REVOKE SELECT ON public.quizzes FROM anon;
GRANT SELECT (id, legacy_id, title, description, start_time, end_time, is_active, question_count, duration_minutes,
              shuffle_options, shuffle_questions, pass_score, max_attempts, instant_feedback, allow_fifty_fifty,
              allow_skip, streak_bonus, show_question_map, negative_marking, blueprint, created_at, updated_at)
  ON public.quizzes TO anon;

-- 3) Hàm nội bộ chỉ dành cho trigger/hệ thống
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user_role() FROM PUBLIC, anon, authenticated;