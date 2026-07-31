import { describe, expect, it } from "vitest";

import {
  ARENA_BADGES,
  arenaBadgeByCode,
  evaluateArenaBadges,
  newlyEarned,
  rankQuizExperts,
  type ArenaAchievementInput,
} from "./achievements";

const base: ArenaAchievementInput = {
  duels: 1,
  wins: 0,
  streak: 0,
  botWins: 0,
  wonThisDuel: false,
  hpLeft: 40,
  hpStart: 100,
  lowestHp: 40,
  biggestHit: 8,
};

describe("thành tựu đấu trường", () => {
  it("mã huy hiệu không trùng nhau", () => {
    const codes = ARENA_BADGES.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
    expect(arenaBadgeByCode("arena_win_10")?.name).toBe("Tay đấu cứng");
    expect(arenaBadgeByCode("khong_ton_tai")).toBeNull();
  });

  it("ván đầu tiên luôn được huy hiệu mở màn", () => {
    expect(evaluateArenaBadges(base)).toContain("arena_first_blood");
  });

  it("mốc thắng 10 và 50 trao đúng ngưỡng", () => {
    expect(evaluateArenaBadges({ ...base, wins: 9 })).not.toContain("arena_win_10");
    expect(evaluateArenaBadges({ ...base, wins: 10 })).toContain("arena_win_10");
    expect(evaluateArenaBadges({ ...base, wins: 50 })).toEqual(
      expect.arrayContaining(["arena_win_10", "arena_win_50"]),
    );
  });

  it("bất bại tuyệt đối chỉ khi thắng mà còn nguyên máu", () => {
    expect(
      evaluateArenaBadges({ ...base, wonThisDuel: true, hpLeft: 100, lowestHp: 100 }),
    ).toContain("arena_flawless");
    expect(evaluateArenaBadges({ ...base, wonThisDuel: true, hpLeft: 99 })).not.toContain(
      "arena_flawless",
    );
    expect(evaluateArenaBadges({ ...base, wonThisDuel: false, hpLeft: 100 })).not.toContain(
      "arena_flawless",
    );
  });

  it("lật kèo khi thắng dù máu từng dưới 20", () => {
    expect(
      evaluateArenaBadges({ ...base, wonThisDuel: true, lowestHp: 12, hpLeft: 12 }),
    ).toContain("arena_comeback");
    expect(
      evaluateArenaBadges({ ...base, wonThisDuel: true, lowestHp: 25, hpLeft: 25 }),
    ).not.toContain("arena_comeback");
  });

  it("đòn từ 30 sát thương trở lên được huy hiệu nhát chém", () => {
    expect(evaluateArenaBadges({ ...base, biggestHit: 29 })).not.toContain("arena_big_hit");
    expect(evaluateArenaBadges({ ...base, biggestHit: 30 })).toContain("arena_big_hit");
  });

  it("chuỗi thắng và thắng máy luyện tập", () => {
    expect(evaluateArenaBadges({ ...base, streak: 5 })).toContain("arena_streak_5");
    expect(evaluateArenaBadges({ ...base, botWins: 5 })).toContain("arena_bot_slayer");
  });

  it("không trao lại huy hiệu đã có", () => {
    const eligible = evaluateArenaBadges({ ...base, wins: 10 });
    expect(newlyEarned(["arena_first_blood"], eligible)).not.toContain("arena_first_blood");
    expect(newlyEarned(["arena_first_blood"], eligible)).toContain("arena_win_10");
    expect(newlyEarned(eligible, eligible)).toEqual([]);
  });
});

describe("xếp hạng chuyên gia bộ đề", () => {
  const rows = [
    { employeeId: "a", displayName: "An", correct: 30, answered: 40, wins: 5 },
    { employeeId: "b", displayName: "Bình", correct: 30, answered: 35, wins: 9 },
    { employeeId: "c", displayName: "Cường", correct: 10, answered: 12, wins: 1 },
  ];

  it("xếp theo số câu đúng rồi tới số trận thắng", () => {
    const r = rankQuizExperts(rows);
    expect(r.map((x) => x.employeeId)).toEqual(["b", "a", "c"]);
    expect(r[0]!.rank).toBe(1);
  });

  it("tính tỉ lệ đúng và gắn danh hiệu chuyên gia cho người đứng đầu", () => {
    const r = rankQuizExperts(rows);
    expect(r[0]!.accuracy).toBe(86);
    expect(r[0]!.expert).toBe(true);
    expect(r[1]!.expert).toBe(false);
  });

  it("chưa đủ số câu tối thiểu thì không có danh hiệu chuyên gia", () => {
    const r = rankQuizExperts([
      { employeeId: "z", displayName: "Zét", correct: 5, answered: 5, wins: 1 },
    ]);
    expect(r[0]!.expert).toBe(false);
    expect(r[0]!.accuracy).toBe(100);
  });

  it("danh sách rỗng trả về rỗng", () => {
    expect(rankQuizExperts([])).toEqual([]);
  });
});
