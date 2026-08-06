
-- Function to get detailed participation summary aggregated on the DB side
create or replace function public.get_detailed_participation_summary(_quiz_id uuid)
returns table (
    id uuid,
    full_name text,
    unit_name text,
    phone text,
    "position" text,
    status text,
    attempts bigint,
    submitted bigint,
    best_score text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    with employee_stats as (
        select 
            e.id as emp_id,
            e.full_name as emp_name,
            e.unit_name as emp_unit,
            e.phone as emp_phone,
            e.position as emp_pos,
            cqs.attempt_count,
            cqs.submitted_count,
            -- Get best result for this employee
            (
                select r.passed || ',' || r.score || '/' || r.total
                from public.results r
                where r.employee_id = e.id and r.quiz_id = _quiz_id and r.disqualified = false
                order by r.passed desc, (r.score::numeric / nullif(r.total, 0)) desc
                limit 1
            ) as best_res
        from public.employees e
        left join public.candidate_quiz_stats cqs on e.id = cqs.employee_id and cqs.quiz_id = _quiz_id
        where e.is_active = true
    ),
    translated_stats as (
        select 
            emp_id,
            emp_name,
            emp_unit,
            emp_phone,
            emp_pos,
            case 
                when split_part(best_res, ',', 1) = 'true' then 'passed'
                when best_res is not null then 'failed'
                when coalesce(attempt_count, 0) > 0 then 'pending'
                else 'none'
            end as participation_status,
            coalesce(attempt_count, 0)::bigint as total_attempts,
            coalesce(submitted_count, 0)::bigint as total_submitted,
            nullif(split_part(best_res, ',', 2), '') as score_display
        from employee_stats
    )
    select * from translated_stats
    order by emp_name;
end;
$$;

grant execute on function public.get_detailed_participation_summary(uuid) to authenticated;
