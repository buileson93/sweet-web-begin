import { useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, CalendarClock, Loader2, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { CredentialInput } from "@/components/CredentialInput";
import { HintTip } from "@/components/HintTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getDeviceId } from "@/lib/deviceId";
import { startExam } from "@/lib/exam.functions";
import { saveExamEntry } from "@/lib/examSession";
import { verifyEmployeeFn } from "@/lib/employees.functions";
import { formatDateTime, quizStatus, statusLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

export type RegisterQuiz = {
  id: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  is_active: boolean;
  question_count: number;
  duration_minutes: number;
  status?: string | null;
  /** Nội quy riêng của cuộc thi, hiển thị trước khi vào phòng thi. */
  intro_markdown?: string | null;
};

type Props = {
  quizzes: RegisterQuiz[];
  loading?: boolean;
  /** Khoá sẵn cuộc thi (dùng ở trang chi tiết) */
  lockedQuizId?: string;
  value?: string;
  onValueChange?: (id: string) => void;
};

type Verified = {
  id: string;
  fullName: string;
  position: string | null;
  unitName: string | null;
  birthYear: string;
  phoneMasked: string;
};

const NAME_RE = /^[\p{L}\s.'-]{2,120}$/u;

/** Chấp nhận 4 số cuối điện thoại hoặc ngày sinh dd/mm/yyyy. */
function credentialOk(value: string) {
  const v = value.trim();
  if (/^\d{4}$/.test(v)) return true;
  if (/^\d{1,2}[/\-.]\d{1,2}[/\-.]\d{4}$/.test(v)) return true;
  if (/^\d{8}$/.test(v)) return true;
  return false;
}

export function RegisterCard({ quizzes, loading, lockedQuizId, value, onValueChange }: Props) {
  const navigate = useNavigate();
  const runStart = useServerFn(startExam);
  const runVerify = useServerFn(verifyEmployeeFn);

  const [innerQuiz, setInnerQuiz] = useState("");
  const [quizPulse, setQuizPulse] = useState(0);
  const quizId = lockedQuizId ?? value ?? innerQuiz;
  const setQuizId = (id: string) => (onValueChange ? onValueChange(id) : setInnerQuiz(id));

  const [name, setName] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [credTouched, setCredTouched] = useState(false);
  const [credential, setCredential] = useState("");
  const [extraCredential, setExtraCredential] = useState("");
  const [needExtra, setNeedExtra] = useState(false);
  const [verified, setVerified] = useState<Verified | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [committed, setCommitted] = useState(false);

  const selected = useMemo(() => quizzes.find((q) => q.id === quizId), [quizzes, quizId]);
  const selectedStatus = selected ? quizStatus(selected) : null;

  const trimmed = name.trim();
  const nameError = !trimmed
    ? "Vui lòng nhập họ và tên."
    : !NAME_RE.test(trimmed)
      ? "Họ tên từ 2 ký tự, chỉ gồm chữ cái."
      : null;
  const credentialError = credentialOk(credential) ? null : "Nhập 4 số cuối điện thoại hoặc ngày sinh dd/mm/yyyy.";

  const quizReady = Boolean(quizId) && selectedStatus === "open";
  const canVerify = !nameError && !credentialError && (!needExtra || credentialOk(extraCredential));
  const intro = (selected?.intro_markdown ?? "").trim();
  const needCommit = Boolean(intro);
  const canStart = quizReady && Boolean(verified) && (!needCommit || committed);

  const hint = !quizId
    ? "Chọn cuộc thi bạn muốn tham gia."
    : selectedStatus !== "open"
      ? `Cuộc thi này ${selectedStatus === "upcoming" ? "chưa đến giờ mở" : selectedStatus === "closed" ? "đã kết thúc" : "đang tạm dừng"}.`
      : !verified
        ? "Xác thực bằng họ tên kèm 4 số cuối điện thoại hoặc ngày sinh."
        : needCommit && !committed
          ? "Vui lòng đọc nội quy và tích ô cam kết."
          : "Sẵn sàng vào phòng thi.";

  function resetVerified() {
    if (verified) setVerified(null);
  }

  async function handleVerify() {
    setNameTouched(true);
    setCredTouched(true);
    if (!canVerify) return toast.error(nameError ?? credentialError ?? "Vui lòng nhập thêm thông tin xác thực.");
    setVerifying(true);
    try {
      const emp = await runVerify({
        data: { name: trimmed, credential: credential.trim(), extraCredential: extraCredential.trim() || undefined },
      });
      setVerified(emp);
      setNeedExtra(false);
      toast.success(`Xin chào ${emp.fullName}!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không xác thực được thông tin.";
      if (message.includes("trùng họ tên")) setNeedExtra(true);
      setVerified(null);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  }

  async function handleStart() {
    if (!canStart) return toast.error("Vui lòng chọn cuộc thi đang mở và xác thực thông tin.");
    setSubmitting(true);
    try {
      const session = await runStart({
        data: {
          quizId,
          name: trimmed,
          credential: credential.trim(),
          extraCredential: extraCredential.trim() || undefined,
          deviceId: getDeviceId(),
        },
      });
      saveExamEntry(sessionStorage, {
        quizId,
        name: trimmed,
        credential: credential.trim(),
        extraCredential: extraCredential.trim() || undefined,
      });
      sessionStorage.setItem("exam:" + session.sessionId, JSON.stringify(session));
      sessionStorage.setItem("exam:current", session.sessionId);
      navigate({ to: "/thi" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể bắt đầu bài thi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="card-elevated rounded-2xl p-5 text-card-foreground sm:p-6">
      <div className="min-w-0">
        <h2 className="type-h3">Vào phòng thi</h2>
        <p className="type-meta mt-0.5">
          Xác thực nhanh bằng danh bạ nhân viên ·{" "}
          <span className="font-semibold text-foreground">thi lại không giới hạn</span>
        </p>
      </div>


      <div className="mt-4 space-y-3.5">
        {!lockedQuizId && (
          <div className="space-y-1.5">
            <Label htmlFor="quiz">Cuộc thi</Label>
            {loading ? (
              <Skeleton className="h-10 w-full rounded-xl" />
            ) : quizzes.length === 0 ? (
              <p className="type-meta rounded-xl bg-muted px-3 py-2.5">Chưa có cuộc thi nào được mở.</p>
            ) : (
              <Select
                value={quizId}
                onValueChange={(id) => {
                  setQuizId(id);
                  setQuizPulse((n) => n + 1);
                }}
              >
                <SelectTrigger
                  id="quiz"
                  key={quizPulse}
                  className={cn("relative overflow-hidden rounded-xl", quizPulse > 0 && "animate-tap-shake")}
                >
                  <SelectValue placeholder="Chọn cuộc thi" />
                  {quizPulse > 0 ? <span className="tap-flash rounded-xl" aria-hidden /> : null}
                </SelectTrigger>
                <SelectContent className="max-w-[calc(100vw-1.5rem)]">
                  {quizzes.map((q) => {
                    const st = quizStatus(q);
                    return (
                      <SelectItem key={q.id} value={q.id} disabled={st !== "open"}>
                        {q.title} — {statusLabel[st]}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="name">Họ và tên</Label>
          <Input
            id="name"
            className={cn("h-10 rounded-xl", nameTouched && nameError && "border-destructive")}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              resetVerified();
            }}
            onBlur={() => setNameTouched(true)}
            placeholder="Nguyễn Văn A"
            autoComplete="name"
            disabled={Boolean(verified)}
            aria-invalid={nameTouched && Boolean(nameError)}
          />
          {nameTouched && nameError && <p className="text-xs font-medium text-destructive">{nameError}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label htmlFor="credential">4 số cuối điện thoại hoặc ngày sinh</Label>
            <HintTip label="Cách nhập thông tin xác thực">
              Chỉ cần đúng một trong hai thông tin đã đăng ký với Phòng TCCB-LĐ: 4 số cuối điện thoại (ví dụ 1234) hoặc
              ngày sinh dạng 01/02/1990.
            </HintTip>
          </div>
          <CredentialInput
            id="credential"
            value={credential}
            error={credTouched && credentialError ? credentialError : null}
            disabled={Boolean(verified)}
            onChange={(v) => {
              setCredential(v);
              resetVerified();
            }}
            onEnter={() => {
              if (!verified && canVerify) void handleVerify();
            }}
          />
        </div>


        {needExtra && !verified && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="extra">Thông tin còn lại</Label>
              <HintTip label="Vì sao cần thêm thông tin">
                Có người trùng họ tên nên cần thêm thông tin còn lại để phân biệt.
              </HintTip>
            </div>
            <CredentialInput
              id="extra"
              value={extraCredential}
              defaultMode="dob"
              onChange={setExtraCredential}
              onEnter={() => {
                if (canVerify) void handleVerify();
              }}
            />
            
          </div>
        )}

        {verified ? (
          <div className="animate-pop flex items-start gap-2.5 rounded-xl border border-success/40 bg-success/10 p-3">
            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-success" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-sm font-bold">{verified.fullName}</p>
              <p className="type-meta truncate">
                {[verified.position, verified.unitName].filter(Boolean).join(" · ") || "Cán bộ nhân viên"}
              </p>
            </div>
            <button
              type="button"
              aria-label="Đổi thông tin"
              className="type-meta shrink-0 rounded-full px-2 py-1 underline underline-offset-2 hover:text-foreground"
              onClick={() => {
                setVerified(null);
                setCredential("");
              }}
            >
              Đổi
            </button>
          </div>
        ) : (
          <Button
            variant="secondary"
            className="h-10 w-full rounded-xl"
            onClick={handleVerify}
            disabled={verifying || !canVerify}
          >
            {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {verifying ? "Đang đối chiếu..." : "Xác thực thông tin"}
          </Button>
        )}

        {intro && (
          <div className="space-y-2 rounded-xl border border-border bg-secondary/60 p-3">
            <p className="text-sm font-semibold">Hướng dẫn &amp; nội quy</p>
            <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">{intro}</p>
            <label className="flex cursor-pointer items-start gap-2 text-xs font-medium">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-[hsl(var(--primary))]"
                checked={committed}
                onChange={(e) => setCommitted(e.target.checked)}
              />
              <span>Tôi đã đọc và cam kết làm bài trung thực.</span>
            </label>
          </div>
        )}

        {selected && (
          <p className="type-meta flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-secondary px-3 py-2">
            <span className="font-semibold text-secondary-foreground">
              {selected.question_count} câu · {selected.duration_minutes} phút
            </span>
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              {formatDateTime(selected.start_time)} → {formatDateTime(selected.end_time)}
            </span>
          </p>
        )}

        <Button className="game-button h-11 w-full rounded-xl" onClick={handleStart} disabled={submitting || !canStart}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          {submitting ? "Đang tạo phiên thi..." : "Bắt đầu làm bài"}
        </Button>

        <p className={cn("type-meta text-center", canStart && "text-success")}>{hint}</p>

        <div className="flex items-center justify-center gap-3 border-t border-border pt-3">
          <Link to="/lich-su" className="type-meta inline-flex items-center gap-1.5 hover:text-foreground">
            <RefreshCw className="size-3.5" />
            Lịch sử làm bài
          </Link>
          <Link to="/huong-dan" className="type-meta hover:text-foreground">
            Luật chơi
          </Link>
        </div>
      </div>
    </div>
  );
}
