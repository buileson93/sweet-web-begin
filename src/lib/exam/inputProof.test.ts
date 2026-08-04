import { describe, expect, it } from "vitest";

import { buildProof, createInputProofTracker, TRUSTED_MAX_AGE_MS } from "@/lib/exam/inputProof";

describe("buildProof", () => {
  it("không có thao tác thật nào => không tin cậy", () => {
    expect(buildProof(null, 1000)).toMatchObject({ trusted: false, via: "none" });
  });

  it("thao tác thật vừa xảy ra => tin cậy", () => {
    expect(buildProof({ at: 900, via: "pointer" }, 1000)).toMatchObject({
      trusted: true,
      via: "pointer",
      ageMs: 100,
    });
  });

  it("thao tác thật quá cũ => không tin cậy", () => {
    const proof = buildProof({ at: 0, via: "key" }, TRUSTED_MAX_AGE_MS + 1);
    expect(proof.trusted).toBe(false);
  });
});

describe("createInputProofTracker", () => {
  it("bỏ qua sự kiện giả do script bắn ra (isTrusted = false)", () => {
    const tracker = createInputProofTracker();
    tracker.note({ isTrusted: false, type: "pointerdown" }, 100);
    tracker.mark(0, 150);
    expect(tracker.collect(["0"])["0"]!.trusted).toBe(false);
  });

  it("chấp nhận thao tác thật của người dùng", () => {
    const tracker = createInputProofTracker();
    tracker.note({ isTrusted: true, type: "keydown" }, 100);
    tracker.mark(2, 300);
    const proofs = tracker.collect(["2"]);
    expect(proofs["2"]).toMatchObject({ trusted: true, via: "key" });
  });

  it("câu chưa từng được đánh dấu => coi như không có bằng chứng", () => {
    const tracker = createInputProofTracker();
    expect(tracker.collect(["7"])["7"]!.trusted).toBe(false);
  });
});
