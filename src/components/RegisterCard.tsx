import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  BadgeCheck,
  CalendarClock,
  CircleDashed,
  Clock,
  Loader2,
  LogIn,
  Plane,
  Play,
  ShieldCheck,
  Trophy,
  User,
} from "lucide-react";
import { toast } from "sonner";

import { CredentialInput } from "@/components/CredentialInput";
import { HintTip } from "@/components/HintTip";
import { AvatarPickerDialog } from "@/components/player/AvatarPickerDialog";
import { AvatarBubble } from "@/components/player/AvatarBubble";

import { IconTip } from "@/components/IconTip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";
import { getDeviceId } from "@/lib/deviceId";
import { startExam } from "@/lib/exam.functions";
import { saveExamEntry } from "@/lib/examSession";
import { verifyEmployeeFn } from "@/lib/employees.functions";
import { formatDateTime, quizStatus, statusLabel } from "@/lib/format";
import { QuizStatusBadge } from "@/components/QuizStatusBadge";
import { QuizPeekCard, type QuizPeek } from "@/components/QuizPeekCard";
import { quizTheme } from "@/lib/quizTheme";
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
  /** Ngưỡng đạt tính theo phần trăm. */
  pass_percent?: number | null;
  /** Quyền lợi hiển thị ở thẻ giới thiệu nhanh, do quản trị viên cấu hình. */
  peek_rewards?: string[] | null;
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
  const [peek, setPeek] = useState<QuizPeek | null>(null);
  const peekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (peekTimer.current) clearTimeout(peekTimer.current); }, []);

  /** Thiết bị cảm ứng / màn hình nhỏ: bỏ hẳn thẻ peek vì nó che mất danh sách. */
  const peekAllowed = () =>
    typeof window !== "undefined" &&
    window.innerWidth >= 768 &&
    window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /** Giữ chuột trên một mục ~500ms mới bung thẻ giới thiệu, và đặt cạnh danh sách để không che nội dung. */
  const showPeek = (q: RegisterQuiz, status: ReturnType<typeof quizStatus>, el: HTMLElement) => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    if (!peekAllowed()) return;
    const itemRect = el.getBoundingClientRect();
    const listRect = (el.closest("[role='listbox']") as HTMLElement | null)?.getBoundingClientRect() ?? itemRect;
    peekTimer.current = setTimeout(() => {
      const width = 288;
      const gap = 12;
      const fitsRight = listRect.right + gap + width <= window.innerWidth - 8;
      const fitsLeft = listRect.left - gap - width >= 8;
      if (!fitsRight && !fitsLeft) return; // không đủ chỗ thì thà không hiện còn hơn che danh sách
      const x = fitsRight ? listRect.right + gap : listRect.left - gap - width;

      setPeek({
        id: q.id,
        title: q.title,
        status,
        question_count: q.question_count,
        duration_minutes: q.duration_minutes,
        pass_percent: q.pass_percent ?? null,
        rewards: q.peek_rewards ?? null,
        x,
        y: Math.max(12, itemRect.top - 32),
      });
    }, 500);
  };

  const hidePeek = () => {
    if (peekTimer.current) clearTimeout(peekTimer.current);
    setPeek(null);
  };
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

  // Nhớ họ tên + 4 số cuối trong 3 giờ để không phải nhập lại mỗi lần vào phòng thi.
  useEffect(() => {
    const saved = readQuickLogin();
    if (!saved) return;
    setName((prev) => prev || saved.name);
    setCredential((prev) => prev || saved.credential);
    if (saved.extraCredential) setExtraCredential((prev) => prev || saved.extraCredential!);
  }, []);

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
    ? null
    : selectedStatus !== "open"
      ? `Cuộc thi này ${selectedStatus === "upcoming" ? "chưa đến giờ mở" : selectedStatus === "closed" ? "đã kết thúc" : "đang tạm dừng"}.`
      : !verified
        ? "Xác thực bằng họ tên kèm 4 số cuối điện thoại hoặc ngày sinh."
        : needCommit && !committed
          ? "Vui lòng đọc nội quy và tích ô cam kết."
          : "Sẵn sàng vào phòng thi.";

  /** Xem trước trực tiếp 3 bước: cuộc thi → họ tên → xác thực. */
  const steps = useMemo(() => {
    const quizTone = !quizId ? "idle" : selectedStatus === "open" ? "ok" : "error";
    const quizTip = !quizId
      ? "Chưa chọn cuộc thi — hãy chọn một cuộc thi đang mở."
      : selectedStatus === "open"
        ? `Cuộc thi: ${selected?.title ?? ""}`
        : `Cuộc thi "${selected?.title ?? ""}" ${selectedStatus === "upcoming" ? "chưa đến giờ mở" : selectedStatus === "closed" ? "đã kết thúc" : "đang tạm dừng"}.`;

    const nameTone = !trimmed ? "idle" : nameError ? "error" : "ok";
    const credTone = verified ? "ok" : credential ? (credentialError ? "error" : "idle") : "idle";

    return [
      {
        key: "quiz",
        Icon: quizTone === "ok" ? Trophy : quizTone === "error" ? Clock : CircleDashed,
        tone: quizTone,
        value: selected ? selected.title : "Chọn cuộc thi",
        tip: quizTip,
      },
      {
        key: "name",
        Icon: nameTone === "error" ? AlertCircle : User,
        tone: nameTone,
        value: trimmed || "Họ và tên",
        tip: nameError ?? `Họ tên dự thi: ${trimmed}`,
      },
      {
        key: "cred",
        Icon: credTone === "ok" ? BadgeCheck : credTone === "error" ? AlertCircle : ShieldCheck,
        tone: credTone,
        value: verified ? "Đã xác thực" : credential ? "Chờ xác thực" : "Xác thực",
        tip: verified
          ? `Đã xác thực: ${verified.fullName}${verified.unitName ? " · " + verified.unitName : ""}`
          : (credentialError ?? "Bấm nút xác thực để đối chiếu với danh bạ nhân viên."),
      },
    ] as const;
  }, [credential, credentialError, nameError, quizId, selected, selectedStatus, trimmed, verified]);

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
      saveQuickLogin({
        name: trimmed,
        credential: credential.trim(),
        extraCredential: extraCredential.trim() || undefined,
      });
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
    <div className="card-elevated relative overflow-hidden rounded-2xl text-card-foreground">
      {/* Dải tiêu đề gọn cho thẻ đăng ký vào phòng thi */}
      <div className="surface-hero relative overflow-hidden px-4 py-2.5 sm:px-6 sm:py-3.5">
        <Plane
          aria-hidden
          className="animate-float absolute -right-3 -top-2 size-16 rotate-12 text-primary-foreground/10 sm:size-24"
          strokeWidth={1.4}
        />
        <div className="relative flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg surface-gold shadow-[var(--shadow-gold)] sm:size-10 sm:rounded-xl">
            <LogIn className="size-4 sm:size-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <h2 className="type-h3 truncate text-primary-foreground">Vào phòng thi</h2>
          </div>
        </div>
      </div>

      {/* Bảng xem trước trực tiếp: mỗi mục tự đổi màu theo trạng thái đã nhập */}
      <div className="grid grid-cols-3 gap-px border-b border-border bg-border">
        {steps.map((step) => (
          <IconTip key={step.key} label={step.tip} className="w-full">
            <span
              className={cn(
                "flex h-full w-full flex-col items-center gap-1 bg-card px-2 py-2.5 text-center transition-colors",
                step.tone === "ok" && "bg-success/10",
                step.tone === "error" && "bg-destructive/10",
              )}
            >
              <span
                className={cn(
                  "grid size-7 place-items-center rounded-full",
                  step.tone === "ok" && "bg-success/20 text-success",
                  step.tone === "error" && "bg-destructive/15 text-destructive",
                  step.tone === "idle" && "bg-muted text-muted-foreground",
                )}
              >
                <step.Icon className="size-4" strokeWidth={2.4} />
              </span>
              <span
                className={cn(
                  "type-meta line-clamp-1 max-w-full font-semibold",
                  step.tone === "ok" && "text-success",
                  step.tone === "error" && "text-destructive",
                )}
              >
                {step.value}
              </span>
            </span>
          </IconTip>
        ))}
      </div>

      <div className="p-5 sm:p-6">




      <div className="space-y-3.5">
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
                <SelectContent
                  className="max-w-[calc(100vw-1.5rem)]"
                  style={{ width: "var(--radix-select-trigger-width)" }}
                >
                  {quizzes.map((q) => {
                    const st = quizStatus(q);
                    const theme = quizTheme(q.title);
                    return (
                      <SelectItem
                        key={q.id}
                        value={q.id}
                        disabled={st !== "open"}
                        className="my-0.5 py-2.5 pl-2 data-[highlighted]:bg-accent/60"
                        onMouseEnter={(e) => showPeek(q, st, e.currentTarget)}
                        onMouseLeave={hidePeek}
                        onFocus={(e) => showPeek(q, st, e.currentTarget)}
                        onBlur={hidePeek}
                      >
                        <span className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
                          <span className={cn("grid size-7 shrink-0 place-items-center rounded-lg", theme.chip)}>
                            <theme.Icon className="size-4" strokeWidth={2.6} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-bold leading-tight">{q.title}</span>
                            <span className={cn("type-meta block truncate font-semibold", theme.text)}>
                              {q.question_count} câu • {q.duration_minutes} phút
                            </span>
                          </span>
                          <QuizStatusBadge status={st} />
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>

              </Select>
            )}
            {selected && selectedStatus !== "open" && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
                <Clock className="size-3.5 shrink-0" />
                {selectedStatus === "upcoming"
                  ? `Chưa đến giờ mở — mở lúc ${formatDateTime(selected.start_time)}`
                  : selectedStatus === "closed"
                    ? "Cuộc thi đã kết thúc"
                    : "Cuộc thi đang tạm dừng"}
              </p>
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
            <AvatarBubble name={verified.fullName} size="sm" className="mt-0.5" />
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
        ) : null}

        {verified ? (
          <div className="flex justify-end">
            <AvatarPickerDialog name={trimmed} credential={credential.trim()} />
          </div>
        ) : null}

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

        {/* Hai nút tương đương trên cùng một hàng để tiết kiệm diện tích */}
        <div className="flex items-center gap-2">
          {verified ? null : (
            <Button
              variant="secondary"
              className="h-11 flex-1 rounded-xl"
              onClick={handleVerify}
              disabled={verifying || !canVerify}
            >
              {verifying ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              {verifying ? "Đang đối chiếu..." : "Xác thực thông tin"}
            </Button>
          )}
          <Button className="game-button h-11 flex-1 rounded-xl" onClick={handleStart} disabled={submitting || !canStart}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {submitting ? "Đang tạo phiên..." : "Bắt đầu làm bài"}
          </Button>
        </div>


        {hint ? (
        <p
          className={cn(
            "type-meta flex items-center justify-center gap-1.5 text-center",
            canStart && "text-success",
          )}
        >
          {canStart ? <BadgeCheck className="size-3.5 shrink-0" /> : <AlertCircle className="size-3.5 shrink-0" />}
          {hint}
        </p>
        ) : null}
        <QuizPeekCard peek={peek} />
        </div>
      </div>
    </div>
  );
}
