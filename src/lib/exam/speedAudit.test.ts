import { describe, expect, it } from "vitest";

import { auditSpeed, collectScriptSignals } from "@/lib/exam/speedAudit";

describe("auditSpeed", () => {
  it("không phạt bài ít câu dù làm rất nhanh", () => {
    expect(auditSpeed({ answered: 3, correct: 3, seconds: 5, signals: [] }).weight).toBe(0);
  });

  it("không phạt tốc độ hợp lý", () => {
    expect(auditSpeed({ answered: 20, correct: 20, seconds: 300, signals: [] }).weight).toBe(0);
  });

  it("chỉ gắn nhãn, không phạt khi nhanh tới mức bất thường", () => {
    const r = auditSpeed({ answered: 20, correct: 12, seconds: 30, signals: [] });
    expect(r.reason).toBe("very_fast");
    expect(r.weight).toBe(0);
  });

  it("20/20 trong 33 giây: gắn nhãn nhưng KHÔNG trừ điểm liêm chính", () => {
    const r = auditSpeed({ answered: 20, correct: 20, seconds: 33, signals: ["console_bait"] });
    expect(r.weight).toBe(0);
  });

  it("nhanh + đúng gần tuyệt đối chỉ được gắn nhãn", () => {
    const r = auditSpeed({ answered: 20, correct: 19, seconds: 70, signals: [] });
    expect(r.reason).toBe("fast_perfect");
    expect(r.weight).toBe(0);
  });

  it("nhanh + tín hiệu script cũng chỉ gắn nhãn để rà soát", () => {
    const r = auditSpeed({ answered: 20, correct: 12, seconds: 70, signals: ["unsigned"] });
    expect(r.reason).toBe("fast_with_script_signal");
    expect(r.weight).toBe(0);
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
