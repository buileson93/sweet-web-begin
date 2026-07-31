import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState } from "@/components/ui-kit";
import { listAssets, removeAsset, uploadAsset } from "@/lib/assets.functions";
import { compressImage } from "@/lib/questionImage";
import { cn } from "@/lib/utils";

const TAGS = ["hàng không", "tiết kiệm", "an toàn", "đảng - đoàn", "kỹ thuật", "khác"];

function toBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Không đọc được tệp ảnh."));
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.readAsDataURL(blob);
  });
}

/**
 * Kho ảnh dùng chung cho người thiết kế cuộc thi: tìm nhanh theo tên/thẻ,
 * tải ảnh mới lên và chọn làm ảnh bìa chỉ bằng một cú nhấp.
 */
export function AssetLibrary({
  canEdit = true,
  onPick,
  selected,
  compact,
}: {
  canEdit?: boolean;
  onPick?: (storagePath: string) => void;
  selected?: string;
  compact?: boolean;
}) {
  const qc = useQueryClient();
  const runList = useServerFn(listAssets);
  const runUpload = useServerFn(uploadAsset);
  const runRemove = useServerFn(removeAsset);

  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["quiz-assets", search, tag],
    queryFn: () => runList({ data: { search: search || undefined, tag: tag || undefined } }),
    staleTime: 30_000,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const { blob, mime } = await compressImage(file, { maxEdge: 1600, targetBytes: 320 * 1024 });
      const base64 = await toBase64(blob);
      const contentType = mime === "image/png" || mime === "image/webp" ? mime : "image/jpeg";
      return runUpload({
        data: {
          title: file.name.replace(/\.[^.]+$/, "").slice(0, 120),
          tags: tag ? [tag] : [],
          contentType,
          base64,
          width: 0,
          height: 0,
        },
      });
    },
    onSuccess: () => {
      toast.success("Đã thêm ảnh vào kho");
      void qc.invalidateQueries({ queryKey: ["quiz-assets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Không tải được ảnh"),
  });

  const del = useMutation({
    mutationFn: (id: string) => runRemove({ data: { id } }),
    onSuccess: () => {
      toast.success("Đã xoá khỏi kho");
      void qc.invalidateQueries({ queryKey: ["quiz-assets"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Không xoá được ảnh"),
  });

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm ảnh theo tên…"
            className="pl-9"
          />
        </div>
        {canEdit ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) upload.mutate(f);
              }}
            />
            <Button type="button" variant="outline" disabled={upload.isPending} onClick={() => inputRef.current?.click()}>
              {upload.isPending ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
              Tải ảnh lên kho
            </Button>
          </>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button type="button" size="sm" variant={tag ? "outline" : "default"} onClick={() => setTag("")}>
          Tất cả
        </Button>
        {TAGS.map((t) => (
          <Button key={t} type="button" size="sm" variant={tag === t ? "default" : "outline"} onClick={() => setTag(t)}>
            {t}
          </Button>
        ))}
      </div>

      {query.isError ? (
        <ErrorState title="Không tải được kho ảnh" error={query.error} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[12/5] animate-pulse rounded-xl bg-secondary" />
          ))}
        </div>
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState icon={ImagePlus} title="Kho ảnh còn trống" description="Tải ảnh ngang (PNG/JPG) để dùng lại cho nhiều cuộc thi." />
      ) : (
        <div className={cn("grid gap-3", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4")}>
          {(query.data ?? []).map((a) => (
            <figure
              key={a.id}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-secondary/40 transition-shadow hover:shadow-md",
                selected === a.storagePath ? "border-primary ring-2 ring-primary/30" : "border-border",
              )}
            >
              <button
                type="button"
                onClick={() => onPick?.(a.storagePath)}
                className="block aspect-[12/5] w-full"
                title={onPick ? "Dùng ảnh này" : a.title}
              >
                <img src={a.url} alt={a.title} loading="lazy" decoding="async" className="size-full object-cover" />
              </button>
              <figcaption className="flex items-center justify-between gap-2 px-2 py-1.5">
                <span className="truncate text-xs text-muted-foreground">{a.title}</span>
                {canEdit ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 shrink-0"
                    disabled={del.isPending}
                    onClick={() => del.mutate(a.id)}
                    aria-label="Xoá ảnh"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
