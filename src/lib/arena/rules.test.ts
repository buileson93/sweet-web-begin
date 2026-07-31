import { describe, expect, it } from "vitest";

import {
  DAILY_QUESTS,
  MAX_RANKED_PER_DAY,
  dailyQuestReset,
  isRankedEligible,
  softResetElo,
  vnDayKey,
  vnDayStart,
} from "./rules";

const base = {
  rankedToday: 0,
  sameOpponentStreak: 0,
  lockedUntil: null,
  sameDevice: false,
  nowMs: Date.parse("2026-08-01T05:00:00Z"),
};

describe("isRankedEligible", () => {
  it("bình thường thì tính xếp hạng", () => {
    expect(isRankedEligible(base).ranked).toBe(true);
  });

  it("cùng thiết bị thì không tính Elo", () => {
    const r = isRankedEligible({ ...base, sameDevice: true });
    expect(r.ranked).toBe(false);
    expect(r.reason).toContain("thiết bị");
  });

  it("quá số trận xếp hạng trong ngày thì chuyển đấu vui", () => {
    expect(isRankedEligible({ ...base, rankedToday: MAX_RANKED_PER_DAY }).ranked).toBe(false);
    expect(isRankedEligible({ ...base, rankedToday: MAX_RANKED_PER_DAY - 1 }).ranked).toBe(true);
  });

  it("đấu quá 5 trận liên tiếp với cùng đối thủ thì thôi tính Elo", () => {
    expect(isRankedEligible({ ...base, sameOpponentStreak: 4 }).ranked).toBe(true);
    expect(isRankedEligible({ ...base, sameOpponentStreak: 5 }).ranked).toBe(false);
  });

  it("đang bị khoá xếp hạng thì không tính Elo", () => {
    expect(
      isRankedEligible({ ...base, lockedUntil: "2026-08-01T06:00:00Z" }).ranked,
    ).toBe(false);
    expect(
      isRankedEligible({ ...base, lockedUntil: "2026-08-01T04:00:00Z" }).ranked,
    ).toBe(true);
  });
});

describe("múi giờ Việt Nam", () => {
  it("vnDayKey đổi ngày lúc 17:00 UTC (00:00 giờ VN)", () => {
    expect(vnDayKey(Date.parse("2026-08-01T16:59:00Z"))).toBe("2026-08-01");
    expect(vnDayKey(Date.parse("2026-08-01T17:00:00Z"))).toBe("2026-08-02");
  });

  it("vnDayStart trả về đúng mốc 00:00 giờ VN", () => {
    expect(vnDayStart(Date.parse("2026-08-01T16:59:00Z"))).toBe("2026-07-31T17:00:00.000Z");
  });

  it("dailyQuestReset dựa trên ngày Việt Nam, không phải UTC", () => {
    expect(dailyQuestReset(null, Date.now())).toBe(true);
    // Cùng ngày VN (2026-08-01) dù khác ngày UTC thì KHÔNG reset.
    expect(
      dailyQuestReset("2026-07-31T18:00:00Z", Date.parse("2026-08-01T10:00:00Z")),
    ).toBe(false);
    // Qua 00:00 giờ VN thì reset.
    expect(
      dailyQuestReset("2026-08-01T10:00:00Z", Date.parse("2026-08-01T17:30:00Z")),
    ).toBe(true);
  });
});

describe("softResetElo", () => {
  it("kéo Elo về gần 1000 nhưng vẫn giữ thứ hạng tương đối", () => {
    expect(softResetElo(1000)).toBe(1000);
    expect(softResetElo(1600)).toBe(1200);
    expect(softResetElo(700)).toBe(900);
    expect(softResetElo(1900)).toBeGreaterThan(softResetElo(1600));
  });
});

describe("DAILY_QUESTS", () => {
  it("có đúng 3 nhiệm vụ và mã không trùng", () => {
    expect(DAILY_QUESTS).toHaveLength(3);
    expect(new Set(DAILY_QUESTS.map((q) => q.code)).size).toBe(3);
  });
});
