import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ShieldCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/ui-kit";
import { grantRole, listAccounts, revokeRole } from "@/lib/roles.functions";

const ROLE_LABEL: Record<string, string> = {
  admin: "Quản trị viên",
  editor: "Biên soạn đề",
  staff: "Kỹ thuật (chỉ xem)",
  user: "Người dùng",
};

/** Quản lý tài khoản phụ: cấp quyền biên soạn đề, kỹ thuật hoặc quản trị. */
export function RoleManager() {
  const qc = useQueryClient();
  const runList = useServerFn(listAccounts);
  const runGrant = useServerFn(grantRole);
  const runRevoke = useServerFn(revokeRole);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "editor" | "staff">("editor");

  const accountsQuery = useQuery({
    queryKey: ["admin-accounts"],
    queryFn: () => runList({ data: undefined }),
  });

  const grantMutation = useMutation({
    mutationFn: (vars: { email: string; role: "admin" | "editor" | "staff" }) => runGrant({ data: vars }),
    onSuccess: (res) => {
      toast.success(`Đã cấp quyền ${ROLE_LABEL[res.role]} cho ${res.email}.`);
      setEmail("");
      void qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Không cấp được quyền."),
  });

  const revokeMutation = useMutation({
    mutationFn: (vars: { userId: string; role: "admin" | "editor" | "staff" }) => runRevoke({ data: vars }),
    onSuccess: () => {
      toast.success("Đã thu hồi quyền.");
      void qc.invalidateQueries({ queryKey: ["admin-accounts"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Không thu hồi được quyền."),
  });

  return (
    <div className="space-y-6">
      <div className="card-elevated space-y-4 p-5">
        <div>
          <h3 className="type-h3">Cấp quyền cho tài khoản</h3>
          <p className="type-meta mt-1">
            Người dùng cần đăng ký tài khoản trước, sau đó nhập email của họ để cấp quyền biên soạn đề.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_14rem_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="grant-email">Email tài khoản</Label>
            <Input
              id="grant-email"
              type="email"
              placeholder="nguoisoande@vatm.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Vai trò</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Biên soạn đề</SelectItem>
                <SelectItem value="staff">Kỹ thuật (chỉ xem)</SelectItem>
                <SelectItem value="admin">Quản trị viên</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            className="rounded-full"
            disabled={!email.trim() || grantMutation.isPending}
            onClick={() => grantMutation.mutate({ email: email.trim(), role })}
          >
            {grantMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
            Cấp quyền
          </Button>
        </div>
      </div>

      {accountsQuery.isLoading ? (
        <ListSkeleton rows={4} height="h-16" />
      ) : accountsQuery.isError ? (
        <ErrorState
          title="Không tải được danh sách tài khoản"
          error={accountsQuery.error}
          onRetry={() => void accountsQuery.refetch()}
          retrying={accountsQuery.isFetching}
        />
      ) : (accountsQuery.data ?? []).length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Chưa có tài khoản nào" description="Chưa có ai đăng ký hệ thống." />
      ) : (
        <div className="space-y-2">
          {(accountsQuery.data ?? []).map((a) => (
            <div
              key={a.userId}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{a.email}</p>
                <p className="type-meta">{a.roles.length === 0 ? "Chưa cấp quyền" : "Vai trò hiện tại"}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {a.roles.map((r) => (
                  <Badge key={r} variant="secondary" className="gap-1 rounded-full">
                    {ROLE_LABEL[r] ?? r}
                    {r !== "user" ? (
                      <button
                        type="button"
                        aria-label={`Thu hồi quyền ${ROLE_LABEL[r] ?? r}`}
                        className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/15 hover:text-destructive"
                        onClick={() =>
                          revokeMutation.mutate({ userId: a.userId, role: r as "admin" | "editor" | "staff" })
                        }
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
