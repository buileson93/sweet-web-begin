import { describe, expect, it } from "vitest";

import {
  busyInfo,
  busyText,
  encodeBusyError,
  freeToLeave,
  parseBusyError,
  planInviteRoom,
  rankedLabel,
  type ActiveSeat,
} from "./rooms";

const waitingSeat: NonNullable<ActiveSeat> = { duelId: "d-1", status: "waiting", seats: 1 };

describe("planInviteRoom — tạo link so tài", () => {
  it("chưa ở phòng nào thì tạo phòng mới", () => {
    expect(planInviteRoom(null)).toEqual({ action: "create" });
  });

  it("đang có phòng chờ trống thì DÙNG LẠI, không báo lỗi bận", () => {
    expect(planInviteRoom(waitingSeat)).toEqual({ action: "reuse", duelId: "d-1" });
  });

  it("bấm tạo link nhiều lần vẫn trả về đúng một phòng", () => {
    const a = planInviteRoom(waitingSeat);
    const b = planInviteRoom(waitingSeat);
    expect(a).toEqual(b);
  });

  it("phòng chờ đã đủ hai người thì chặn kèm hướng dẫn", () => {
    const plan = planInviteRoom({ ...waitingSeat, seats: 2 });
    expect(plan.action).toBe("blocked");
    if (plan.action !== "blocked") throw new Error("sai nhánh");
    expect(plan.reason).toBe("room_full");
    expect(plan.busy.duelId).toBe("d-1");
    expect(plan.busy.message).toContain("đủ hai người");
  });

  it("đang đếm ngược hoặc đang đấu thì chặn tạo link mới", () => {
    for (const status of ["countdown", "playing"] as const) {
      const plan = planInviteRoom({ ...waitingSeat, status });
      expect(plan.action).toBe("blocked");
      if (plan.action !== "blocked") throw new Error("sai nhánh");
      expect(plan.reason).toBe("in_battle");
      expect(plan.busy.status).toBe(status);
    }
  });
});

describe("gợi ý rời trận khi đang bận", () => {
  it("phòng chờ và đếm ngược được rời tự do, đang đấu thì không", () => {
    expect(freeToLeave("waiting")).toBe(true);
    expect(freeToLeave("countdown")).toBe(true);
    expect(freeToLeave("playing")).toBe(false);
  });

  it("thông báo nêu rõ hệ quả khi rời giữa trận", () => {
    expect(busyInfo({ ...waitingSeat, status: "playing" }).message).toContain("xử thua");
    expect(busyInfo(waitingSeat).message).toContain("rời phòng đó ngay");
  });

  it("mã hoá rồi bóc tách lại giữ nguyên mã trận và trạng thái", () => {
    const encoded = encodeBusyError({ ...waitingSeat, status: "playing" });
    const parsed = parseBusyError(encoded);
    expect(parsed).toMatchObject({ duelId: "d-1", status: "playing", freeToLeave: false });
    expect(parsed?.message).toContain("thi đấu");
  });

  it("lỗi thường không bị nhận nhầm là lỗi bận", () => {
    expect(parseBusyError("Ngân hàng câu hỏi không đủ")).toBeNull();
    expect(parseBusyError("ARENA_BUSY:d-1:hong|x")).toBeNull();
    expect(busyText("Ngân hàng câu hỏi không đủ")).toBe("Ngân hàng câu hỏi không đủ");
  });

  it("busyText luôn bỏ phần kỹ thuật trước khi hiện cho người dùng", () => {
    const text = busyText(encodeBusyError(waitingSeat));
    expect(text.startsWith("ARENA_BUSY")).toBe(false);
    expect(text).toContain("phòng chờ khác");
  });
});

describe("rankedLabel — vì sao thắng mà Elo không đổi", () => {
  it("trận tính Elo có nhãn rõ ràng", () => {
    expect(rankedLabel(true, "").label).toBe("Tính Elo");
  });

  it("trận không tính Elo nêu đúng lý do từ server", () => {
    const r = rankedLabel(false, "Hai đấu thủ dùng chung một thiết bị nên trận này chỉ để giải trí.");
    expect(r.label).toBe("Không tính Elo");
    expect(r.reason).toContain("chung một thiết bị");
  });

  it("thiếu lý do vẫn có câu giải thích mặc định", () => {
    expect(rankedLabel(false, "   ").reason).toContain("giao hữu");
  });
});
