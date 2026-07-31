-- 1. Kiểu câu hỏi
DO $$ BEGIN
  CREATE TYPE public.question_kind AS ENUM ('single', 'true_false', 'multi', 'fill_blank', 'matching', 'ordering');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.question_difficulty AS ENUM ('easy', 'medium', 'hard');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Mở rộng bảng câu hỏi
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS kind public.question_kind NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS correct_indices integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS accepted_answers text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS pairs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS correct_order integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS difficulty public.question_difficulty NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS explanation text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS time_limit_seconds integer,
  ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS questions_quiz_difficulty_idx ON public.questions (quiz_id, difficulty) WHERE is_archived = false;
CREATE INDEX IF NOT EXISTS questions_tags_idx ON public.questions USING gin (tags);

-- 3. Mở rộng bảng cuộc thi
ALTER TABLE public.quizzes
  ADD COLUMN IF NOT EXISTS pass_score integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS room_password text,
  ADD COLUMN IF NOT EXISTS max_attempts integer,
  ADD COLUMN IF NOT EXISTS instant_feedback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_fifty_fifty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_skip boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_bonus boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_question_map boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS negative_marking numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS blueprint jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 4. Phiên thi & kết quả
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS helpers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0;

ALTER TABLE public.results
  ADD COLUMN IF NOT EXISTS points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_points integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS passed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS breakdown jsonb NOT NULL DEFAULT '[]'::jsonb;