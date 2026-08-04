import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { IdCard, Loader2, Search, Trash2, UserRoundCheck, UserRoundX } from "lucide-react";
import { toast } from "sonner";

import { CsvImportDialog } from "@/components/admin/CsvImportDialog";
import { EmployeeFormDialog } from "@/components/admin/EmployeeFormDialog";
import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { normalizeKey } from "@/lib/csv";

type EmployeeRow = {
  id: string;
  full_name: string;
  name_key: string;
  position: string | null;
  unit_name: string | null;
  birth_date: string | null;
  phone_last4: string | null;
  is_active: boolean;
};

type ImportRow = {
  full_name: string;
  name_key: string;
  position: string | null;
  unit_name: string | null;
  birth_date: string | null;
  phone: string | null;
  phone_last4: string | null;
};

function toIsoDate(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const m = v.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
}

export function EmployeeManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const employeesQuery = useQuery({
    queryKey: ["admin-employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, full_name, name_key, position, unit_name, birth_date, phone_last4, is_active")
        .order("full_name")
        .limit(2000);
      if (error) throw error;
      return data as EmployeeRow[];
    },
  });

  const employees = employeesQuery.data ?? [];
  const existingKeys = useMemo(() => new Set(employees.map((e) => `${e.name_key}|${e.phone_last4 ?? ""}`)), [employees]);

  const filtered = useMemo(() => {
    const key = normalizeKey(search);
    if (!key) return employees.slice(0, 200);
    return employees
      .filter(
        (e) =>
          e.name_key.includes(key) ||
          normalizeKey(e.unit_name ?? "").includes(key) ||
          (e.phone_last4 ?? "").includes(search.trim()),
      )
      .slice(0, 200);
  }, [employees, search]);

  const toggleActive = useMutation({
    mutationFn: async (row: EmployeeRow) => {
      const { error } = await supabase.from("employees").update({ is_active: !row.is_active }).eq("id", row.id);
      if (error) throw error;
      await logAudit({
        action: "update",
        entity: "employee",
        entityId: row.id,
        entityLabel: row.full_name,
        details: { is_active: !row.is_active },
      });
    },
    onSuccess: () => {
      toast.success("Đã cập nhật trạng thái nhân viên.");
      void qc.invalidateQueries({ queryKey: ["admin-employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (row: EmployeeRow) => {
      const { error } = await supabase.from("employees").delete().eq("id", row.id);
      if (error) throw error;
      await logAudit({ action: "delete", entity: "employee", entityId: row.id, entityLabel: row.full_name });
    },
    onSuccess: () => {
      toast.success("Đã xoá nhân viên khỏi danh bạ.");
      void qc.invalidateQueries({ queryKey: ["admin-employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function importEmployees(rows: ImportRow[]) {
    const { error } = await supabase.from("employees").insert(rows);
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: "import",
      entity: "employee",
      entityLabel: `${rows.length} nhân viên`,
      details: { count: rows.length },
    });
    toast.success(`Đã nhập ${rows.length} nhân viên.`);
    void qc.invalidateQueries({ queryKey: ["admin-employees"] });
  }

  return (
    <AdminSection
      title="Danh bạ nhân viên"
      description={
        employeesQuery.isLoading
          ? "Đang tải..."
          : `${employees.length} nhân viên · dùng để xác thực người dự thi (số điện thoại luôn được che)`
      }
      toolbar={
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, đơn vị, 4 số cuối..."
            className="rounded-full pl-9"
          />
        </div>
      }
      actions={
        canEdit ? (
          <CsvImportDialog<ImportRow>
            title="Nhập nhân viên từ CSV"
            description="Cột bắt buộc: “ho_ten” và “dien_thoai”. Cột tuỳ chọn: “chuc_vu”, “don_vi”, “ngay_sinh” (dd/mm/yyyy)."
            templateFileName="mau-nhan-vien.csv"
            templateHeaders={["ho_ten", "chuc_vu", "don_vi", "ngay_sinh", "dien_thoai"]}
            templateSample={[["Nguyễn Văn A", "Kiểm soát viên không lưu", "Phòng Kỹ thuật", "01/02/1990", "0905123456"]]}
            existingKeys={existingKeys}
            keyOf={(v) => `${v.name_key}|${v.phone_last4 ?? ""}`}
            renderPreview={(v) => `${v.full_name}${v.unit_name ? ` · ${v.unit_name}` : ""}`}
            mapRow={(row) => {
              const fullName = (row["ho_ten"] ?? row["full_name"] ?? row["name"] ?? "").trim();
              if (fullName.length < 2) return { ok: false as const, message: "Thiếu họ tên." };
              const phoneRaw = (row["dien_thoai"] ?? row["phone"] ?? row["sdt"] ?? "").replace(/\D/g, "");
              if (phoneRaw.length < 4) return { ok: false as const, message: "Số điện thoại không hợp lệ." };
              const birth = toIsoDate(row["ngay_sinh"] ?? row["birth_date"] ?? "");
              if ((row["ngay_sinh"] ?? "").trim() && !birth)
                return { ok: false as const, message: "Ngày sinh phải dạng dd/mm/yyyy." };
              return {
                ok: true as const,
                value: {
                  full_name: fullName,
                  name_key: normalizeKey(fullName),
                  position: (row["chuc_vu"] ?? row["position"] ?? "").trim() || null,
                  unit_name: (row["don_vi"] ?? row["unit"] ?? "").trim() || null,
                  birth_date: birth,
                  phone: phoneRaw,
                  phone_last4: phoneRaw.slice(-4),
                },
              };
            }}
            onImport={importEmployees}
          />
        ) : null
      }
    >
      <QueryState
        isLoading={employeesQuery.isLoading}
        isError={employeesQuery.isError}
        error={employeesQuery.error}
        isFetching={employeesQuery.isFetching}
        onRetry={() => void employeesQuery.refetch()}
        isEmpty={filtered.length === 0}
        skeleton={<ListSkeleton rows={6} height="h-14" />}
        empty={
          <EmptyState
            icon={IdCard}
            title={search ? "Không tìm thấy nhân viên phù hợp" : "Danh bạ nhân viên trống"}
            description={
              search
                ? "Thử tìm bằng tên khác hoặc 4 số cuối điện thoại."
                : "Nhập danh sách nhân viên từ tệp CSV để bật đăng nhập nhanh."
            }
          />
        }
      >
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {filtered.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {e.full_name}
                  {!e.is_active && <span className="ml-2 text-xs font-medium text-destructive">(đã khoá)</span>}
                </p>
                <p className="type-meta truncate">
                  {[e.position, e.unit_name].filter(Boolean).join(" · ") || "Chưa cập nhật đơn vị"}
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                ••••{e.phone_last4 ?? "????"}
                {e.birth_date ? ` · ${e.birth_date.slice(0, 4)}` : ""}
              </span>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full"
                    title={e.is_active ? "Khoá dự thi" : "Mở lại"}
                    onClick={() => toggleActive.mutate(e)}
                    disabled={toggleActive.isPending}
                  >
                    {e.is_active ? (
                      <UserRoundCheck className="size-4 text-success" />
                    ) : (
                      <UserRoundX className="size-4 text-destructive" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full text-destructive"
                    title="Xoá khỏi danh bạ"
                    onClick={() => remove.mutate(e)}
                    disabled={remove.isPending}
                  >
                    {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </QueryState>
    </AdminSection>
  );
}
