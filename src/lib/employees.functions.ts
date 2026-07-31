import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const verifySchema = z.object({
  name: z.string().min(2).max(120),
  credential: z.string().min(4).max(20),
  extraCredential: z.string().max(20).optional(),
});

/** Xác thực nhanh thí sinh dựa trên danh bạ nhân viên (chạy hoàn toàn phía máy chủ). */
export const verifyEmployeeFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const { verifyEmployee } = await import("@/lib/employees.server");
    return verifyEmployee(data);
  });
