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

GRANT SELECT, INSERT, DELETE ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins grant roles" ON public.user_roles;
CREATE POLICY "admins grant roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins revoke roles" ON public.user_roles;
CREATE POLICY "admins revoke roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND user_id <> auth.uid());