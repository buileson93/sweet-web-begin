import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";
import {
  accumulateTopics,
  masteryOf,
  readinessPercent,
  START_RATING,
  type Mastery,
} from "@/lib/tower/topics";

export type TopicRatingRow = { tag: string; rating: number; games: number; correct: number };

/** Đọc toàn bộ Elo chủ đề của một người — 1 truy vấn có chỉ mục. */
export async function readTopicRatings(
  employeeId: string,
): Promise<Record<string, { rating: number; games: number; correct: number }>> {
  const { data } = await supabaseAdmin
    .from("topic_ratings")
    .select("tag, rating, games, correct")
    .eq("employee_id", employeeId);

  const out: Record<string, { rating: number; games: number; correct: number }> = {};
  for (const r of (data ?? []) as TopicRatingRow[]) {
    out[r.tag] = { rating: r.rating, games: r.games, correct: r.correct };
  }
  return out;
}

/** Cập nhật Elo chủ đề sau một chặng — một lệnh upsert theo lô, không trigger. */
export async function applyTopicResults(
  employeeId: string,
  items: { tags: string[]; difficulty: string; fraction: number }[],
): Promise<void> {
  if (!employeeId || !items.length) return;
  const relevant = items.filter((i) => i.tags.some((t) => t.trim()));
  if (!relevant.length) return;

  const current = await readTopicRatings(employeeId);
  const deltas = accumulateTopics(current, relevant);
  if (!deltas.length) return;

  await supabaseAdmin
    .from("topic_ratings")
    .upsert(
      deltas.map((d) => ({
        employee_id: employeeId,
        tag: d.tag,
        rating: d.rating,
        games: d.games,
        correct: d.correct,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "employee_id,tag" },
    )
    .then(
      () => undefined,
      () => undefined,
    );
}

export type SkillCell = {
  tag: string;
  rating: number;
  games: number;
  correct: number;
  accuracy: number;
  mastery: Mastery;
};

/** Bản đồ năng lực cá nhân + báo cáo sẵn sàng thi (chỉ đọc, tham khảo). */
export async function getSkillMap(input: {
  name: string;
  credential: string;
  extraCredential?: string;
}): Promise<{ candidateName: string; topics: SkillCell[]; readiness: number; mastered: number }> {
  const employee = await verifyEmployee(input);
  const ratings = await readTopicRatings(employee.id);

  const topics: SkillCell[] = Object.entries(ratings)
    .map(([tag, v]) => ({
      tag,
      rating: v.rating,
      games: v.games,
      correct: v.correct,
      accuracy: v.games ? Math.round((v.correct / v.games) * 100) : 0,
      mastery: masteryOf(v.rating, v.games),
    }))
    .sort((a, b) => a.rating - b.rating);

  return {
    candidateName: employee.fullName,
    topics,
    readiness: readinessPercent(topics),
    mastered: topics.filter((t) => t.mastery === "thanh-thao").length,
  };
}

export type OrgTopicRow = {
  tag: string;
  learners: number;
  avgRating: number;
  accuracy: number;
  mastery: Mastery;
};

/**
 * Chủ đề yếu nhất toàn đơn vị — chỉ đọc `topic_ratings`, phân trang phía máy chủ.
 * Dùng để quyết định nội dung tập huấn, không dính tới kết quả kỳ thi.
 */
export async function getOrgWeakTopics(input: {
  page?: number;
  pageSize?: number;
}): Promise<{ rows: OrgTopicRow[]; total: number; page: number; pageSize: number }> {
  const pageSize = Math.min(50, Math.max(5, input.pageSize ?? 20));
  const page = Math.max(1, input.page ?? 1);

  const { data } = await supabaseAdmin
    .from("topic_ratings")
    .select("tag, rating, games, correct")
    .limit(20000);

  const agg = new Map<string, { sum: number; learners: number; games: number; correct: number }>();
  for (const r of (data ?? []) as TopicRatingRow[]) {
    const cur = agg.get(r.tag) ?? { sum: 0, learners: 0, games: 0, correct: 0 };
    agg.set(r.tag, {
      sum: cur.sum + r.rating,
      learners: cur.learners + 1,
      games: cur.games + r.games,
      correct: cur.correct + r.correct,
    });
  }

  const all: OrgTopicRow[] = [...agg.entries()]
    .map(([tag, v]) => {
      const avgRating = Math.round(v.sum / Math.max(1, v.learners));
      return {
        tag,
        learners: v.learners,
        avgRating,
        accuracy: v.games ? Math.round((v.correct / v.games) * 100) : 0,
        mastery: masteryOf(avgRating, v.games),
      };
    })
    .sort((a, b) => a.avgRating - b.avgRating);

  return {
    rows: all.slice((page - 1) * pageSize, page * pageSize),
    total: all.length,
    page,
    pageSize,
  };
}

export { START_RATING };
