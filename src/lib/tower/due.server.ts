import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyEmployee } from "@/lib/employees.server";

export type DueSummary = {
  candidateName: string;
  /** Số thẻ đã đến hạn ôn hôm nay. */
  due: number;
  /** Tổng số thẻ đã từng gặp (tạo lười). */
  total: number;
};

/**
 * Số thẻ đến hạn — 2 truy vấn count có chỉ mục (employee_id, next_due_at).
 * Không job nền: "đến hạn" tính lười theo now().
 */
export async function getDueSummary(input: {
  name: string;
  credential: string;
  extraCredential?: string;
}): Promise<DueSummary> {
  const employee = await verifyEmployee(input);

  const [{ count: due }, { count: total }] = await Promise.all([
    supabaseAdmin
      .from("learner_cards")
      .select("question_id", { count: "exact", head: true })
      .eq("employee_id", employee.id)
      .lte("next_due_at", new Date().toISOString()),
    supabaseAdmin
      .from("learner_cards")
      .select("question_id", { count: "exact", head: true })
      .eq("employee_id", employee.id),
  ]);

  return {
    candidateName: employee.fullName,
    due: due ?? 0,
    total: total ?? 0,
  };
}

/** Cập nhật lô thẻ ghi nhớ sau một chặng ôn (một lượt đi về). */
export async function applyReviewBatch(
  employeeId: string,
  items: { questionId: string; correct: boolean }[],
): Promise<void> {
  if (!employeeId || !items.length) return;
  await supabaseAdmin
    .rpc("tower_apply_reviews" as never, {
      p_employee_id: employeeId,
      p_items: items,
    } as never)
    .then(
      () => undefined,
      () => undefined,
    );
}
