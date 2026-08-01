DROP POLICY IF EXISTS "questions editor manage" ON public.questions;
CREATE POLICY "questions editor manage" ON public.questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

DROP POLICY IF EXISTS "quizzes editor manage" ON public.quizzes;
CREATE POLICY "quizzes editor manage" ON public.quizzes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

DROP POLICY IF EXISTS "units editor manage" ON public.units;
CREATE POLICY "units editor manage" ON public.units
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'editor'));

DROP POLICY IF EXISTS "Editors can read audit logs" ON public.audit_logs;
CREATE POLICY "Editors can read audit logs" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'editor'));