import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bug, Image as ImageIcon, Inbox, Lightbulb, Heart } from "lucide-react";
import { toast } from "sonner";

import { AdminSection, EmptyState, ListSkeleton, QueryState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { getBugShotUrl, updateBugReport } from "@/lib/bugReports.functions";

const STATUS = [
  { value: "new", label: "Mới" },
  { value: "doing", label: "Đang xử lý" },
  { value: "done", label: "Đã khắc phục" },
  { value: "wontfix", label: "Không xử lý" },
];

const KIND_META: Record<string, { label: string; icon: typeof Bug }> = {
  bug: { label: "Báo lỗi", icon: Bug },
  idea: { label: "Góp ý", icon: Lightbulb },
  thanks: { label: "Cảm ơn", icon: Heart },
};

type Report = {
  id: string;
  created_at: string;
  kind: string;
  title: string;
  description: string;
  contact: string;
  reporter_name: string;
  employee_unit: string | null;
  path: string;
  shot_path: string;
  status: string;
  admin_note: string;
  device: Record<string, unknown> | null;
  user_agent: string;
  ip: string;
};

export function BugReportManager() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [preview, setPreview] = useState<{ url: string } | null>(null);
  const [detail, setDetail] = useState<Report | null>(null);

  const query = useQuery({
    queryKey: ["admin-bug-reports", filter],
    queryFn: async () => {
      let q = supabase
        .from("bug_reports")
        .select(
          "id, created_at, kind, title, description, contact, reporter_name, path, shot_path, status, admin_note, device, user_agent, ip, employee_id, employee_unit",
        )
        .order("created_at", { ascending: false })
        .limit(300);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Report[];
    },
  });

  const rows = query.data ?? [];

  async function changeStatus(id: string, status: string) {
    try {
      await updateBugReport({ data: { id, status } });
      toast.success("Đã cập nhật trạng thái");
      await queryClient.invalidateQueries({ queryKey: ["admin-bug-reports"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không cập nhật được");
    }
  }

  async function saveNote(id: string, note: string) {
    try {
      await updateBugReport({ data: { id, admin_note: note } });
      toast.success("Đã lưu ghi chú");
      await queryClient.invalidateQueries({ queryKey: ["admin-bug-reports"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được");
    }
  }

  async function openShot(path: string) {
    try {
      const { url } = await getBugShotUrl({ data: { path } });
      if (url) setPreview({ url });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không mở được ảnh");
    }
  }

  return (
    <AdminSection
      title="Báo lỗi & góp ý"
      description={query.isLoading ? "Đang tải..." : `${rows.length} phiếu từ người dùng`}
      toolbar={
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="rounded-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <QueryState
        isLoading={query.isLoading}
        isError={query.isError}
        error={query.error}
        isFetching={query.isFetching}
        onRetry={() => void query.refetch()}
        isEmpty={rows.length === 0}
        skeleton={<ListSkeleton rows={4} height="h-24" />}
        empty={
          <EmptyState
            icon={Inbox}
            title="Chưa có phiếu nào"
            description="Người dùng có thể gửi báo lỗi bằng nút hình con bọ ở góc dưới màn hình."
          />
        }
      >
        <div className="grid gap-3">
          {rows.map((r) => {
            const meta = KIND_META[r.kind] ?? KIND_META.bug!;
            return (
              <div key={r.id} className="card-elevated p-4">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="type-eyebrow flex items-center gap-1.5 text-muted-foreground">
                      <meta.icon className="size-3.5 shrink-0" /> {meta.label} ·{" "}
                      {new Date(r.created_at).toLocaleString("vi-VN")}
                    </p>
                    <p className="mt-1 truncate font-bold">{r.title || "(không có tiêu đề)"}</p>
                    <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm text-muted-foreground">
                      {r.description}
                    </p>
                    <p className="type-meta mt-2 truncate">
                      {[r.reporter_name || "Ẩn danh", r.employee_unit, r.contact, r.path, r.ip].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <Select value={r.status} onValueChange={(v) => void changeStatus(r.id, v)}>
                      <SelectTrigger className="h-9 w-36 rounded-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {r.shot_path && (
                      <Button
                        variant="outline"
                        className="h-9 rounded-full text-xs"
                        onClick={() => void openShot(r.shot_path)}
                      >
                        <ImageIcon className="size-4" /> Xem ảnh
                      </Button>
                    )}
                    <Button variant="ghost" className="h-9 rounded-full text-xs" onClick={() => setDetail(r)}>
                      Chi tiết thiết bị
                    </Button>
                  </div>
                </div>

                <NoteBox initial={r.admin_note} onSave={(note) => void saveNote(r.id, note)} />
              </div>
            );
          })}
        </div>
      </QueryState>

      <Dialog open={Boolean(preview)} onOpenChange={(v) => !v && setPreview(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Ảnh người dùng đính kèm</DialogTitle>
          </DialogHeader>
          {preview && <img src={preview.url} alt="Ảnh báo lỗi" className="w-full rounded-xl border border-border" />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(detail)} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Thông tin thiết bị người gửi</DialogTitle>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-xl bg-secondary p-3 text-xs">
            {JSON.stringify({ ...(detail?.device ?? {}), user_agent: detail?.user_agent }, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </AdminSection>
  );
}

function NoteBox({ initial, onSave }: { initial: string; onSave: (note: string) => void }) {
  const [note, setNote] = useState(initial);
  return (
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <Textarea
        className="min-h-10 rounded-xl text-sm"
        placeholder="Ghi chú xử lý nội bộ"
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <Button
        variant="outline"
        className="shrink-0 rounded-full"
        disabled={note === initial}
        onClick={() => onSave(note)}
      >
        Lưu ghi chú
      </Button>
    </div>
  );
}
