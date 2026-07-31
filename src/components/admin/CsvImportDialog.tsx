import { useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, Loader2, Upload } from "lucide-react";

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
import { downloadTemplate, parseCsv, validateRows, type CsvRow, type ValidationResult } from "@/lib/csv";

type Props<T> = {
  title: string;
  description: string;
  templateFileName: string;
  templateHeaders: string[];
  templateSample: string[][];
  mapRow: (row: CsvRow, line: number) => { ok: true; value: T } | { ok: false; message: string };
  keyOf: (value: T) => string;
  existingKeys: Set<string>;
  onImport: (rows: T[]) => Promise<void>;
  renderPreview: (value: T) => string;
  disabled?: boolean;
};

export function CsvImportDialog<T>({
  title,
  description,
  templateFileName,
  templateHeaders,
  templateSample,
  mapRow,
  keyOf,
  existingKeys,
  onImport,
  renderPreview,
  disabled,
}: Props<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ValidationResult<T> | null>(null);
  const [importing, setImporting] = useState(false);

  function reset() {
    setResult(null);
    setFileName("");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const { rows } = parseCsv(text);
    setFileName(file.name);
    setResult(validateRows<T>({ rows, mapRow, keyOf, existingKeys }));
  }

  async function confirm() {
    if (!result || result.valid.length === 0) return;
    setImporting(true);
    try {
      await onImport(result.valid);
      setOpen(false);
      reset();
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full" disabled={disabled}>
          <Upload className="size-4" /> Nhập CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => downloadTemplate(templateFileName, templateHeaders, templateSample)}
            >
              <FileDown className="size-4" /> Tải tệp mẫu
            </Button>
            <Button type="button" variant="outline" className="rounded-full" onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" /> Chọn tệp CSV
            </Button>
            {fileName ? <span className="type-meta truncate text-muted-foreground">{fileName}</span> : null}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          {result ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: "Hợp lệ", value: result.valid.length },
                  { label: "Trùng trong tệp", value: result.duplicatesInFile },
                  { label: "Đã có sẵn", value: result.duplicatesInDb },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                    <p className="font-mono text-xl font-bold">{s.value}</p>
                    <p className="type-meta text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              {result.issues.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
                  <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangle className="size-4" /> {result.issues.length} dòng cần xem lại
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {result.issues.slice(0, 50).map((i) => (
                      <li key={`${i.line}-${i.message}`}>
                        Dòng {i.line}: {i.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="size-4" /> Tất cả các dòng đều hợp lệ.
                </p>
              )}

              {result.valid.length > 0 ? (
                <div className="max-h-40 overflow-y-auto rounded-2xl border border-border">
                  {result.valid.slice(0, 30).map((v, i) => (
                    <p key={i} className="truncate border-b border-border/60 px-3 py-2 text-xs last:border-0">
                      {renderPreview(v)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
            Huỷ
          </Button>
          <Button className="rounded-full" onClick={() => void confirm()} disabled={!result?.valid.length || importing}>
            {importing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Nhập {result?.valid.length ?? 0} dòng
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
