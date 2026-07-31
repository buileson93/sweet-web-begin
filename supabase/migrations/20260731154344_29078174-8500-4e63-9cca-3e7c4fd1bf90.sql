ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS is_bot boolean NOT NULL DEFAULT false;

WITH bots(id, nick, tier) AS (
  VALUES
    ('bb000000-0000-4000-8000-000000000001'::uuid, 'Trợ lý Sao Mai 1', 'de'),
    ('bb000000-0000-4000-8000-000000000002'::uuid, 'Trợ lý Sao Mai 2', 'de'),
    ('bb000000-0000-4000-8000-000000000003'::uuid, 'Trợ lý Sao Mai 3', 'de'),
    ('bb000000-0000-4000-8000-000000000004'::uuid, 'Trợ lý Sao Mai 4', 'de'),
    ('bb000000-0000-4000-8000-000000000011'::uuid, 'Trợ lý Hải Âu 1', 'vua'),
    ('bb000000-0000-4000-8000-000000000012'::uuid, 'Trợ lý Hải Âu 2', 'vua'),
    ('bb000000-0000-4000-8000-000000000013'::uuid, 'Trợ lý Hải Âu 3', 'vua'),
    ('bb000000-0000-4000-8000-000000000014'::uuid, 'Trợ lý Hải Âu 4', 'vua'),
    ('bb000000-0000-4000-8000-000000000021'::uuid, 'Trợ lý Đại Bàng 1', 'kho'),
    ('bb000000-0000-4000-8000-000000000022'::uuid, 'Trợ lý Đại Bàng 2', 'kho'),
    ('bb000000-0000-4000-8000-000000000023'::uuid, 'Trợ lý Đại Bàng 3', 'kho'),
    ('bb000000-0000-4000-8000-000000000024'::uuid, 'Trợ lý Đại Bàng 4', 'kho')
)
INSERT INTO public.employees (id, full_name, name_key, unit_name, position, is_active)
SELECT id, nick, 'tro-ly-' || replace(id::text, '-', ''), 'Trợ lý luyện tập', 'Trợ lý luyện tập', false
FROM bots
ON CONFLICT (id) DO NOTHING;

WITH bots(id, nick, elo) AS (
  VALUES
    ('bb000000-0000-4000-8000-000000000001'::uuid, 'Trợ lý Sao Mai 1', 900),
    ('bb000000-0000-4000-8000-000000000002'::uuid, 'Trợ lý Sao Mai 2', 900),
    ('bb000000-0000-4000-8000-000000000003'::uuid, 'Trợ lý Sao Mai 3', 900),
    ('bb000000-0000-4000-8000-000000000004'::uuid, 'Trợ lý Sao Mai 4', 900),
    ('bb000000-0000-4000-8000-000000000011'::uuid, 'Trợ lý Hải Âu 1', 1000),
    ('bb000000-0000-4000-8000-000000000012'::uuid, 'Trợ lý Hải Âu 2', 1000),
    ('bb000000-0000-4000-8000-000000000013'::uuid, 'Trợ lý Hải Âu 3', 1000),
    ('bb000000-0000-4000-8000-000000000014'::uuid, 'Trợ lý Hải Âu 4', 1000),
    ('bb000000-0000-4000-8000-000000000021'::uuid, 'Trợ lý Đại Bàng 1', 1200),
    ('bb000000-0000-4000-8000-000000000022'::uuid, 'Trợ lý Đại Bàng 2', 1200),
    ('bb000000-0000-4000-8000-000000000023'::uuid, 'Trợ lý Đại Bàng 3', 1200),
    ('bb000000-0000-4000-8000-000000000024'::uuid, 'Trợ lý Đại Bàng 4', 1200)
)
INSERT INTO public.players (employee_id, display_name, unit, elo, blocked)
SELECT id, nick, 'Trợ lý luyện tập', elo, true
FROM bots
ON CONFLICT (employee_id) DO UPDATE SET blocked = true;