import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserRoundPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { normalizeKey } from "@/lib/csv";

type FormState = {
  fullName: string;
  position: string;
  unitName: string;
  birthDate: string;
  phone: string;
};

const EMPTY: FormState = { fullName: "", position: "", unitName: "", birthDate: "", phone: "" };

/** Thêm nhanh một nhân viên vào danh bạ (không cần tệp CSV). */
export function EmployeeFormDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);

  const unitsQuery = useQuery({
    queryKey: ["admin-units-options"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("units").select("name").order("sort_order");
      if (error) throw error;
      return data.map((u) => u.name);
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const fullName = form.fullName.trim();
      if (fullName.length < 2) throw new Error("Vui lòng nhập họ tên đầy đủ.");
      const phone = form.phone.replace(/\D/g, "");
      if (phone.length < 4) throw new Error("Số điện thoại phải có ít nhất 4 chữ số.");
      if (form.birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(form.birthDate))
        throw new Error("Ngày sinh không hợp lệ.");

      const { error } = await supabase.from("employees").insert({
        full_name: fullName,
        name_key: normalizeKey(fullName),
        position: form.position.trim() || null,
        unit_name: form.unitName.trim() || null,
        birth_date: form.birthDate || null,
        phone,
        phone_last4: phone.slice(-4),
      });
      if (error) throw error;
      await logAudit({ action: "create", entity: "employee", entityLabel: fullName });
    },
    onSuccess: () => {
      toast.success("Đã thêm nhân viên vào danh bạ.");
      setForm(EMPTY);
      setOpen(false);
      void qc.invalidateQueries({ queryKey: ["admin-employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full">
          <UserRoundPlus className="size-4" />
          Thêm nhân viên
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Thêm nhân viên</DialogTitle>
          <DialogDescription>
            Họ tên và số điện thoại là bắt buộc; 4 số cuối dùng để xác thực khi dự thi.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="emp-name">Họ và tên *</Label>
            <Input id="emp-name" value={form.fullName} onChange={set("fullName")} placeholder="Nguyễn Văn A" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-position">Chức vụ</Label>
            <Input id="emp-position" value={form.position} onChange={set("position")} placeholder="Kiểm soát viên không lưu" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="emp-unit">Đơn vị</Label>
            <Input id="emp-unit" list="emp-units" value={form.unitName} onChange={set("unitName")} placeholder="Phòng Kỹ thuật" />
            <datalist id="emp-units">
              {(unitsQuery.data ?? []).map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="emp-birth">Ngày sinh</Label>
              <Input id="emp-birth" type="date" value={form.birthDate} onChange={set("birthDate")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emp-phone">Số điện thoại *</Label>
              <Input id="emp-phone" inputMode="numeric" value={form.phone} onChange={set("phone")} placeholder="0905123456" required />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button type="submit" className="rounded-full" disabled={create.isPending}>
              {create.isPending && <Loader2 className="size-4 animate-spin" />}
              Lưu nhân viên
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
