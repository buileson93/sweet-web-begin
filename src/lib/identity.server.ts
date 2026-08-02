/**
 * Bổ sung định danh người dùng cho các bảng thống kê.
 *
 * Máy khách chỉ gửi MÃ nhân viên; họ tên và đơn vị luôn được tra lại từ danh bạ
 * để không ai giả mạo được tên người khác trong báo cáo quản trị.
 */
export type EmployeeStamp = {
  employee_id: string | null;
  employee_name: string;
  employee_unit: string;
};

const EMPTY: EmployeeStamp = { employee_id: null, employee_name: "", employee_unit: "" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function resolveEmployeeStamp(employeeId: unknown): Promise<EmployeeStamp> {
  const id = String(employeeId ?? "").trim();
  if (!UUID.test(id)) return EMPTY;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("employees")
    .select("id, full_name, unit_name")
    .eq("id", id)
    .maybeSingle();
  if (!data) return EMPTY;

  return {
    employee_id: data.id,
    employee_name: (data.full_name ?? "").slice(0, 120),
    employee_unit: (data.unit_name ?? "").slice(0, 120),
  };
}
