/** Tách danh sách nhân viên thành nhóm đã thi và chưa thi. */

export type RosterEmployee = {
  id: string;
  full_name: string;
  unit_name: string | null;
};

export type AttemptRow = {
  employee_id: string | null;
  score: number;
  total: number;
  submitted_at: string;
};

export type ParticipantDone = {
  id: string;
  name: string;
  unit: string;
  attempts: number;
  bestScore: number;
  total: number;
  lastAt: string;
};

export type ParticipantPending = {
  id: string;
  name: string;
  unit: string;
};

export type Participation = {
  done: ParticipantDone[];
  pending: ParticipantPending[];
  doneCount: number;
  pendingCount: number;
  totalCount: number;
  /** Tỉ lệ tham gia (0–100), làm tròn. */
  percent: number;
};

const collator = new Intl.Collator("vi");

/** Ghép danh bạ nhân viên với các lượt thi để biết ai đã thi, ai chưa. */
export function splitParticipation(roster: RosterEmployee[], attempts: AttemptRow[]): Participation {
  const byEmployee = new Map<string, AttemptRow[]>();
  for (const a of attempts) {
    if (!a.employee_id) continue;
    const list = byEmployee.get(a.employee_id);
    if (list) list.push(a);
    else byEmployee.set(a.employee_id, [a]);
  }

  const done: ParticipantDone[] = [];
  const pending: ParticipantPending[] = [];

  for (const e of roster) {
    const unit = e.unit_name ?? "Chưa cập nhật";
    const rows = byEmployee.get(e.id);
    if (!rows || rows.length === 0) {
      pending.push({ id: e.id, name: e.full_name, unit });
      continue;
    }
    const best = rows.reduce((m, r) => (r.score > m.score ? r : m), rows[0]);
    const lastAt = rows.reduce((m, r) => (r.submitted_at > m ? r.submitted_at : m), rows[0].submitted_at);
    done.push({
      id: e.id,
      name: e.full_name,
      unit,
      attempts: rows.length,
      bestScore: best.score,
      total: best.total,
      lastAt,
    });
  }

  done.sort((a, b) => b.bestScore - a.bestScore || collator.compare(a.name, b.name));
  pending.sort((a, b) => collator.compare(a.unit, b.unit) || collator.compare(a.name, b.name));

  const totalCount = roster.length;
  return {
    done,
    pending,
    doneCount: done.length,
    pendingCount: pending.length,
    totalCount,
    percent: totalCount === 0 ? 0 : Math.round((done.length / totalCount) * 100),
  };
}
