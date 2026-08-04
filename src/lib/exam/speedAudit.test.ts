import { describe, expect, it } from "vitest";

import { auditSpeed, collectScriptSignals } from "@/lib/exam/speedAudit";

describe("auditSpeed", () => {
  it("không phạt bài ít câu dù làm rất nhanh", () => {
    expect(auditSpeed({ answered: 3, correct: 3, seconds: 5, signals: [] }).weight).toBe(0);
  });

  it("không phạt tốc độ hợp lý", () => {
    expect(auditSpeed({ answered: 20, correct: 20, seconds: 300, signals: [] }).weight).toBe(0);
  });

  it("phạt nặng khi nhanh tới mức bất khả thi", () => {
    const r = auditSpeed({ answered: 20, correct: 12, seconds: 30, signals: [] });
    expect(r.reason).toBe("impossible_speed");
    expect(r.weight).toBe(8);
  });

  it("phạt trường hợp 20/20 trong 33 giây (ca Phan Thành An)", () => {
    const r = auditSpeed({ answered: 20, correct: 20, seconds: 33, signals: ["console_bait"] });
    expect(r.weight).toBeGreaterThanOrEqual(6);
  });

  it("nhanh + đúng gần tuyệt đối vẫn bị phạt dù không có tín hiệu script", () => {
    const r = auditSpeed({ answered: 20, correct: 19, seconds: 70, signals: [] });
    expect(r.reason).toBe("fast_perfect");
    expect(r.weight).toBe(6);
  });

  it("nhanh + có tín hiệu script thì phạt đủ ngưỡng huỷ bài", () => {
    const r = auditSpeed({ answered: 20, correct: 12, seconds: 70, signals: ["unsigned"] });
    expect(r.reason).toBe("fast_with_script_signal");
    expect(r.weight).toBe(6);
  });

  it("chỉ nhanh, điểm thấp, không tín hiệu: chỉ ghi log", () => {
    const r = auditSpeed({ answered: 20, correct: 10, seconds: 70, signals: [] });
    expect(r.reason).toBe("fast_only");
    expect(r.weight).toBe(0);
  });
});

describe("collectScriptSignals", () => {
  it("gom đúng các tín hiệu trọng số 0", () => {
    const signals = collectScriptSignals([
      { kind: "devtools_open", detail: { via: "console_bait" } },
      { kind: "script_suspect", detail: { reason: "autosave_rate:too_fast" } },
      { kind: "script_suspect", detail: { reason: "unsigned_check:no_key" } },
      { kind: "tab_hidden", detail: { hiddenMs: 900 } },
    ]);
    expect(signals.sort()).toEqual(["autosave_rate", "console_bait", "unsigned"]);
  });

  it("không sinh tín hiệu từ phiên sạch", () => {
    expect(collectScriptSignals([{ kind: "reconnect" }])).toEqual([]);
  });
});
