CREATE INDEX IF NOT EXISTS results_rank_valid_idx
  ON public.results (quiz_id, score DESC, time_seconds ASC)
  WHERE disqualified = false;