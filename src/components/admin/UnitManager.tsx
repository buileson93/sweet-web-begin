import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Building2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CsvImportDialog } from "@/components/admin/CsvImportDialog";
import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { normalizeKey } from "@/lib/csv";

export function UnitManager({ canEdit = true }: { canEdit?: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const unitsQuery = useQuery({
    queryKey: ["admin-units"],
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("id, name, sort_order").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const units = unitsQuery.data ?? [];
  const existingKeys = useMemo(() => new Set(units.map((u) => normalizeKey(u.name))), [units]);

  const add = useMutation({
    mutationFn: async () => {
      const value = name.trim();
      if (!value) throw new Error("Vui lòng nhập tên đơn vị.");
      if (existingKeys.has(normalizeKey(value))) throw new Error("Đơn vị này đã tồn tại.");
      const { error } = await supabase.from("units").insert({ name: value, sort_order: units.length });
      if (error) throw error;
      await logAudit({ action: "create", entity: "unit", entityLabel: value });
    },
    onSuccess: () => {
      setName("");
      toast.success("Đã thêm đơn vị.");
      void qc.invalidateQueries({ queryKey: ["admin-units"] });
      void qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (unit: { id: string; name: string }) => {
      const { error } = await supabase.from("units").delete().eq("id", unit.id);
      if (error) throw error;
      await logAudit({ action: "delete", entity: "unit", entityId: unit.id, entityLabel: unit.name });
    },
    onSuccess: () => {
      toast.success("Đã xoá đơn vị.");
      void qc.invalidateQueries({ queryKey: ["admin-units"] });
      void qc.invalidateQueries({ queryKey: ["units"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function importUnits(rows: Array<{ name: string }>) {
    const { error } = await supabase
      .from("units")
      .insert(rows.map((r, i) => ({ name: r.name, sort_order: units.length + i })));
    if (error) {
      toast.error(error.message);
      return;
    }
    await logAudit({
      action: "import",
      entity: "unit",
      entityLabel: `${rows.length} đơn vị`,
      details: { count: rows.length },
    });
    toast.success(`Đã nhập ${rows.length} đơn vị.`);
    void qc.invalidateQueries({ queryKey: ["admin-units"] });
    void qc.invalidateQueries({ queryKey: ["units"] });
  }

  return (
    <AdminSection
      title="Đơn vị công tác"
      description={unitsQuery.isLoading ? "Đang tải..." : `${units.length} đơn vị`}
      toolbar={
        canEdit ? (
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tên đơn vị mới..."
            className="rounded-full sm:w-72"
            onKeyDown={(e) => e.key === "Enter" && add.mutate()}
          />
        ) : null
      }
      actions={
        canEdit ? (
          <>
            <CsvImportDialog<{ name: string }>
              title="Nhập đơn vị từ CSV"
              description="Tệp cần có cột “ten_don_vi” (hoặc “name”). Hệ thống tự kiểm tra định dạng và bỏ qua các đơn vị trùng."
              templateFileName="mau-don-vi.csv"
              templateHeaders={["ten_don_vi"]}
              templateSample={[["Trung tâm Kiểm soát tiếp cận tại sân Đà Nẵng"], ["Phòng Kỹ thuật"]]}
              existingKeys={existingKeys}
              keyOf={(v) => v.name}
              renderPreview={(v) => v.name}
              mapRow={(row, _line) => {
                const value = (row["ten_don_vi"] ?? row["name"] ?? row["don_vi"] ?? "").trim();
                if (!value) return { ok: false as const, message: "Thiếu tên đơn vị." };
                if (value.length < 2) return { ok: false as const, message: "Tên đơn vị quá ngắn." };
                if (value.length > 160) return { ok: false as const, message: "Tên đơn vị quá dài (tối đa 160 ký tự)." };
                return { ok: true as const, value: { name: value } };
              }}
              onImport={importUnits}
            />
            <Button className="rounded-full" onClick={() => add.mutate()} disabled={add.isPending}>
              {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Thêm
            </Button>
          </>
        ) : null
      }
    >
      <QueryState
        isLoading={unitsQuery.isLoading}
        isError={unitsQuery.isError}
        error={unitsQuery.error}
        isFetching={unitsQuery.isFetching}
        onRetry={() => void unitsQuery.refetch()}
        isEmpty={units.length === 0}
        skeleton={<ListSkeleton rows={5} height="h-12" />}
        empty={
          <EmptyState
            icon={Building2}
            title="Chưa có đơn vị nào"
            description="Nhập tên đơn vị ở ô phía trên hoặc nhập hàng loạt từ tệp CSV."
          />
        }
      >
        <div className="card-elevated divide-y divide-border overflow-hidden">
          {units.map((u, i) => (
            <div
              key={u.id}
              className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
            >
              <span className="min-w-0 truncate text-sm">
                <span className="mr-3 font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                {u.name}
              </span>
              {canEdit ? (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Xoá ${u.name}`}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Xoá đơn vị "${u.name}"?`)) remove.mutate(u);
                  }}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      </QueryState>
    </AdminSection>
  );
}
