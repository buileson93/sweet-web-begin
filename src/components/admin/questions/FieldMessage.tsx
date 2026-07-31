import { cn } from "@/lib/utils";

/** Thông báo lỗi (đỏ) hoặc cảnh báo (vàng) hiển thị ngay dưới trường nhập. */
export function FieldMessage({
  error,
  warning,
}: {
  error?: string | null;
  warning?: string | null;
}) {
  const text = error || warning;
  if (!text) return null;
  return (
    <p
      role={error ? "alert" : undefined}
      className={cn("text-xs font-medium", error ? "text-destructive" : "text-warning")}
    >
      {text}
    </p>
  );
}
