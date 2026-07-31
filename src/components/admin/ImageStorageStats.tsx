import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/questionImage";
import {
  cleanupOrphanQuestionImages,
  getQuestionImageStats,
} from "@/lib/questionImages.functions";

/**
 * Dòng thống kê kho ảnh câu hỏi kèm nút dọn ảnh không dùng (chỉ quản trị viên).
 */
export function ImageStorageStats({ canClean = false }: { canClean?: boolean }) {
  const qc = useQueryClient();

  const stats = useQuery({
    queryKey: ["question-image-stats"],
    queryFn: () => getQuestionImageStats(),
    staleTime: 60_000,
  });

  const clean = useMutation({
    mutationFn: () => cleanupOrphanQuestionImages(),
    onSuccess: (r) => {
      toast.success(`Đã thu hồi ${r.deleted} tệp (${formatBytes(r.bytes)}).`);
      void qc.invalidateQueries({ queryKey: ["question-image-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const label = stats.data
    ? `${stats.data.files} tệp, ${formatBytes(stats.data.bytes)}`
    : stats.isError
      ? "không đọc được"
      : "đang tính...";

  return (
    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-secondary/40 px-4 py-3 sm:flex sm:justify-between">
      <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <HardDrive className="size-4 shrink-0 text-accent" />
        <span className="min-w-0">
          Kho ảnh câu hỏi: <span className="font-semibold text-foreground">{label}</span>
          {stats.data?.tmpFiles ? (
            <span className="ml-1">— {stats.data.tmpFiles} tệp đang chờ ở thư mục tạm</span>
          ) : null}
        </span>
      </p>
      {canClean ? (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 rounded-full"
          onClick={() => clean.mutate()}
          disabled={clean.isPending}
        >
          {clean.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          Dọn ảnh không dùng
        </Button>
      ) : null}
    </div>
  );
}
