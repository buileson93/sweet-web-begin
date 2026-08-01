-- Bảng tổng hợp sẵn cho báo cáo chủ đề yếu toàn đơn vị (đọc bằng service_role).
DROP MATERIALIZED VIEW IF EXISTS public.org_topic_stats;

CREATE MATERIALIZED VIEW public.org_topic_stats AS
SELECT
  tag,
  count(*)::int                                   AS learners,
  round(avg(rating))::int                         AS avg_rating,
  coalesce(sum(games), 0)::bigint                 AS games,
  coalesce(sum(correct), 0)::bigint               AS correct
FROM public.topic_ratings
GROUP BY tag;

CREATE UNIQUE INDEX IF NOT EXISTS org_topic_stats_tag_idx ON public.org_topic_stats (tag);
CREATE INDEX IF NOT EXISTS org_topic_stats_rating_idx ON public.org_topic_stats (avg_rating);

REVOKE ALL ON public.org_topic_stats FROM anon, authenticated;
GRANT SELECT ON public.org_topic_stats TO service_role;

CREATE OR REPLACE FUNCTION public.refresh_org_topic_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.org_topic_stats;
EXCEPTION WHEN OTHERS THEN
  -- Lần đầu chưa có dữ liệu thì làm mới thường (CONCURRENTLY yêu cầu đã nạp một lần).
  REFRESH MATERIALIZED VIEW public.org_topic_stats;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_org_topic_stats() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_org_topic_stats() TO service_role;