-- Lớp chiến binh cho đấu trường
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS class_id text NOT NULL DEFAULT 'phap_su';
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS lowest_hp integer NOT NULL DEFAULT 100;
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS biggest_hit integer NOT NULL DEFAULT 0;
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS preferred_class text NOT NULL DEFAULT 'phap_su';
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS bot_wins integer NOT NULL DEFAULT 0;

-- Huy hiệu đấu trường
INSERT INTO public.badges (code, name, description, icon, sort_order) VALUES
  ('arena_first_blood', 'Trận đầu tiên', 'Hoàn thành ván so tài đầu tiên.', '🎬', 100),
  ('arena_win_10', 'Tay đấu cứng', 'Thắng 10 ván so tài.', '🥉', 110),
  ('arena_win_50', 'Cao thủ sân đấu', 'Thắng 50 ván so tài.', '🥇', 120),
  ('arena_flawless', 'Bất bại tuyệt đối', 'Thắng một ván mà không mất giọt máu nào.', '✨', 130),
  ('arena_comeback', 'Lật kèo', 'Thắng khi máu từng rơi xuống dưới 20.', '🔥', 140),
  ('arena_streak_5', 'Chuỗi thắng 5', 'Thắng 5 ván liên tiếp.', '⚡', 150),
  ('arena_big_hit', 'Nhát chém trời giáng', 'Gây 30 sát thương trở lên trong một đòn.', '💥', 160),
  ('arena_bot_slayer', 'Vượt qua người máy', 'Thắng máy luyện tập 5 lần.', '🤖', 170)
ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, icon = EXCLUDED.icon, sort_order = EXCLUDED.sort_order;

CREATE INDEX IF NOT EXISTS idx_duel_answers_duel_emp ON public.duel_answers (duel_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_player_badges_emp ON public.player_badges (employee_id);