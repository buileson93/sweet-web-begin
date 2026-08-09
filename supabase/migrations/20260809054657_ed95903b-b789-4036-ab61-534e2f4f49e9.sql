DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'quizzes' AND column_name = 'strict_mode') THEN
    ALTER TABLE public.quizzes ADD COLUMN strict_mode BOOLEAN DEFAULT FALSE;
  END IF;
END $$;
