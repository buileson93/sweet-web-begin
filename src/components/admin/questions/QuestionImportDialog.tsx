import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileDown, Loader2, Upload, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { parseCsv } from "@/lib/csv";
import { readDocxQuestions } from "@/lib/docxImport";
import { downloadQuestionTemplate, readAllSheetRows } from "@/lib/importTemplate";
import { uploadOptionImage, uploadQuestionImage } from "@/lib/questionImage";
import { commitOptionImages, commitQuestionImage } from "@/lib/questionImages.functions";
import {
  buildImportPreview,
  chunk,
  issuesToCsv,
  rowToDraft,
  selectImportable,
  type ImportItem,
} from "@/lib/questionImport";
import { cn } from "@/lib/utils";

const BATCH_SIZE = 50;

const STATUS_META = {
  ok: { label: "Hợp lệ", icon: CheckCircle2, className: "text-success" },
  warn: { label: "Cảnh báo", icon: AlertTriangle, className: "text-warning-foreground" },
  error: { label: "Lỗi", icon: XCircle, className: "text-destructive" },
} as const;

type Props = {
  quizId: string;
  existingKeys: Set<string>;
  disabled?: boolean;
  onImported: () => void;
};

export function QuestionImportDialog({ quizId, existingKeys, disabled, onImported }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [images, setImages] = useState<File[]>([]);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);

  const importable = useMemo(
    () => selectImportable(items, includeDuplicates),
    [items, includeDuplicates],
  );
  const counts = useMemo(
    () => ({
      ok: items.filter((i) => i.status === "ok").length,
      warn: items.filter((i) => i.status === "warn").length,
      error: items.filter((i) => i.status === "error").length,
    }),
    [items],
  );

  function reset() {
    setItems([]);
    setImages([]);
    setFileName("");
    setDone(0);
    cancelRef.current = false;
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleFile(file: File) {
    setReading(true);
    setFileName(file.name);
    try {
      const lower = file.name.toLowerCase();
      if (lower.endsWith(".docx")) {
        const { drafts, images: imgs } = await readDocxQuestions(file);
        setImages(imgs);
        setItems(buildImportPreview(drafts, existingKeys));
      } else if (lower.endsWith(".xlsx")) {
        const rows = await readAllSheetRows(file);
        setImages([]);
        setItems(buildImportPreview(rows.map((r, i) => rowToDraft(r, i + 2)), existingKeys));
      } else {
        const { rows } = parseCsv(await file.text());
        setImages([]);
        setItems(buildImportPreview(rows.map((r, i) => rowToDraft(r, i + 2)), existingKeys));
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đọc được tệp.");
      reset();
    } finally {
      setReading(false);
    }
  }

  function downloadIssues() {
    const blob = new Blob(["\uFEFF" + issuesToCsv(items)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dong-loi-nhap-cau-hoi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Ghi theo lô 50 câu; huỷ giữa chừng sẽ thu hồi các câu vừa tạo. */
  async function runImport() {
    if (!quizId || importable.length === 0) return;
    setRunning(true);
    cancelRef.current = false;
    setDone(0);
    const createdIds: string[] = [];

    try {
      for (const batch of chunk(importable, BATCH_SIZE)) {
        if (cancelRef.current) throw new Error("CANCELLED");

        // Ảnh nhúng trong .docx: nén rồi tải lên thư mục tạm trước khi ghi câu hỏi.
        const uploads = await Promise.all(
          batch.map(async (item) => {
            const d = item.draft;
            const cover =
              d.imageRef !== null && d.imageRef !== undefined && images[d.imageRef]
                ? await uploadQuestionImage(images[d.imageRef], quizId).then((r) => r.path)
                : null;
            const optionPaths = await Promise.all(
              (d.optionImageRefs ?? []).map(async (ref) =>
                ref !== null && ref !== undefined && images[ref]
                  ? (await uploadOptionImage(images[ref], quizId)).path
                  : "",
              ),
            );
            return { cover, optionPaths };
          }),
        );

        const payload = batch.map((item, i) => ({
          quiz_id: quizId,
          question: item.draft.question.trim(),
          options: item.draft.options,
          option_images: uploads[i].optionPaths,
          correct_index: Math.max(0, item.draft.correct_index),
          kind: item.draft.kind,
          difficulty: item.draft.difficulty,
          points: item.draft.points,
          explanation: item.draft.explanation,
          tags: item.draft.tags,
          image_url: uploads[i].cover,
        }));

        const { data, error } = await supabase.from("questions").insert(payload).select("id");
        if (error) throw error;
        const ids = (data ?? []).map((r) => r.id as string);
        createdIds.push(...ids);

        // Chuyển ảnh tạm sang thư mục chính thức của từng câu hỏi.
        await Promise.all(
          ids.map(async (id, i) => {
            if (uploads[i].cover)
              await commitQuestionImage({
                data: { path: uploads[i].cover as string, quizId, questionId: id },
              });
            if (uploads[i].optionPaths.some(Boolean))
              await commitOptionImages({
                data: { paths: uploads[i].optionPaths, quizId, questionId: id },
              });
          }),
        );

        setDone((n) => n + batch.length);
      }

      await logAudit({
        action: "import",
        entity: "question",
        entityLabel: `${createdIds.length} câu hỏi từ ${fileName}`,
        details: { count: createdIds.length, file: fileName, quiz_id: quizId },
      });
      toast.success(`Đã nhập ${createdIds.length} câu hỏi từ ${fileName}.`);
      onImported();
      setOpen(false);
      reset();
    } catch (e) {
      if (createdIds.length > 0)
        await supabase.from("questions").delete().in("id", createdIds);
      const cancelled = e instanceof Error && e.message === "CANCELLED";
      toast[cancelled ? "info" : "error"](
        cancelled
          ? "Đã huỷ nhập, mọi câu hỏi vừa tạo đã được thu hồi."
          : e instanceof Error
            ? e.message
            : "Nhập thất bại, dữ liệu đã được hoàn tác.",
      );
      setDone(0);
    } finally {
      setRunning(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (running) return;
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full" disabled={disabled}>
          <Upload className="size-4" /> Nhập câu hỏi
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhập câu hỏi từ Word, Excel hoặc CSV</DialogTitle>
          <DialogDescription>
            Tệp .docx theo mẫu “Câu 1: … / A. … / Đáp án: B / Giải thích: …”, kèm ảnh nhúng. Tệp
            .xlsx và .csv theo tệp mẫu. Mọi câu đều được xem trước trước khi ghi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              className="rounded-full"
              onClick={() => void downloadQuestionTemplate()}
              disabled={running}
            >
              <FileDown className="size-4" /> Tải tệp mẫu Excel
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => inputRef.current?.click()}
              disabled={running || reading}
            >
              {reading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              Chọn tệp (.docx, .xlsx, .csv)
            </Button>
            {fileName ? <span className="type-meta truncate text-muted-foreground">{fileName}</span> : null}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.docx"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </div>

          {items.length > 0 ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                {[
                  { label: "Tổng số câu", value: items.length },
                  { label: "Hợp lệ", value: counts.ok },
                  { label: "Cảnh báo", value: counts.warn },
                  { label: "Lỗi", value: counts.error },
                ].map((s) => (
                  <div key={s.label} className="rounded-2xl border border-border bg-secondary/40 px-3 py-2">
                    <p className="font-mono text-xl font-bold">{s.value}</p>
                    <p className="type-meta text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>

              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={includeDuplicates}
                  onCheckedChange={(v) => setIncludeDuplicates(v === true)}
                  disabled={running}
                />
                Vẫn nhập cả những câu bị trùng nội dung
              </label>

              <div className="max-h-72 overflow-y-auto rounded-2xl border border-border">
                {items.map((item) => {
                  const meta = STATUS_META[item.status];
                  const Icon = meta.icon;
                  return (
                    <div
                      key={`${item.draft.line}-${item.draft.question.slice(0, 20)}`}
                      className="flex gap-3 border-b border-border/60 px-3 py-2 last:border-0"
                    >
                      <Icon className={cn("mt-0.5 size-4 shrink-0", meta.className)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          <span className="text-muted-foreground">#{item.draft.line}</span>{" "}
                          {item.draft.question || "(trống)"}
                        </p>
                        <p className="type-meta truncate text-muted-foreground">
                          {item.draft.options.length} phương án ·{" "}
                          {item.draft.correct_index >= 0
                            ? `Đáp án ${String.fromCharCode(65 + item.draft.correct_index)}`
                            : "Chưa có đáp án"}
                        </p>
                        {item.messages.length > 0 ? (
                          <p className={cn("type-meta", meta.className)}>{item.messages.join(" · ")}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {counts.error + counts.warn > 0 ? (
                <Button variant="ghost" className="rounded-full" onClick={downloadIssues} disabled={running}>
                  <FileDown className="size-4" /> Tải danh sách dòng cần xem lại
                </Button>
              ) : null}

              {running ? (
                <div className="space-y-2">
                  <Progress value={(done / Math.max(1, importable.length)) * 100} />
                  <p className="type-meta text-muted-foreground">
                    Đang ghi {done}/{importable.length} câu (mỗi lô {BATCH_SIZE} câu)...
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {running ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => {
                cancelRef.current = true;
              }}
            >
              Huỷ và hoàn tác
            </Button>
          ) : (
            <Button variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>
              Đóng
            </Button>
          )}
          <Button
            className="rounded-full"
            onClick={() => void runImport()}
            disabled={running || importable.length === 0}
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
            Nhập {importable.length} câu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
