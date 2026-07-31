import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Mode = "phone" | "dob";

type Props = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onEnter?: () => void;
  /** Chế độ mặc định khi mở form */
  defaultMode?: Mode;
  /** Thông báo lỗi hiển thị dưới ô nhập (đọc được bằng trình đọc màn hình) */
  error?: string | null;
};

function parse(value: string): { mode: Mode; phone: string; day: string; month: string; year: string } {
  const v = (value ?? "").trim();
  const dob = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dob) return { mode: "dob", phone: "", day: dob[1], month: dob[2], year: dob[3] };
  if (/^\d{0,4}$/.test(v)) return { mode: "phone", phone: v, day: "", month: "", year: "" };
  return { mode: "phone", phone: "", day: "", month: "", year: "" };
}

const digits = (s: string) => s.replace(/\D/g, "");

/**
 * Ô nhập thông tin xác thực: chọn giữa 4 số cuối điện thoại (4 ô rời)
 * hoặc ngày sinh với 3 ô có nhãn Ngày / Tháng / Năm.
 * Chỉ nhận chữ số (kể cả khi dán), tự nhảy ô và lùi ô khi bấm Backspace.
 */
export function CredentialInput({
  id = "credential",
  value,
  onChange,
  disabled,
  onEnter,
  defaultMode = "phone",
  error,
}: Props) {
  const initial = parse(value);
  const [mode, setMode] = useState<Mode>(value ? initial.mode : defaultMode);
  const [phone, setPhone] = useState(initial.phone);
  const [dob, setDob] = useState({ d: initial.day, m: initial.month, y: initial.year });
  const phoneBoxes = useRef<Array<HTMLInputElement | null>>([]);
  const dobBoxes = useRef<Array<HTMLInputElement | null>>([]);
  const errorId = `${useId()}-err`;

  useEffect(() => {
    if (mode === "phone") onChange(phone);
    else onChange(dob.d && dob.m && dob.y ? `${dob.d.padStart(2, "0")}/${dob.m.padStart(2, "0")}/${dob.y}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, phone, dob]);

  const focusPhone = (i: number) => {
    const el = phoneBoxes.current[Math.max(0, Math.min(3, i))];
    el?.focus();
    el?.select();
  };
  const focusDob = (i: number) => {
    const el = dobBoxes.current[Math.max(0, Math.min(2, i))];
    el?.focus();
    el?.select();
  };

  const describedBy = error ? errorId : undefined;

  const tab = (m: Mode, label: string) => (
    <button
      key={m}
      type="button"
      role="tab"
      aria-selected={mode === m}
      disabled={disabled}
      onClick={() => setMode(m)}
      className={cn(
        "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-60",
        mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const dobFields = [
    { key: "d" as const, label: "Ngày", ph: "01", len: 2 },
    { key: "m" as const, label: "Tháng", ph: "02", len: 2 },
    { key: "y" as const, label: "Năm sinh", ph: "1990", len: 4 },
  ];

  return (
    <div className="space-y-2">
      <div className="flex gap-1 rounded-xl bg-secondary p-1" role="tablist" aria-label="Cách xác thực">
        {tab("phone", "4 số cuối SĐT")}
        {tab("dob", "Ngày sinh")}
      </div>

      {mode === "phone" ? (
        <div className="flex gap-2" role="group" aria-label="4 số cuối điện thoại">
          {[0, 1, 2, 3].map((i) => (
            <Input
              key={i}
              id={i === 0 ? id : undefined}
              ref={(el) => {
                phoneBoxes.current[i] = el;
              }}
              value={phone[i] ?? ""}
              disabled={disabled}
              inputMode="numeric"
              autoComplete="off"
              aria-label={`Chữ số thứ ${i + 1} trong 4 số cuối điện thoại`}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              className="h-12 w-full min-w-0 rounded-xl text-center font-heading text-lg font-bold"
              onBeforeInput={(e) => {
                const data = (e.nativeEvent as InputEvent).data;
                if (data && !/^\d+$/.test(data)) e.preventDefault();
              }}
              onChange={(e) => {
                const d = digits(e.target.value);
                if (!d) return;
                const next = (phone.slice(0, i) + d + phone.slice(i + d.length)).slice(0, 4);
                setPhone(next);
                focusPhone(next.length < 4 ? next.length : i + 1);
              }}
              onKeyDown={(e) => {
                if (e.key === "Backspace") {
                  e.preventDefault();
                  if (phone[i]) setPhone(phone.slice(0, i) + phone.slice(i + 1));
                  else if (i > 0) {
                    setPhone(phone.slice(0, i - 1) + phone.slice(i));
                    focusPhone(i - 1);
                  }
                } else if (e.key === "ArrowLeft") focusPhone(i - 1);
                else if (e.key === "ArrowRight") focusPhone(i + 1);
                else if (e.key === "Enter") onEnter?.();
              }}
              onPaste={(e) => {
                e.preventDefault();
                const d = digits(e.clipboardData.getData("text")).slice(-4);
                setPhone(d);
                focusPhone(d.length);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_1fr_1.4fr] gap-2" role="group" aria-label="Ngày tháng năm sinh">
          {dobFields.map((f, idx) => (
            <div key={f.key} className="space-y-1">
              <Input
                id={idx === 0 ? id : undefined}
                ref={(el) => {
                  dobBoxes.current[idx] = el;
                }}
                value={dob[f.key]}
                disabled={disabled}
                inputMode="numeric"
                maxLength={f.len}
                placeholder={f.ph}
                aria-label={`${f.label} sinh`}
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                className="h-12 min-w-0 rounded-xl text-center font-heading text-base font-bold"
                onBeforeInput={(e) => {
                  const data = (e.nativeEvent as InputEvent).data;
                  if (data && !/^\d+$/.test(data)) e.preventDefault();
                }}
                onChange={(e) => {
                  const d = digits(e.target.value).slice(0, f.len);
                  setDob((prev) => ({ ...prev, [f.key]: d }));
                  if (d.length === f.len && idx < 2) focusDob(idx + 1);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && !dob[f.key] && idx > 0) {
                    e.preventDefault();
                    focusDob(idx - 1);
                  } else if (e.key === "Enter") onEnter?.();
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const d = digits(e.clipboardData.getData("text"));
                  if (d.length >= 8) {
                    setDob({ d: d.slice(0, 2), m: d.slice(2, 4), y: d.slice(4, 8) });
                    focusDob(2);
                  } else {
                    setDob((prev) => ({ ...prev, [f.key]: d.slice(0, f.len) }));
                  }
                }}
              />
              <p className="text-center text-[0.68rem] font-medium uppercase tracking-wide text-muted-foreground">
                {f.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {error ? (
        <p id={errorId} role="alert" className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        <p className="type-meta text-muted-foreground">
          {mode === "phone" ? "Nhập 4 chữ số cuối của số điện thoại đã đăng ký." : "Nhập ngày, tháng và năm sinh."}
        </p>
      )}
    </div>
  );
}
