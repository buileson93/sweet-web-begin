-- ============ ĐẤU TRƯỜNG 1vs1 ============
CREATE TABLE IF NOT EXISTS public.players (
  employee_id uuid PRIMARY KEY REFERENCES public.employees(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  elo integer NOT NULL DEFAULT 1000,
  games integer NOT NULL DEFAULT 0,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  coins integer NOT NULL DEFAULT 0,
  abandons integer NOT NULL DEFAULT 0,
  ranked_locked_until timestamptz,
  avatar text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.duels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid REFERENCES public.quizzes(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'waiting',
  round_count integer NOT NULL DEFAULT 10,
  seconds_per_round integer NOT NULL DEFAULT 20,
  is_ranked boolean NOT NULL DEFAULT true,
  current_round integer NOT NULL DEFAULT 0,
  round_served_at timestamptz,
  question_ids uuid[] NOT NULL DEFAULT '{}',
  option_orders jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  finished_at timestamptz,
  winner_employee_id uuid,
  created_by uuid,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.duels DROP CONSTRAINT IF EXISTS duels_status_check;
ALTER TABLE public.duels ADD CONSTRAINT duels_status_check
  CHECK (status IN ('waiting','countdown','playing','finished','cancelled'));

CREATE TABLE IF NOT EXISTS public.duel_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  seat integer NOT NULL DEFAULT 0,
  display_name text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT '',
  elo_before integer NOT NULL DEFAULT 1000,
  elo_after integer,
  score integer NOT NULL DEFAULT 0,
  correct integer NOT NULL DEFAULT 0,
  total_ms integer NOT NULL DEFAULT 0,
  ready boolean NOT NULL DEFAULT false,
  used_fifty_fifty boolean NOT NULL DEFAULT false,
  device_hash text NOT NULL DEFAULT '',
  left_at timestamptz,
  -- Cột phi chuẩn hoá: Postgres KHÔNG cho phép subquery trong predicate của index,
  -- nên trạng thái trận được nhân bản xuống đây và đồng bộ bằng trigger để
  -- unique partial index bảo đảm "một nhân viên chỉ ở một trận chưa kết thúc".
  duel_status text NOT NULL DEFAULT 'waiting',
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duel_id, employee_id),
  UNIQUE (duel_id, seat)
);

CREATE TABLE IF NOT EXISTS public.duel_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  round_index integer NOT NULL,
  value jsonb,
  is_correct boolean NOT NULL DEFAULT false,
  ms_taken integer NOT NULL DEFAULT 0,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (duel_id, employee_id, round_index)
);

CREATE TABLE IF NOT EXISTS public.duel_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id uuid NOT NULL REFERENCES public.duels(id) ON DELETE CASCADE,
  from_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  to_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  from_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '2 minutes',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  closed_at timestamptz,
  standings jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.badges (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  icon text NOT NULL DEFAULT '🏅',
  sort_order integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.player_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  badge_code text NOT NULL REFERENCES public.badges(code) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (employee_id, badge_code)
);

-- ---------- Đồng bộ duel_status ----------
CREATE OR REPLACE FUNCTION public.sync_duel_players_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.duel_players SET duel_status = NEW.status WHERE duel_id = NEW.id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS duels_sync_status ON public.duels;
CREATE TRIGGER duels_sync_status AFTER UPDATE OF status ON public.duels
  FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_duel_players_status();

CREATE OR REPLACE FUNCTION public.set_duel_player_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  SELECT status INTO NEW.duel_status FROM public.duels WHERE id = NEW.duel_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS duel_players_set_status ON public.duel_players;
CREATE TRIGGER duel_players_set_status BEFORE INSERT ON public.duel_players
  FOR EACH ROW EXECUTE FUNCTION public.set_duel_player_status();

-- ---------- Index ----------
CREATE UNIQUE INDEX IF NOT EXISTS players_one_active_duel
  ON public.duel_players(employee_id)
  WHERE left_at IS NULL AND duel_status IN ('waiting','countdown','playing');
CREATE INDEX IF NOT EXISTS duels_status_created_idx ON public.duels(status, created_at DESC);
CREATE INDEX IF NOT EXISTS duel_players_employee_idx ON public.duel_players(employee_id);
CREATE INDEX IF NOT EXISTS duel_players_duel_idx ON public.duel_players(duel_id);
CREATE INDEX IF NOT EXISTS duel_invites_to_idx ON public.duel_invites(to_employee_id, status, expires_at);
CREATE INDEX IF NOT EXISTS duel_answers_duel_round_idx ON public.duel_answers(duel_id, round_index);
CREATE INDEX IF NOT EXISTS players_elo_idx ON public.players(elo DESC);

-- ---------- RLS: đóng hoàn toàn, mọi thao tác qua server function ----------
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duel_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_badges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.players, public.duels, public.duel_players, public.duel_answers,
  public.duel_invites, public.seasons, public.player_badges FROM anon, authenticated;
GRANT ALL ON public.players, public.duels, public.duel_players, public.duel_answers,
  public.duel_invites, public.seasons, public.badges, public.player_badges TO service_role;

-- Danh mục huy hiệu là dữ liệu tĩnh, cho phép đọc để hiển thị.
GRANT SELECT ON public.badges TO anon, authenticated;
DROP POLICY IF EXISTS "badges_read" ON public.badges;
CREATE POLICY "badges_read" ON public.badges FOR SELECT TO anon, authenticated USING (true);

-- ---------- Bảng xếp hạng công khai (ẩn danh tính nhạy cảm) ----------
DROP VIEW IF EXISTS public.arena_leaderboard;
CREATE VIEW public.arena_leaderboard
WITH (security_invoker = off) AS
SELECT
  row_number() OVER (ORDER BY p.elo DESC, p.wins DESC) AS rank,
  -- "Nguyễn Văn A." : giữ họ tên đệm, viết tắt tên riêng
  CASE
    WHEN position(' ' IN p.display_name) > 0
      THEN regexp_replace(p.display_name, '(\s)(\S+)$', '\1' || left(regexp_replace(p.display_name, '^.*\s', ''), 1) || '.')
    ELSE p.display_name
  END AS short_name,
  p.unit,
  p.elo,
  p.wins,
  p.losses,
  p.draws,
  p.best_streak,
  p.games
FROM public.players p
WHERE p.games > 0
ORDER BY p.elo DESC, p.wins DESC
LIMIT 100;

GRANT SELECT ON public.arena_leaderboard TO anon, authenticated;

-- ---------- Realtime: chỉ phát cột an toàn, KHÔNG phát đề ----------
ALTER PUBLICATION supabase_realtime SET TABLE
  public.results (id, quiz_id, quiz_title, candidate_name, unit, score, total, points, max_points, best_streak, passed, time_seconds, disqualified, submitted_at),
  public.duels (id, status, current_round, round_served_at, version, round_count, seconds_per_round, is_ranked),
  public.duel_players (id, duel_id, employee_id, seat, score, correct, ready, left_at);

-- ---------- Huy hiệu mặc định ----------
INSERT INTO public.badges (code, name, description, icon, sort_order) VALUES
  ('first_duel',   'Trận đầu tiên',      'Hoàn thành trận đấu đầu tiên tại Đấu trường.', '🎬', 1),
  ('win_10',       'Thắng 10 trận',      'Giành chiến thắng 10 trận.',                    '🏆', 2),
  ('streak_5',     'Chuỗi 5 thắng',      'Thắng liên tiếp 5 trận.',                       '🔥', 3),
  ('giant_slayer', 'Hạ gục người khổng lồ', 'Thắng đối thủ có Elo cao hơn 200 điểm.',     '⚔️', 4),
  ('fast_5',       'Phản xạ chớp nhoáng','Trả lời đúng dưới 3 giây, 5 lần.',              '⚡', 5),
  ('flawless',     'Bất bại một trận',   'Trả lời đúng toàn bộ 10/10 câu trong một trận.','💎', 6),
  ('monthly_king', 'Quán quân tháng',    'Đứng đầu bảng xếp hạng khi kết thúc mùa giải.', '👑', 7),
  ('games_100',    'Trăm trận',          'Thi đấu đủ 100 trận.',                          '🎖️', 8)
ON CONFLICT (code) DO NOTHING;