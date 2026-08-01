import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const credentialSchema = z.object({
  name: z.string().min(2).max(120),
  credential: z.string().min(4).max(20),
  extraCredential: z.string().max(20).optional(),
});

/** Số thẻ đến hạn ôn của một nhân viên (sau khi xác thực danh tính). */
export const getDueCount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => credentialSchema.parse(input))
  .handler(async ({ data }) => {
    const { getDueSummary } = await import("@/lib/tower/due.server");
    return getDueSummary(data);
  });
