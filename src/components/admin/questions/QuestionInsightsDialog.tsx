import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, BarChart3, History, Loader2, RotateCcw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { logAudit } from "@/lib/audit";
import {
  getQuestionInsights,
  restoreQuestionVersionFn,
} from "@/lib/questionInsights.functions";
import { questionQualityFlags } from "@/lib/questionInsights";

const DIFFICULTY_TEXT: Record<string, string> = {
  easy: "Dễ (thực tế)",
  medium: "Trung bình (thực tế)",
  hard: "Khó (thực tế)",
  unknown: "Chưa đủ dữ liệu",
};

/** Bảng phân tích độ khó thực tế + lịch sử phiên bản của một câu hỏi. */
export function QuestionInsightsDialog({
  questionId,
  question,
  onOpenChange,
}: {
  questionId: string | null;
  question: string;
  onOpenChange: (open: boolean) => void;
}) {
  const fetchInsights = useServerFn(getQuestionInsights);
  const runRestore = useServerFn(restoreQuestionVersionFn);
  const queryClient = useQueryClient();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["question-insights", questionId],
    enabled: Boolean(questionId),
    queryFn: () => fetchInsights({ data: { questionId: questionId as string } }),
  });

  async function handleRestore(versionId: string, version: number) {
    if (!questionId) return;
    if (!window.confirm(`Khôi phục câu hỏi về phiên bản ${version}? Bản hiện tại vẫn được lưu lại.`)) return;
    setRestoringId(versionId);
    try {
      await runRestore({ data: { questionId, versionId } });
      await logAudit({
        action: "restore",
        entity: "question",
        entityId: questionId,
        entityLabel: question,
        details: { version },
      });
      toast.success(`Đã khôi phục về phiên bản ${version}.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["question-insights", questionId] }),
        queryClient.invalidateQueries({ queryKey: ["admin-questions"] }),
      ]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không khôi phục được phiên bản.");
    } finally {
      setRestoringId(null);
    }
  }


  const stats = data?.stats;
  const versions = data?.versions ?? [];

  return (
    <Dialog open={Boolean(questionId)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="size-4" /> Phân tích câu hỏi
          </DialogTitle>
          <DialogDescription className="line-clamp-2">{question}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải dữ liệu...
          </div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Lượt làm", value: stats?.attempts ?? 0 },
                { label: "Đúng", value: stats?.correct ?? 0 },
                { label: "Đúng một phần", value: stats?.partial ?? 0 },
                { label: "Bỏ trống", value: stats?.blank ?? 0 },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-xl font-semibold">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border bg-card p-4">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tỉ lệ trả lời đúng</span>
                <span className="font-semibold">{stats?.correctPercent ?? 0}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${stats?.correctPercent ?? 0}%` }}
                />
              </div>
              <div className="mt-3">
                <Badge variant={stats?.realDifficulty === "hard" ? "destructive" : "secondary"}>
                  {DIFFICULTY_TEXT[stats?.realDifficulty ?? "unknown"]}
                </Badge>
              </div>
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <History className="size-4" /> Lịch sử phiên bản ({versions.length})
              </h4>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Câu hỏi chưa được chỉnh sửa lần nào.</p>
              ) : (
                <ul className="space-y-2">
                  {versions.map((v) => (
                    <li key={v.id} className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="font-medium">Phiên bản {v.version}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(v.createdAt).toLocaleString("vi-VN")}
                        </span>
                      </div>
                      <p className="line-clamp-3 text-muted-foreground">{v.question}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
