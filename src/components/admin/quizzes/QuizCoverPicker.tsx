import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { compressImage } from "@/lib/questionImage";
import { COVER_PRESETS, QUIZ_COVER_BUCKET, resolveQuizCover } from "@/lib/quizCover";
import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/** Chọn ảnh chìm cho thẻ cuộc thi: dùng ảnh dựng sẵn hoặc tải ảnh riêng lên. */
export function QuizCoverPicker({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const { blob, mime, ext } = await compressImage(file, { maxEdge: 1024, targetBytes: 140 * 1024 });
      const path = `covers/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(QUIZ_COVER_BUCKET)
        .upload(path, blob, { contentType: mime, cacheControl: "31536000", upsert: false });
      if (error) throw new Error(error.message);
      onChange(path);
      toast.success("Đã tải ảnh chìm lên");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không tải được ảnh");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>Ảnh chìm của thẻ cuộc thi</Label>
      <p className="text-xs text-muted-foreground">
        Ảnh hiển thị mờ phía sau thẻ ở trang chủ và trượt vào khi rê chuột. Nên dùng ảnh nét đơn, nền trong suốt.
      </p>

      <div className="flex flex-wrap gap-2">
        {COVER_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(p.id)}
            title={p.label}
            className={cn(
              "grid h-16 w-24 place-items-center overflow-hidden rounded-xl border bg-secondary/50 transition-colors",
              value === p.id ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50",
            )}
          >
            <img src={p.src} alt={p.label} loading="lazy" className="h-full w-full object-contain p-1 opacity-70" />
          </button>
        ))}

        {value && !value.startsWith("preset:") && (
          <span className="grid h-16 w-24 place-items-center overflow-hidden rounded-xl border border-primary ring-2 ring-primary/30">
            <img src={resolveQuizCover(value)} alt="Ảnh chìm riêng" className="h-full w-full object-contain p-1" />
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void upload(f);
          }}
        />
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
          Tải ảnh riêng
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange("")}>
            <Trash2 className="size-4" />
            Dùng ảnh mặc định
          </Button>
        )}
      </div>
    </div>
  );
}
