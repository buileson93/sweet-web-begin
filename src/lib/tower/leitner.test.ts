import { describe, expect, it } from "vitest";

import { intervalDays, isDue, nextBox, pickDueQueue, scheduleCard } from "./leitner";

const NOW = new Date("2026-08-01T00:00:00.000Z");
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000).toISOString();

describe("nextBox", () => {
  it("đúng thì lên hộp, kịch trần ở hộp 5", () => {
    expect(nextBox(1, true)).toBe(2);
    expect(nextBox(4, true)).toBe(5);
    expect(nextBox(5, true)).toBe(5);
  });

  it("sai thì về hộp 1", () => {
    expect(nextBox(5, false)).toBe(1);
    expect(nextBox(1, false)).toBe(1);
  });
});

describe("intervalDays", () => {
  it("theo bậc 1/3/7/16/35", () => {
    expect([1, 2, 3, 4, 5].map(intervalDays)).toEqual([1, 3, 7, 16, 35]);
  });
});

describe("scheduleCard", () => {
  it("trả lời đúng ở hộp 2 thì hẹn 7 ngày sau", () => {
    const r = scheduleCard({ box: 2, lapses: 0 }, true, NOW);
    expect(r.box).toBe(3);
    expect(r.nextDueAt).toBe(days(7));
    expect(r.lapses).toBe(0);
  });

  it("trả lời sai thì về hộp 1, hẹn 1 ngày và tăng số lần quên", () => {
    const r = scheduleCard({ box: 4, lapses: 2 }, false, NOW);
    expect(r.box).toBe(1);
    expect(r.nextDueAt).toBe(days(1));
    expect(r.lapses).toBe(3);
  });
});

describe("isDue", () => {
  it("đúng biên giới: bằng now là đến hạn", () => {
    expect(isDue({ nextDueAt: NOW.toISOString() }, NOW)).toBe(true);
    expect(isDue({ nextDueAt: days(0.001) }, NOW)).toBe(false);
  });
});

describe("pickDueQueue", () => {
  const card = (id: string, tag: string, d: number) => ({
    questionId: id,
    box: 1,
    lapses: 0,
    tag,
    nextDueAt: days(d),
  });

  it("chỉ lấy thẻ đến hạn và tôn trọng giới hạn", () => {
    const q = pickDueQueue([card("a", "x", -1), card("b", "y", 5)], 10, NOW);
    expect(q.map((c) => c.questionId)).toEqual(["a"]);
  });

  it("không để quá 2 câu liên tiếp cùng chủ đề", () => {
    const q = pickDueQueue(
      [card("a", "x", -5), card("b", "x", -4), card("c", "x", -3), card("d", "y", -1)],
      4,
      NOW,
    );
    expect(q.map((c) => c.tag)).toEqual(["x", "x", "y", "x"]);
  });

  it("chỉ có một chủ đề thì vẫn trả đủ, không kẹt vòng lặp", () => {
    const q = pickDueQueue([card("a", "x", -3), card("b", "x", -2), card("c", "x", -1)], 3, NOW);
    expect(q).toHaveLength(3);
  });
});
