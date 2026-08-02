import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().max(200),
  recoveryKey: z.string().min(4).max(64),
  newPassword: z.string().min(8).max(72),
});

/** Đặt lại mật khẩu quản trị bằng khoá khôi phục nội bộ. */
export const resetAdminPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { resetAdminPasswordWithKey } = await import("@/lib/adminRecovery.server");
    return resetAdminPasswordWithKey(data);
  });
