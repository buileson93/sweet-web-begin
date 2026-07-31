import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { PlayerProfile } from "@/lib/player.server";

export type { PlayerProfile };

/** Hồ sơ kinh nghiệm/cấp độ của một nhân viên. */
export const getPlayerProfile = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ employeeId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PlayerProfile> => {
    const { readPlayerProfile } = await import("@/lib/player.server");
    return readPlayerProfile(data.employeeId);
  });

/** Bảng xếp hạng kinh nghiệm (công khai, không kèm thông tin nhạy cảm). */
export const getTopPlayers = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ limit: z.number().int().min(1).max(100).default(20) }).parse(input))
  .handler(async ({ data }): Promise<PlayerProfile[]> => {
    const { readTopPlayers } = await import("@/lib/player.server");
    return readTopPlayers(data.limit);
  });

const avatarSchema = z.object({
  name: z.string().min(2).max(120),
  credential: z.string().min(4).max(20),
  avatarUrl: z.string().url().max(500).refine((u) => u.startsWith("https://"), "Đường dẫn phải là https"),
  avatarImage: z.string().max(500).default(""),
});

/**
 * Lưu ảnh đại diện 3D. Phải xác thực lại nhân viên bằng danh bạ để
 * không ai đổi được avatar của người khác.
 */
export const savePlayerAvatar = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => avatarSchema.parse(input))
  .handler(async ({ data }): Promise<PlayerProfile> => {
    const { verifyEmployee } = await import("@/lib/employees.server");
    const employee = await verifyEmployee({ name: data.name, credential: data.credential });
    if (!employee?.id) throw new Error("Không xác thực được nhân viên.");

    const { writePlayerAvatar } = await import("@/lib/player.server");
    return writePlayerAvatar({
      employeeId: employee.id,
      avatarUrl: data.avatarUrl,
      avatarImage: data.avatarImage,
    });
  });
