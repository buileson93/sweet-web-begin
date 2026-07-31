import { describe, expect, it } from "vitest";
import { buildReplaySummary, type SummaryRound } from "./replaySummary";

const line = (o: Partial<SummaryRound["lines"][number]> & { employeeId: string }) => ({
  displayName: o.employeeId === "a" ? "An" : "Bình",
  answered: true,
  isCorrect: false,
  damage: 0,
  firstCorrect: false,
  skill: "",
  hpAfter: 100,
  ...o,
});

describe("buildReplaySummary", () => {
  it("trả về rỗng khi không có câu nào", () => {
    expect(buildReplaySummary([])).toEqual([]);
  });

  it("nêu đòn nặng nhất trận", () => {
    const rounds: SummaryRound[] = [
      { index: 0, lines: [line({ employeeId: "a", damage: 5 }), line({ employeeId: "b" })] },
      { index: 1, lines: [line({ employeeId: "a", damage: 14 }), line({ employeeId: "b" })] },
    ];
    const hit = buildReplaySummary(rounds).find((m) => m.kind === "big_hit");
    expect(hit?.roundIndex).toBe(1);
    expect(hit?.text).toContain("14");
  });

  it("ghi nhận kỹ năng đã dùng", () => {
    const rounds: SummaryRound[] = [
      { index: 0, lines: [line({ employeeId: "a", skill: "cong_pha" }), line({ employeeId: "b" })] },
    ];
    const s = buildReplaySummary(rounds).find((m) => m.kind === "skill");
    expect(s?.text).toContain("An");
  });

  it("chỉ nêu chuỗi từ 3 câu trở lên", () => {
    const mk = (i: number, hit: boolean): SummaryRound => ({
      index: i,
      lines: [line({ employeeId: "a", firstCorrect: hit }), line({ employeeId: "b" })],
    });
    expect(buildReplaySummary([mk(0, true), mk(1, true)]).some((m) => m.kind === "combo")).toBe(
      false,
    );
    const combo = buildReplaySummary([mk(0, true), mk(1, true), mk(2, true)]).find(
      (m) => m.kind === "combo",
    );
    expect(combo?.text).toContain("3");
  });

  it("nêu câu hết giờ và pha hạ gục", () => {
    const rounds: SummaryRound[] = [
      {
        index: 0,
        lines: [line({ employeeId: "a", answered: false }), line({ employeeId: "b", answered: false })],
      },
      { index: 1, lines: [line({ employeeId: "a" }), line({ employeeId: "b", hpAfter: 0 })] },
    ];
    const kinds = buildReplaySummary(rounds).map((m) => m.kind);
    expect(kinds).toContain("timeout");
    expect(kinds).toContain("ko");
  });

  it("sắp xếp các mốc theo thứ tự câu", () => {
    const rounds: SummaryRound[] = [
      { index: 0, lines: [line({ employeeId: "a", damage: 3 }), line({ employeeId: "b" })] },
      { index: 2, lines: [line({ employeeId: "a", skill: "khien_thep" }), line({ employeeId: "b" })] },
    ];
    const idx = buildReplaySummary(rounds).map((m) => m.roundIndex);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});
