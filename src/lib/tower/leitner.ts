/**
 * Hộp Leitner 5 bậc — logic thuần, không phụ thuộc Supabase.
 * Khoảng cách ôn: 1 → 3 → 7 → 16 → 35 ngày. Sai thì về hộp 1.
 */
export type LearnerCard = {
  questionId: string;
  box: number;
  nextDueAt: string;
  lapses: number;
  tag?: string;
};

export const BOX_INTERVAL_DAYS = [1, 3, 7, 16, 35] as const;
export const MAX_BOX = 5;

export function nextBox(box: number, correct: boolean): number {
  if (!correct) return 1;
  return Math.min(MAX_BOX, Math.max(1, Math.floor(box)) + 1);
}

export function intervalDays(box: number): number {
  const idx = Math.min(MAX_BOX, Math.max(1, Math.floor(box))) - 1;
  return BOX_INTERVAL_DAYS[idx] ?? 1;
}

export function scheduleCard(
  card: Pick<LearnerCard, "box" | "lapses">,
  correct: boolean,
  now: Date = new Date(),
): { box: number; nextDueAt: string; lapses: number } {
  const box = nextBox(card.box, correct);
  const due = new Date(now.getTime() + intervalDays(box) * 86_400_000);
  return {
    box,
    nextDueAt: due.toISOString(),
    lapses: card.lapses + (correct ? 0 : 1),
  };
}

/** Thẻ đến hạn khi next_due_at <= now (tính lười, không cần job nền). */
export function isDue(card: Pick<LearnerCard, "nextDueAt">, now: Date = new Date()): boolean {
  return new Date(card.nextDueAt).getTime() <= now.getTime();
}

/**
 * Xếp hàng đợi ôn: ưu tiên thẻ đến hạn sớm nhất, nhưng XEN KẼ chủ đề —
 * không để quá 2 câu liên tiếp cùng một chủ đề.
 */
export function pickDueQueue(cards: LearnerCard[], limit: number, now: Date = new Date()): LearnerCard[] {
  const due = cards
    .filter((c) => isDue(c, now))
    .sort((a, b) => new Date(a.nextDueAt).getTime() - new Date(b.nextDueAt).getTime());

  const out: LearnerCard[] = [];
  const pool = [...due];
  while (out.length < limit && pool.length) {
    const lastTwo = out.slice(-2);
    const blocked =
      lastTwo.length === 2 && lastTwo[0]?.tag && lastTwo[0]?.tag === lastTwo[1]?.tag
        ? lastTwo[0]?.tag
        : undefined;
    let idx = pool.findIndex((c) => (c.tag ?? "") !== blocked);
    if (idx < 0) idx = 0;
    out.push(pool.splice(idx, 1)[0]!);
  }
  return out;
}
