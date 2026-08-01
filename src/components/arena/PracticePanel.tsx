import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { Bot, Castle, BookOpen, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { DueBadge } from "@/components/arena/DueBadge";
import { Button } from "@/components/ui/button";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { arenaOptions, arenaPlayBot } from "@/lib/arena.functions";
import { getDeviceId } from "@/lib/deviceId";

type Options = Awaited<ReturnType<typeof arenaOptions>>;

/**
 * Bảng "luyện tập": chọn bộ đề và mức trợ lý máy để so tài ngay
 * khi chưa có đồng nghiệp nào trực tuyến.
 */
export function PracticePanel({
  token,
  classId,
  disabled,
  onStarted,
}: {
  token: string;
  classId?: string;
  disabled?: boolean;
  onStarted: (duelId: string) => void;
}) {
  const loadOptions = useServerFn(arenaOptions);
  const playBot = useServerFn(arenaPlayBot);
  const [opts, setOpts] = useState<Options | null>(null);
  const [quizId, setQuizId] = useState("all");
  const [tier, setTier] = useState<"de" | "vua" | "kho">("vua");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void loadOptions({ data: { token } })
      .then((res) => {
        if (alive) setOpts(res);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [token, loadOptions]);

  async function start() {
    setBusy(true);
    try {
      const res = await playBot({
        data: {
          token,
          tier,
          quizId: quizId === "all" ? null : quizId,
          deviceHash: getDeviceId(),
          ...(classId ? { classId } : {}),
        },
      });
      onStarted(res.duelId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không mở được ván luyện tập.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card/70 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Bot className="size-5 text-primary" />
        <h3 className="text-sm font-semibold">Luyện tập với trợ lý</h3>
        <DueBadge />
        <span className="ml-auto text-xs text-muted-foreground">Không tính xếp hạng</span>
      </div>

      <Link
        to="/dau-truong/leo-thap"
        className="mb-3 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm transition hover:border-primary hover:bg-primary/10"
      >
        <Castle className="size-4 text-primary" />
        <span className="font-medium">Leo Tháp Tri Thức</span>
        <span className="type-meta">Ôn đúng câu bạn sắp quên · 5 chặng</span>
      </Link>


      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <BookOpen className="size-3.5" /> Bộ đề
          </Label>
          <Select value={quizId} onValueChange={setQuizId}>
            <SelectTrigger>
              <SelectValue placeholder="Chọn bộ đề" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Câu hỏi tổng hợp</SelectItem>
              {(opts?.quizzes ?? []).map((q) => (
                <SelectItem key={q.id} value={q.id}>
                  {q.title} ({q.questionCount} câu)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="min-w-0 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <Sparkles className="size-3.5" /> Mức độ
          </Label>
          <Select value={tier} onValueChange={(v) => setTier(v as typeof tier)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(opts?.tiers ?? [{ id: "vua", label: "Hải Âu · vừa" }]).map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button className="shrink-0" disabled={busy || disabled} onClick={() => void start()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Bot className="mr-2 size-4" />}
          Luyện ngay
        </Button>
      </div>
    </section>
  );
}
