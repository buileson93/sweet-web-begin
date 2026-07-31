import { describe, expect, it } from "vitest";

import { DEFAULT_EXAM_SETTINGS, EXAM_CURRENT_KEY, examKey, mergeAnswers, restoreExamSession } from "@/lib/examSession";

function makeStorage(entries: Record<string, string>) {
  return {
    getItem: (k: string) => entries[k] ?? null,
    removeItem: (k: string) => {
      delete entries[k];
    },
  };
}

const baseSession = {
  sessionId: "s1",
  submitToken: "t1",
  attempt: 1,
  bestPercent: 0,
  candidateName: "Nguyễn Văn A",
  unit: "Đơn vị 1",
  quizTitle: "Đề thử",
  durationMinutes: 20,
  expiresAt: new Date().toISOString(),
  serverNow: new Date().toISOString(),
  maxPoints: 10,
  questions: [{ id: "q1" }],
};

describe("restoreExamSession", () => {
  it("trả về null khi không có storage", () => {
    expect(restoreExamSession(null)).toBeNull();
    expect(restoreExamSession(undefined)).toBeNull();
  });

  it("trả về null khi sessionStorage trống", () => {
    expect(restoreExamSession(makeStorage({}))).toBeNull();
  });

  it("trả về null khi có con trỏ phiên nhưng thiếu dữ liệu phiên", () => {
    expect(restoreExamSession(makeStorage({ [EXAM_CURRENT_KEY]: "s1" }))).toBeNull();
  });

  it("trả về null khi JSON hỏng", () => {
    expect(restoreExamSession(makeStorage({ [EXAM_CURRENT_KEY]: "s1", [examKey("s1")]: "{oops" }))).toBeNull();
  });

  it("trả về null khi phiên không có câu hỏi", () => {
    const raw = JSON.stringify({ ...baseSession, questions: [] });
    expect(restoreExamSession(makeStorage({ [EXAM_CURRENT_KEY]: "s1", [examKey("s1")]: raw }))).toBeNull();
  });

  it("điền settings mặc định khi phiên cũ thiếu trường settings", () => {
    const raw = JSON.stringify(baseSession);
    const s = restoreExamSession(makeStorage({ [EXAM_CURRENT_KEY]: "s1", [examKey("s1")]: raw }));
    expect(s).not.toBeNull();
    expect(s!.settings).toEqual(DEFAULT_EXAM_SETTINGS);
    expect(s!.settings.allowFiftyFifty).toBe(false);
  });

  it("bổ sung các trường settings còn thiếu và giữ giá trị đã có", () => {
    const raw = JSON.stringify({ ...baseSession, settings: { instantFeedback: true, passPercent: 80 } });
    const s = restoreExamSession(makeStorage({ [EXAM_CURRENT_KEY]: "s1", [examKey("s1")]: raw }));
    expect(s!.settings.instantFeedback).toBe(true);
    expect(s!.settings.passPercent).toBe(80);
    expect(s!.settings.showQuestionMap).toBe(true);
    expect(s!.settings.allowSkip).toBe(false);
  });

  it("không ném lỗi khi storage bị chặn", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {},
    };
    expect(restoreExamSession(blocked)).toBeNull();
  });
});

describe("mergeAnswers", () => {
  it("ưu tiên bản có seq lớn hơn khi trùng câu (server mới hơn)", () => {
    const r = mergeAnswers({ "0": 1 }, { "0": 2 }, 3, 5);
    expect(r.answers).toEqual({ "0": 2 });
    expect(r.seq).toBe(5);
  });

  it("ưu tiên bản local khi localSeq lớn hơn", () => {
    const r = mergeAnswers({ "0": 1 }, { "0": 2 }, 7, 5);
    expect(r.answers).toEqual({ "0": 1 });
    expect(r.seq).toBe(7);
  });

  it("hợp nhất các câu chỉ có ở một bên bất kể seq", () => {
    const r = mergeAnswers({ "1": "a" }, { "2": [0, 1] }, 1, 9);
    expect(r.answers).toEqual({ "1": "a", "2": [0, 1] });
    expect(r.seq).toBe(9);
  });

  it("seq bằng nhau thì giữ bản local (máy đang thi là nguồn mới nhất)", () => {
    const r = mergeAnswers({ "0": 1 }, { "0": 2 }, 4, 4);
    expect(r.answers).toEqual({ "0": 1 });
    expect(r.seq).toBe(4);
  });

  it("xử lý an toàn khi một bên rỗng hoặc thiếu", () => {
    expect(mergeAnswers({}, {}, 0, 0)).toEqual({ answers: {}, seq: 0 });
    expect(mergeAnswers(null as never, { "0": 1 }, 0, 2).answers).toEqual({ "0": 1 });
  });
});
