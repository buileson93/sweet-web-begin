
-- Function to get unit statistics aggregated on the database side
create or replace function public.get_unit_statistics(_quiz_id uuid default null)
returns table (
    unit text,
    attempts bigint,
    candidates bigint,
    avg_percent numeric,
    pass_rate numeric,
    best numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with unit_list as (
        -- Get all unique units from both sources to ensure we don't miss any
        select distinct trim(cqs.unit) as unit_name from public.candidate_quiz_stats cqs where (_quiz_id is null or cqs.quiz_id = _quiz_id) and cqs.attempt_count > 0
        union
        select distinct trim(r.unit) as unit_name from public.results r where (_quiz_id is null or r.quiz_id = _quiz_id) and r.disqualified = false
    ),
    base_stats as (
        select 
            trim(cqs.unit) as unit_name,
            sum(cqs.attempt_count) as total_attempts,
            count(distinct cqs.employee_id) as total_candidates
        from public.candidate_quiz_stats cqs
        where (_quiz_id is null or cqs.quiz_id = _quiz_id)
          and cqs.attempt_count > 0
        group by 1
    ),
    metrics as (
        select 
            trim(r.unit) as unit_name,
            avg((r.score::numeric / nullif(r.total, 0)) * 100) as avg_score_pct,
            count(*) filter (where r.passed = true) * 100.0 / nullif(count(*), 0) as pass_rate_pct,
            max((r.score::numeric / nullif(r.total, 0)) * 100) as best_pct
        from public.results r
        where (_quiz_id is null or r.quiz_id = _quiz_id)
          and r.disqualified = false
        group by 1
    )
    select 
        ul.unit_name as unit,
        coalesce(bs.total_attempts, 0)::bigint as attempts,
        coalesce(bs.total_candidates, 0)::bigint as candidates,
        round(coalesce(m.avg_score_pct, 0))::numeric as avg_percent,
        round(coalesce(m.pass_rate_pct, 0))::numeric as pass_rate,
        round(coalesce(m.best_pct, 0))::numeric as best
    from unit_list ul
    left join base_stats bs on ul.unit_name = bs.unit_name
    left join metrics m on ul.unit_name = m.unit_name
    order by avg_percent desc;
end;
$$;

-- Function for score distribution
create or replace function public.get_score_distribution_stats(_quiz_id uuid default null)
returns table (
    range text,
    count bigint,
    fail boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with scored_results as (
        select (score::numeric / nullif(total, 0)) * 100 as pct
        from public.results
        where (_quiz_id is null or quiz_id = _quiz_id)
          and disqualified = false
    )
    select 'Dưới 50%' as range, count(*)::bigint, true as fail from scored_results where pct < 50
    union all
    select '50–64%' as range, count(*)::bigint, false as fail from scored_results where pct >= 50 and pct < 65
    union all
    select '65–79%' as range, count(*)::bigint, false as fail from scored_results where pct >= 65 and pct < 80
    union all
    select '80–89%' as range, count(*)::bigint, false as fail from scored_results where pct >= 80 and pct < 90
    union all
    select '90–100%' as range, count(*)::bigint, false as fail from scored_results where pct >= 90;
end;
$$;

-- Grants
grant execute on function public.get_unit_statistics(uuid) to authenticated;
grant execute on function public.get_score_distribution_stats(uuid) to authenticated;
