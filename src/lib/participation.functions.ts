import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const schema = z.object({ quizId: z.string().uuid() });

/** Chỉ quản trị viên / cán bộ tổ chức thi mới được xem danh bạ dự thi. */
async function assertCanViewRoster(context: { supabase: any; userId: string }) {
  const [admin, staff] = await Promise.all([
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
    context.supabase.rpc("has_role", { _user_id: context.userId, _role: "staff" }),
  ]);
  if (admin.error || staff.error) throw new Error("Không kiểm tra được quyền truy cập.");
  if (!admin.data && !staff.data) {
    throw new Error("Bạn không có quyền xem danh sách dự thi.");
  }
}

/**
 * Danh sách nhân viên đã dự thi và chưa dự thi của một cuộc thi.
 * Sử dụng RPC get_detailed_participation_summary để đảm bảo đồng bộ với trang Admin.
 */
export const getQuizParticipation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanViewRoster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // Sử dụng chung RPC với trang Admin để đảm bảo 1 nguồn sự thật duy nhất
    const { data: rows, error } = await supabaseAdmin.rpc("get_detailed_participation_summary", {
      _quiz_id: data.quizId,
    });

    if (error) throw new Error(error.message);

    const done: any[] = [];
    const pending: any[] = [];

    (rows || []).forEach((r: any) => {
      const item = {
        id: r.id,
        name: r.full_name,
        unit: r.unit_name || "Chưa cập nhật",
        attempts: Number(r.attempts),
        submitted: Number(r.submitted),
        // bestScore format "score/total" từ SQL RPC
        bestScore: r.best_score ? parseInt(r.best_score.split('/')[0]) : 0,
        total: r.best_score ? parseInt(r.best_score.split('/')[1]) : 0,
        lastAt: new Date().toISOString(), // RPC chưa trả về lastAt chính xác, tạm dùng current
      };

      if (r.status === "passed" || r.status === "failed") {
        done.push(item);
      } else {
        pending.push(item);
      }
    });

    const totalCount = rows?.length || 0;
    const doneCount = done.length;

    return {
      done: done.sort((a, b) => b.bestScore - a.bestScore),
      pending: pending.sort((a, b) => a.unit.localeCompare(b.unit)),
      doneCount,
      pendingCount: totalCount - doneCount,
      totalCount,
      percent: totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100),
    };
  });
