import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CalendarClock, CheckCircle2, ChevronDown, History, Loader2, Search, Timer, TrendingUp, XCircle } from "lucide-react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { CredentialInput } from "@/components/CredentialInput";
import { HintTip } from "@/components/HintTip";
import { EmptyState } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getExamHistory } from "@/lib/exam.functions";
import type { ExamHistory } from "@/lib/exam.server";
import { formatDateTime, formatSeconds } from "@/lib/format";
import { readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/lich-su")({
  head: () => ({
    meta: [
      { title: "Lịch sử làm bài của tôi | Đấu trường tri thức VATM" },
      {
        name: "description",
        content:
          "Xem lại từng phiên thi của bạn: thời gian bắt đầu và kết thúc, kết quả Đạt hay Chưa đạt, và danh sách câu trả lời đúng hoặc sai.",
      },
      { property: "og:title", content: "Lịch sử làm bài của tôi" },
      { property: "og:description", content: "Xem lại từng phiên thi, kết quả và các câu trả lời đúng hoặc sai." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HistoryPage,
});

function credentialOk(value: string) {
  const v = value.trim();
  return /^\d{4}$/.test(v) || /^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}$/.test(v) || /^\d{8}$/.test(v);
}

function HistoryPage() {
  const runHistory = useServerFn(getExamHistory);
  const [name, setName] = useState("");
  const [credential, setCredential] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ExamHistory | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const canSearch = name.trim().length >= 3 && credentialOk(credential);

  async function handleSearch() {
    if (!canSearch) return toast.error("Nhập họ tên và 4 số cuối điện thoại hoặc ngày sinh.");
    setLoading(true);
    try {
      const res = await runHistory({ data: { name: name.trim(), credential: credential.trim() } });
      setData(res);
      setOpenId(res.attempts[0]?.sessionId ?? null);
    } catch (error) {
      setData(null);
      toast.error(error instanceof Error ? error.message : "Không tải được lịch sử làm bài.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <header className="surface-hero relative overflow-hidden rounded-2xl px-5 py-6 sm:px-7">
        <History aria-hidden className="pointer-events-none absolute -right-4 -top-4 size-32 text-primary-foreground/10" />
        <h1 className="type-h2 text-primary-foreground">Lịch sử làm bài</h1>
        <p className="type-muted mt-1 max-w-xl text-primary-foreground/80">
          Xem lại từng phiên thi của bạn và những câu đã trả lời sai để ôn tập tốt hơn.
        </p>
      </header>

      <section className="card-elevated mt-5 rounded-2xl p-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="h-name">Họ và tên</Label>
            <Input
              id="h-name"
              className="h-10 rounded-xl"
              value={name}
              placeholder="Nguyễn Văn A"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="h-cred">4 số cuối SĐT hoặc ngày sinh</Label>
              <HintTip label="Cách nhập thông tin xác thực">
                Nhập đúng một trong hai: 4 số cuối điện thoại (ví dụ 1234) hoặc ngày sinh dạng 01/02/1990.
              </HintTip>
            </div>
            <CredentialInput
              id="h-cred"
              value={credential}
              onChange={setCredential}
              onEnter={() => {
                if (canSearch) void handleSearch();
              }}
            />
          </div>
          <Button className="h-10 rounded-xl sm:w-32" onClick={handleSearch} disabled={loading || !canSearch}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            Xem lại
          </Button>
        </div>
      </section>

      {data ? (
        data.attempts.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              icon={History}
              title="Bạn chưa có lượt thi nào"
              description="Hãy quay lại trang chủ và bắt đầu lượt thi đầu tiên."
            />
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Stat label="Lượt thi" value={String(data.attempts.length)} />
              <Stat label="Điểm cao nhất" value={`${data.bestPercent}%`} />
              <Stat label="Lượt đạt" value={String(data.passedCount)} />
            </div>

            <p className="type-meta mt-4">
              {data.candidateName}
              {data.unitName ? ` · ${data.unitName}` : ""} — mỗi lần thi lại là một lần củng cố kiến thức.
            </p>

            <ol className="mt-3 space-y-3">
              {data.attempts.map((a) => {
                const open = openId === a.sessionId;
                const wrong = a.questions.filter((q) => !q.correct);
                return (
                  <li key={a.sessionId} className="card-elevated overflow-hidden rounded-2xl">
                    <button
                      type="button"
                      onClick={() => setOpenId(open ? null : a.sessionId)}
                      className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4 text-left hover:bg-secondary/60"
                      aria-expanded={open}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-heading text-sm font-bold">{a.quizTitle}</p>
                        <p className="type-meta mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className="inline-flex items-center gap-1">
                            <CalendarClock className="size-3.5" />
                            {formatDateTime(a.startedAt)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Timer className="size-3.5" />
                            {a.finishedAt ? formatDateTime(a.finishedAt) : "Chưa nộp"}
                            {a.timeSeconds ? ` · ${formatSeconds(a.timeSeconds)}` : ""}
                          </span>
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-right">
                          <span className="block font-mono text-base font-extrabold text-primary">
                            {a.score}/{a.total}
                          </span>
                          <StatusBadge attempt={a} />
                        </span>
                        <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} />
                      </div>
                    </button>

                    {open ? (
                      <div className="border-t border-border p-4">
                        <p className="type-meta mb-3">
                          Đúng {a.questions.filter((q) => q.correct).length}/{a.total} câu
                          {wrong.length > 0 ? ` · cần ôn lại ${wrong.length} câu` : " · hoàn hảo!"}
                        </p>
                        <ul className="space-y-2">
                          {a.questions.map((q, i) => (
                            <li
                              key={i}
                              className={cn(
                                "rounded-xl border p-3 text-sm",
                                q.correct ? "border-success/40 bg-success/8" : "border-destructive/40 bg-destructive/8",
                              )}
                            >
                              <div className="flex items-start gap-2">
                                {q.correct ? (
                                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
                                ) : (
                                  <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                                )}
                                <div className="min-w-0">
                                  <p className="font-medium leading-relaxed">
                                    Câu {i + 1}. {q.question}
                                  </p>
                                  {!q.correct ? (
                                    <p className="type-meta mt-1">
                                      {q.answered ? `Bạn chọn: ${q.chosenText}` : "Bạn chưa trả lời"} · Đáp án đúng:{" "}
                                      <span className="font-semibold text-success">{q.correctText}</span>
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </>
        )
      ) : null}
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-elevated rounded-2xl px-4 py-3 text-center">
      <p className="font-mono text-xl font-extrabold text-primary">{value}</p>
      <p className="type-meta">{label}</p>
    </div>
  );
}

function StatusBadge({ attempt }: { attempt: ExamHistory["attempts"][number] }) {
  if (attempt.status === "disqualified")
    return <span className="type-meta font-semibold text-destructive">Bị huỷ</span>;
  if (attempt.status === "abandoned" || attempt.status === "active")
    return <span className="type-meta font-semibold">Bỏ dở</span>;
  return attempt.passed ? (
    <span className="type-meta inline-flex items-center gap-1 font-semibold text-success">
      <TrendingUp className="size-3" /> Đạt
    </span>
  ) : (
    <span className="type-meta font-semibold text-warning">Chưa đạt</span>
  );
}
