ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

-- Trợ lý luyện tập: 3 mức độ x 4 bản sao để nhiều người luyện cùng lúc
INSERT INTO public.employees (id, full_name, name_key, unit_name, is_active)
SELECT v.id::uuid, v.full_name, v.name_key, 'Trợ lý luyện tập', false
FROM (VALUES
  ('bb000000-0000-4000-8000-000000000001','Trợ lý Sao Mai 1','trolysaomai1'),
  ('bb000000-0000-4000-8000-000000000002','Trợ lý Sao Mai 2','trolysaomai2'),
  ('bb000000-0000-4000-8000-000000000003','Trợ lý Sao Mai 3','trolysaomai3'),
  ('bb000000-0000-4000-8000-000000000004','Trợ lý Sao Mai 4','trolysaomai4'),
  ('bb000000-0000-4000-8000-000000000011','Trợ lý Hải Âu 1','trolyhaiau1'),
  ('bb000000-0000-4000-8000-000000000012','Trợ lý Hải Âu 2','trolyhaiau2'),
  ('bb000000-0000-4000-8000-000000000013','Trợ lý Hải Âu 3','trolyhaiau3'),
  ('bb000000-0000-4000-8000-000000000014','Trợ lý Hải Âu 4','trolyhaiau4'),
  ('bb000000-0000-4000-8000-000000000021','Trợ lý Đại Bàng 1','trolydaibang1'),
  ('bb000000-0000-4000-8000-000000000022','Trợ lý Đại Bàng 2','trolydaibang2'),
  ('bb000000-0000-4000-8000-000000000023','Trợ lý Đại Bàng 3','trolydaibang3'),
  ('bb000000-0000-4000-8000-000000000024','Trợ lý Đại Bàng 4','trolydaibang4')
) AS v(id, full_name, name_key)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.players (employee_id, display_name, unit, elo, blocked)
SELECT e.id, e.full_name, 'Trợ lý luyện tập',
  CASE WHEN e.full_name LIKE 'Trợ lý Sao Mai%' THEN 900
       WHEN e.full_name LIKE 'Trợ lý Hải Âu%' THEN 1050
       ELSE 1250 END,
  true
FROM public.employees e
WHERE e.unit_name = 'Trợ lý luyện tập'
ON CONFLICT (employee_id) DO UPDATE SET blocked = true, unit = 'Trợ lý luyện tập';

INSERT INTO public.player_profiles (employee_id, display_name, unit, xp, level, avatar_url)
SELECT e.id, e.full_name, 'Trợ lý luyện tập',
  CASE WHEN e.full_name LIKE 'Trợ lý Sao Mai%' THEN 300
       WHEN e.full_name LIKE 'Trợ lý Hải Âu%' THEN 1200
       ELSE 3200 END,
  CASE WHEN e.full_name LIKE 'Trợ lý Sao Mai%' THEN 2
       WHEN e.full_name LIKE 'Trợ lý Hải Âu%' THEN 4
       ELSE 7 END,
  '2d:personas:e0f2fe:' || replace(e.full_name, ' ', '%20')
FROM public.employees e
WHERE e.unit_name = 'Trợ lý luyện tập'
ON CONFLICT (employee_id) DO NOTHING;

CREATE OR REPLACE VIEW public.arena_leaderboard AS
 SELECT row_number() OVER (ORDER BY elo DESC, wins DESC) AS rank,
    CASE
      WHEN POSITION((' '::text) IN (display_name)) > 0
        THEN regexp_replace(display_name, '(\s)(\S+)$'::text, ('\1'::text || "left"(regexp_replace(display_name, '^.*\s'::text, ''::text), 1)) || '.'::text)
      ELSE display_name
    END AS short_name,
    unit, elo, wins, losses, draws, best_streak, games
   FROM public.players p
  WHERE games > 0 AND blocked = false
  ORDER BY elo DESC, wins DESC
 LIMIT 100;