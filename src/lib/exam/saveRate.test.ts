import { describe, expect, it } from "vitest";

import {
  MAX_BEACONS_PER_SESSION,
  MAX_SAVES_PER_SESSION,
  MIN_GAP_BEACON_MS,
  advanceSaveRate,
  checkSaveRate,
  readSaveRate,
  withSaveRate,
} from "@/lib/exam/saveRate";

describe("saveRate", () => {
  it("chặn gói dồn dập nhưng cho qua nhịp bình thường", () => {
    const state = { at: 1_000, count: 3 };
    expect(checkSaveRate({ state, nowMs: 1_500, source: "beacon" })).toEqual({
      ok: false,
      reason: "too_fast",
    });
    expect(checkSaveRate({ state, nowMs: 1_000 + MIN_GAP_BEACON_MS, source: "beacon" }).ok).toBe(true);
    expect(checkSaveRate({ state, nowMs: 13_000, source: "rpc" }).ok).toBe(true);
  });

  it("chặn khi vượt trần số gói của phiên", () => {
    expect(
      checkSaveRate({ state: { count: MAX_SAVES_PER_SESSION }, nowMs: 9e9, source: "rpc" }),
    ).toEqual({ ok: false, reason: "too_many" });
    expect(
      checkSaveRate({ state: { beacons: MAX_BEACONS_PER_SESSION }, nowMs: 9e9, source: "beacon" }),
    ).toEqual({ ok: false, reason: "too_many_beacons" });
  });

  it("chặn phát lại đúng chữ ký cũ", () => {
    const signature = "abcdefghijklmnopqrstuvwxyz0123456789";
    const next = advanceSaveRate({ state: {}, nowMs: 1_000, source: "rpc", signature });
    expect(checkSaveRate({ state: next, nowMs: 9e9, source: "rpc", signature })).toEqual({
      ok: false,
      reason: "replay",
    });
    expect(checkSaveRate({ state: next, nowMs: 9e9, source: "rpc", signature: "khac" + signature }).ok).toBe(
      true,
    );
  });

  it("đọc/ghi trạng thái không làm mất khoá khác trong helpers", () => {
    const helpers = withSaveRate({ checked: [1] }, { at: 5, count: 1 });
    expect(helpers['checked']).toEqual([1]);
    expect(readSaveRate(helpers).count).toBe(1);
  });
});
