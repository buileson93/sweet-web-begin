/**
 * Điểm gọi từ trình duyệt cho Đấu trường. Mọi hàm đều xác minh vé phiên
 * trước khi chạm dữ liệu; máy chủ tự đo thời gian và tự chấm điểm.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const token = z.string().min(10).max(400);

const answerValue = z.union([
  z.number().int().min(0).max(50),
  z.array(z.number().int().min(0).max(50)).max(20),
  z.string().max(200),
  z.record(z.string(), z.number().int().min(0).max(50)),
]);

async function auth(tokenValue: string) {
  const { verifyArenaToken } = await import("@/lib/arena/token.server");
  return verifyArenaToken(tokenValue);
}

export const arenaSignIn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(2).max(120),
        credential: z.string().min(4).max(20),
        extraCredential: z.string().max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { arenaLogin } = await import("@/lib/arena/lobby.server");
    return arenaLogin(data);
  });

export const arenaHome = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { getProfile, getArenaLeaderboard, getInvites, getDuelHistory } = await import(
      "@/lib/arena/lobby.server"
    );
    const [profile, leaderboard, invites, history] = await Promise.all([
      getProfile(employeeId),
      getArenaLeaderboard(10),
      getInvites(employeeId),
      getDuelHistory(employeeId),
    ]);
    return { profile, leaderboard, invites, history };
  });

export const arenaQuickMatch = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token,
        waitedSeconds: z.number().int().min(0).max(600).optional(),
        deviceHash: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { quickMatch } = await import("@/lib/arena/duel.server");
    return quickMatch({ employeeId, waitedSeconds: data.waitedSeconds, deviceHash: data.deviceHash });
  });

export const arenaSearchOpponents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token, query: z.string().min(2).max(60) }).parse(input),
  )
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { searchOpponents } = await import("@/lib/arena/lobby.server");
    return searchOpponents({ employeeId, query: data.query });
  });

export const arenaInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ token, toEmployeeId: z.string().uuid(), deviceHash: z.string().max(80).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { inviteToDuel } = await import("@/lib/arena/duel.server");
    return inviteToDuel({ employeeId, toEmployeeId: data.toEmployeeId, deviceHash: data.deviceHash });
  });

export const arenaRespondInvite = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token,
        inviteId: z.string().uuid(),
        accept: z.boolean(),
        deviceHash: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { respondInvite } = await import("@/lib/arena/duel.server");
    return respondInvite({
      employeeId,
      inviteId: data.inviteId,
      accept: data.accept,
      deviceHash: data.deviceHash,
    });
  });

export const arenaReady = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token, duelId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { setReady } = await import("@/lib/arena/duel.server");
    return setReady({ employeeId, duelId: data.duelId });
  });

export const arenaAnswer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token,
        duelId: z.string().uuid(),
        roundIndex: z.number().int().min(0).max(50),
        value: answerValue,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { answerRound } = await import("@/lib/arena/duel.server");
    return answerRound({
      employeeId,
      duelId: data.duelId,
      roundIndex: data.roundIndex,
      value: data.value,
    });
  });

export const arenaLeave = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token, duelId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { leaveDuel } = await import("@/lib/arena/duel.server");
    return leaveDuel({ employeeId, duelId: data.duelId });
  });

export const arenaState = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({ token, duelId: z.string().uuid(), sinceVersion: z.number().int().min(0).optional() })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { getDuelState } = await import("@/lib/arena/duel.server");
    const state = await getDuelState({ employeeId, duelId: data.duelId });
    // Tiết kiệm băng thông khi hỏi lại liên tục: chưa đổi thì báo unchanged.
    if (data.sinceVersion !== undefined && state.version === data.sinceVersion)
      return { unchanged: true as const, version: state.version };
    return { unchanged: false as const, state };
  });

export const arenaSetAvatar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token, avatar: z.string().max(8) }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { setArenaAvatar } = await import("@/lib/arena/lobby.server");
    return setArenaAvatar(employeeId, data.avatar);
  });

/** Danh sách rút gọn để hiển thị người đang online (Presence chỉ giữ thông tin công khai). */
export const arenaLeaderboardPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { getArenaLeaderboard } = await import("@/lib/arena/lobby.server");
  return getArenaLeaderboard(100);
});

/** Nhịp tim trực tuyến + danh sách đồng nghiệp đang online + ván so tài đang dang dở. */
export const arenaPresence = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { touchPresence, listOnlinePlayers, getActiveDuel } = await import(
      "@/lib/arena/presence.server"
    );
    await touchPresence(employeeId);
    const [online, active] = await Promise.all([
      listOnlinePlayers({ employeeId }),
      getActiveDuel(employeeId),
    ]);
    return { online, active };
  });

/** Kết thúc dứt điểm ván so tài đang dang dở (thoát trạng thái kẹt). */
export const arenaEndActive = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { endActiveDuel } = await import("@/lib/arena/presence.server");
    return endActiveDuel(employeeId);
  });

/** Thống kê cá nhân: biến động Elo, chuỗi thắng thua, lịch sử so tài. */
export const arenaMyStats = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token }).parse(input))
  .handler(async ({ data }) => {
    const employeeId = await auth(data.token);
    const { getPlayerStats } = await import("@/lib/arena/stats.server");
    return getPlayerStats(employeeId);
  });

/** Xem lại diễn biến một ván so tài đã kết thúc. */
export const arenaReplay = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ token, duelId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    await auth(data.token);
    const { getDuelReplay } = await import("@/lib/arena/stats.server");
    return getDuelReplay(data.duelId);
  });
