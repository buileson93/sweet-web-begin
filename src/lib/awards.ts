/**
 * Bảng vinh danh nhiều hạng mục (ngoài giải Vô địch): combo dài nhất,
 * thi nhiều lần nhất, tốc độ nhanh nhất, tiến bộ nhất...
 * Module thuần để test được, không phụ thuộc React hay Supabase.
 */

export type AwardRow = {
  id: string;
  candidate_name: string;
  unit: string | null;
  score: number;
  total: number;
  time_seconds: number;
  time_ms?: number | null;
  points: number;
  best_streak: number;
  submitted_at: string;
};

export type AwardKey =
  | "champion"
  | "streak"
  | "diligent"
  | "speed"
  | "points"
  | "progress";

export type AwardWinner = {
  key: AwardKey;
  title: string;
  description: string;
  name: string;
  unit: string;
  /** Giá trị hiển thị đã định dạng sẵn. */
  value: string;
  /** Giá trị thô để so sánh/kiểm thử. */
  raw: number;
};

/** Tỉ lệ phần trăm đúng của một bài thi. */
export function percentOfRow(row: Pick<AwardRow, "score" | "total">) {
  return row.total > 0 ? Math.round((row.score / row.total) * 100) : 0;
}

const PASS_PERCENT = 50;

/** Chỉ tính bài đạt từ 50% trở lên vào các hạng mục thành tích. */
export function passedRows(rows: AwardRow[]) {
  return rows.filter((r) => percentOfRow(r) >= PASS_PERCENT);
}

function key(row: AwardRow) {
  return `${row.candidate_name.trim().toLowerCase()}|${(row.unit ?? "").trim().toLowerCase()}`;
}

function best<T>(items: T[], score: (item: T) => number): T | null {
  let winner: T | null = null;
  let bestScore = -Infinity;
  for (const item of items) {
    const s = score(item);
    if (s > bestScore) {
      bestScore = s;
      winner = item;
    }
  }
  return winner;
}

function msOf(r: AwardRow) {
  return r.time_ms ?? Math.max(0, r.time_seconds) * 1000;
}

function mmssms(ms: number) {
  const t = Math.max(0, Math.round(ms));
  const m = Math.floor(t / 60_000);
  const s = Math.floor((t % 60_000) / 1000);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(t % 1000).padStart(3, "0")}`;
}

/** Tính toàn bộ hạng mục vinh danh từ danh sách kết quả hợp lệ. */
export function computeAwards(rows: AwardRow[]): AwardWinner[] {
  const valid = passedRows(rows);
  const awards: AwardWinner[] = [];
  if (valid.length === 0) return awards;

  const champion = best(valid, (r) => percentOfRow(r) * 100000 - r.time_seconds);
  if (champion) {
    awards.push({
      key: "champion",
      title: "Nhà vô địch",
      description: "Điểm cao nhất, thời gian ngắn nhất",
      name: champion.candidate_name,
      unit: champion.unit ?? "Chưa rõ đơn vị",
      value: `${champion.score}/${champion.total}`,
      raw: percentOfRow(champion),
    });
  }

  const streak = best(valid, (r) => r.best_streak);
  if (streak && streak.best_streak > 0) {
    awards.push({
      key: "streak",
      title: "Vua combo",
      description: "Chuỗi câu đúng liên tiếp dài nhất",
      name: streak.candidate_name,
      unit: streak.unit ?? "Chưa rõ đơn vị",
      value: `${streak.best_streak} câu liên tiếp`,
      raw: streak.best_streak,
    });
  }

  // Thi nhiều lần nhất tính trên TẤT CẢ lượt thi (kể cả chưa đạt) — ghi nhận sự chăm chỉ.
  // Hệ thống hiện tại truyền số attempts thực tế từ database vào các hàng kết quả.
  const diligent = best(rows, (r) => (r as any).attempts || 1);
  const diligentCount = diligent ? ((diligent as any).attempts || 1) : 0;
  if (diligent && diligentCount > 1) {
    awards.push({
      key: "diligent",
      title: "Chăm chỉ nhất",
      description: "Số lượt dự thi nhiều nhất",
      name: diligent.candidate_name,
      unit: diligent.unit ?? "Chưa rõ đơn vị",
      value: `${diligentCount} lượt thi`,
      raw: diligentCount,
    });
  }

  const speed = best(valid, (r) => (r.time_seconds > 0 ? -msOf(r) : -Infinity));
  if (speed && speed.time_seconds > 0) {
    awards.push({
      key: "speed",
      title: "Tia chớp",
      description: "Hoàn thành nhanh nhất (bài đạt)",
      name: speed.candidate_name,
      unit: speed.unit ?? "Chưa rõ đơn vị",
      value: mmssms(msOf(speed)),
      raw: speed.time_seconds,
    });
  }

  const points = best(valid, (r) => r.points);
  if (points && points.points > 0) {
    awards.push({
      key: "points",
      title: "Săn điểm thưởng",
      description: "Tổng điểm thưởng cao nhất",
      name: points.candidate_name,
      unit: points.unit ?? "Chưa rõ đơn vị",
      value: `${points.points} điểm`,
      raw: points.points,
    });
  }

  // Tiến bộ nhất: chênh lệch % giữa lượt đầu và lượt tốt nhất của cùng một người.
  const byPerson = new Map<string, AwardRow[]>();
  for (const r of rows) {
    const k = key(r);
    const list = byPerson.get(k);
    if (list) list.push(r);
    else byPerson.set(k, [r]);
  }
  let progressWinner: { row: AwardRow; gain: number } | null = null;
  for (const list of byPerson.values()) {
    if (list.length < 2) continue;
    const sorted = [...list].sort(
      (a, b) => new Date(a.submitted_at).getTime() - new Date(b.submitted_at).getTime(),
    );
    const first = percentOfRow(sorted[0]);
    const top = Math.max(...sorted.map(percentOfRow));
    const gain = top - first;
    if (gain > 0 && (!progressWinner || gain > progressWinner.gain)) {
      progressWinner = { row: sorted[sorted.length - 1], gain };
    }
  }
  if (progressWinner) {
    awards.push({
      key: "progress",
      title: "Tiến bộ vượt bậc",
      description: "Cải thiện điểm nhiều nhất so với lượt đầu",
      name: progressWinner.row.candidate_name,
      unit: progressWinner.row.unit ?? "Chưa rõ đơn vị",
      value: `+${progressWinner.gain}%`,
      raw: progressWinner.gain,
    });
  }

  return awards;
}
