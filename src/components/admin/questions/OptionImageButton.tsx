import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  isTempImagePath,
  questionImageSrc,
  removeQuestionImage,
  uploadOptionImage,
} from "@/lib/questionImage";

/**
 * Nút ảnh nhỏ gắn vào từng ô phương án: chọn tệp, xem trước, gỡ ảnh.
 * Ảnh phương án được nén về cạnh dài 640px / mục tiêu 80KB.
 */
export function OptionImageButton({
  quizId,
  path,
  onChange,
  label,
}: {
  quizId: string;
  path: string;
  onChange: (path: string) => void;
  label: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const src = questionImageSrc(path || null);

  async function upload(file: File) {
    if (busy) return;
    setBusy(true);
    try {
      const previous = path;
      const { path: uploaded } = await uploadOptionImage(file, quizId);
      onChange(uploaded);
      // Ảnh cũ còn nằm trong thư mục tạm thì thu hồi ngay, khỏi chờ job dọn.
      if (previous && isTempImagePath(previous)) await removeQuestionImage(previous);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được ảnh phương án.");
    } finally {
      setBusy(false);
    }
  }

  async function clear() {
    const previous = path;
    onChange("");
    if (previous && isTempImagePath(previous)) await removeQuestionImage(previous);
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      {src ? (
        <span className="relative">
          <img
            src={src}
            alt={`Ảnh ${label}`}
            className="size-9 rounded-lg border border-border object-cover"
          />
          <button
            type="button"
            aria-label={`Gỡ ảnh ${label}`}
            onClick={() => void clear()}
            className="absolute -right-1.5 -top-1.5 grid size-4 place-items-center rounded-full bg-destructive text-destructive-foreground"
          >
            <X className="size-3" />
          </button>
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Thêm ảnh cho ${label}`}
          title="Thêm ảnh cho phương án (có thể dán ảnh khi con trỏ đang ở ô này)"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
        </Button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void upload(file);
        }}
      />
    </div>
  );
}

/** Dùng chung cho việc dán ảnh từ clipboard vào đúng ô đang focus. */
export async function uploadPastedOptionImage(file: File, quizId: string) {
  const { path } = await uploadOptionImage(file, quizId);
  return path;
}
