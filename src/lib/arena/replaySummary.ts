/**
 * Tóm tắt các mốc đáng chú ý của một ván so tài — logic THUẦN để kiểm thử được.
 */
import { skillById } from "@/lib/arena/skills";

export type SummaryRoundLine = {
  employeeId: string;
  displayName: string;
  answered: boolean;
  isCorrect: boolean;
  damage: number;
  firstCorrect: boolean;
  skill: string;
  hpAfter: number;
};

export type SummaryRound = {
  index: number;
  timedOut?: boolean;
  lines: SummaryRoundLine[];
};

export type KeyMoment = {
  /** Câu số (0-based) để nhảy tới khi bấm vào mốc. */
  roundIndex: number;
  kind: "big_hit" | "skill" | "combo" | "timeout" | "ko";
  icon: string;
  text: string;
};

/** Số câu đúng-trước liên tiếp tối thiểu để tính là một chuỗi đáng nhớ. */
export const COMBO_HIGHLIGHT = 3;

export function buildReplaySummary(rounds: SummaryRound[]): KeyMoment[] {
  const moments: KeyMoment[] = [];
  if (!rounds.length) return moments;

  // Đòn nặng nhất trận.
  let best: { round: number; line: SummaryRoundLine } | null = null;
  for (const r of rounds)
    for (const l of r.lines)
      if (l.damage > 0 && (!best || l.damage > best.line.damage)) best = { round: r.index, line: l };
  if (best)
    moments.push({
      roundIndex: best.round,
      kind: "big_hit",
      icon: "💢",
      text: `Đòn nặng nhất: ${best.line.displayName} gây ${best.line.damage} sát thương ở câu ${best.round + 1}`,
    });

  // Kỹ năng đã dùng.
  for (const r of rounds)
    for (const l of r.lines) {
      const def = skillById(l.skill);
      if (def)
        moments.push({
          roundIndex: r.index,
          kind: "skill",
          icon: def.icon,
          text: `${l.displayName} dùng ${def.name} ở câu ${r.index + 1}`,
        });
    }

  // Chuỗi đúng-trước liên tiếp.
  const names = new Map(rounds.flatMap((r) => r.lines.map((l) => [l.employeeId, l.displayName])));
  for (const [id, name] of names) {
    let run = 0;
    let start = 0;
    for (const r of rounds) {
      const hit = r.lines.find((l) => l.employeeId === id)?.firstCorrect;
      if (hit) {
        if (run === 0) start = r.index;
        run += 1;
      } else {
        if (run >= COMBO_HIGHLIGHT)
          moments.push({
            roundIndex: start,
            kind: "combo",
            icon: "🔥",
            text: `${name} thắng liên tiếp ${run} câu (từ câu ${start + 1})`,
          });
        run = 0;
      }
    }
    if (run >= COMBO_HIGHLIGHT)
      moments.push({
        roundIndex: start,
        kind: "combo",
        icon: "🔥",
        text: `${name} thắng liên tiếp ${run} câu (từ câu ${start + 1})`,
      });
  }

  // Câu bị bỏ trống do hết giờ.
  for (const r of rounds)
    if (r.timedOut ?? r.lines.every((l) => !l.answered))
      moments.push({
        roundIndex: r.index,
        kind: "timeout",
        icon: "⏱️",
        text: `Câu ${r.index + 1}: cả hai đều hết giờ, không ai mất máu`,
      });

  // Hạ gục.
  for (const r of rounds)
    for (const l of r.lines)
      if (l.hpAfter <= 0) {
        moments.push({
          roundIndex: r.index,
          kind: "ko",
          icon: "☠️",
          text: `${l.displayName} bị hạ gục ở câu ${r.index + 1}`,
        });
      }

  return moments.sort((a, b) => a.roundIndex - b.roundIndex);
}
