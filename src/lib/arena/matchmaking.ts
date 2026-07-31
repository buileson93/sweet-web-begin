/**
 * Thuật toán ghép trận Đấu trường: ưu tiên đối thủ CÙNG TRÌNH (cấp độ + Elo),
 * nới dần biên độ theo thời gian chờ để không ai phải đợi mãi.
 */

export type Candidate = {
  duelId: string;
  employeeId: string;
  elo: number;
  /** Cấp độ kinh nghiệm (1..10). */
  level: number;
  /** Thời điểm tạo phòng (ISO) — phòng chờ lâu hơn được ưu tiên nhẹ. */
  createdAt?: string;
};

export type Seeker = { employeeId: string; elo: number; level: number };

/** Biên độ Elo chấp nhận được theo số giây đã chờ. */
export function eloSpread(waitedSeconds: number): number {
  if (waitedSeconds >= 30) return Number.POSITIVE_INFINITY;
  if (waitedSeconds >= 15) return 300;
  return 150;
}

/** Biên độ chênh lệch cấp độ chấp nhận được theo số giây đã chờ. */
export function levelSpread(waitedSeconds: number): number {
  if (waitedSeconds >= 30) return Number.POSITIVE_INFINITY;
  if (waitedSeconds >= 15) return 3;
  return 2;
}

/** Điểm lệch trình: càng NHỎ càng hợp. 1 cấp lệch ~ 60 Elo. */
export function matchScore(seeker: Seeker, candidate: Candidate, nowMs = Date.now()): number {
  const eloGap = Math.abs(seeker.elo - candidate.elo);
  const levelGap = Math.abs(seeker.level - candidate.level) * 60;
  const waitedMs = candidate.createdAt ? Math.max(0, nowMs - Date.parse(candidate.createdAt)) : 0;
  const waitBonus = Math.min(120, waitedMs / 1000); // chờ 2 phút thì được ưu tiên tối đa
  return eloGap + levelGap - waitBonus;
}

/** Chọn phòng chờ hợp trình nhất; null nếu không phòng nào trong biên độ. */
export function pickBestRoom(
  seeker: Seeker,
  candidates: Candidate[],
  waitedSeconds = 0,
  nowMs = Date.now(),
): Candidate | null {
  const maxElo = eloSpread(waitedSeconds);
  const maxLevel = levelSpread(waitedSeconds);

  const eligible = candidates
    .filter((c) => c.employeeId !== seeker.employeeId)
    .filter((c) => Math.abs(c.elo - seeker.elo) <= maxElo)
    .filter((c) => Math.abs(c.level - seeker.level) <= maxLevel);

  if (eligible.length === 0) return null;
  return eligible.reduce((best, c) =>
    matchScore(seeker, c, nowMs) < matchScore(seeker, best, nowMs) ? c : best,
  );
}
