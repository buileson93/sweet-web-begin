ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '';

DROP POLICY IF EXISTS "quiz_covers_write" ON storage.objects;
DROP POLICY IF EXISTS "quiz_covers_write" ON storage.objects;
CREATE POLICY "quiz_covers_write" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'quiz-covers' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));

DROP POLICY IF EXISTS "quiz_covers_read" ON storage.objects;
DROP POLICY IF EXISTS "quiz_covers_read" ON storage.objects;
CREATE POLICY "quiz_covers_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'quiz-covers' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));

DROP POLICY IF EXISTS "quiz_covers_update" ON storage.objects;
DROP POLICY IF EXISTS "quiz_covers_update" ON storage.objects;
CREATE POLICY "quiz_covers_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'quiz-covers' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));

DROP POLICY IF EXISTS "quiz_covers_delete" ON storage.objects;
DROP POLICY IF EXISTS "quiz_covers_delete" ON storage.objects;
CREATE POLICY "quiz_covers_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'quiz-covers' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor')));