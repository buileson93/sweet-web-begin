import { describe, expect, it } from "vitest";

import { computeXpGain, levelFromXp, levelProgress, levelTitle, xpThreshold } from "@/lib/xp";

describe("xpThreshold", () => {
  it("cấp 1 cần 100 XP để lên cấp 2", () => {
    expect(xpThreshold(1)).toBe(100);
  });

  it("luỹ tiến theo cấp", () => {
    expect(xpThreshold(2)).toBe(250);
    expect(xpThreshold(3)).toBe(450);
    expect(xpThreshold(4)).toBe(700);
  });

  it("chống giá trị âm", () => {
    expect(xpThreshold(0)).toBe(100);
    expect(xpThreshold(-5)).toBe(100);
  });
});

describe("levelFromXp", () => {
  it("bắt đầu ở cấp 1", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
  });

  it("đúng mốc là lên cấp", () => {
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(249)).toBe(2);
    expect(levelFromXp(250)).toBe(3);
    expect(levelFromXp(450)).toBe(4);
  });

  it("xử lý dữ liệu rác", () => {
    expect(levelFromXp(Number.NaN)).toBe(1);
    expect(levelFromXp(-100)).toBe(1);
  });
});

describe("levelProgress", () => {
  it("tính tiến độ trong cấp hiện tại", () => {
    const p = levelProgress(150);
    expect(p.level).toBe(2);
    expect(p.into).toBe(50);
    expect(p.need).toBe(150);
    expect(p.percent).toBe(33);
  });

  it("cấp 1 tính từ 0", () => {
    const p = levelProgress(25);
    expect(p).toMatchObject({ level: 1, into: 25, need: 100, percent: 25 });
  });
});

describe("computeXpGain", () => {
  it("bài bị huỷ không có kinh nghiệm", () => {
    expect(computeXpGain({ score: 20, total: 20, passed: true, bestStreak: 20, disqualified: true })).toBe(0);
  });

  it("tham gia mà không đúng câu nào vẫn có thưởng nhỏ", () => {
    expect(computeXpGain({ score: 0, total: 20, passed: false, bestStreak: 0 })).toBe(10);
  });

  it("làm càng đúng càng nhiều kinh nghiệm", () => {
    const low = computeXpGain({ score: 5, total: 20, passed: false, bestStreak: 2 });
    const mid = computeXpGain({ score: 12, total: 20, passed: true, bestStreak: 5 });
    const high = computeXpGain({ score: 20, total: 20, passed: true, bestStreak: 20 });
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it("điểm tuyệt đối nhận đủ mọi mốc thưởng", () => {
    // 10 + 100 + 60 + 40 + 20 + 30 + 50
    expect(computeXpGain({ score: 20, total: 20, passed: true, bestStreak: 20 })).toBe(310);
  });

  it("cải thiện so với lượt trước được cộng thêm", () => {
    const base = computeXpGain({ score: 10, total: 20, passed: true, bestStreak: 3 });
    const better = computeXpGain({ score: 10, total: 20, passed: true, bestStreak: 3, improved: true });
    expect(better - base).toBe(25);
  });

  it("không tính điểm vượt quá tổng số câu", () => {
    expect(computeXpGain({ score: 99, total: 10, passed: true, bestStreak: 0 })).toBe(
      computeXpGain({ score: 10, total: 10, passed: true, bestStreak: 0 }),
    );
  });
});

describe("levelTitle", () => {
  it("trả danh hiệu theo cấp", () => {
    expect(levelTitle(1)).toBe("Tân binh sân đỗ");
    expect(levelTitle(3)).toBe("Nhân viên chăm chỉ");
    expect(levelTitle(5)).toBe("Học viên xuất sắc");
    expect(levelTitle(10)).toBe("Huyền thoại bầu trời");
    expect(levelTitle(30)).toBe("Huyền thoại bầu trời");
  });
});
