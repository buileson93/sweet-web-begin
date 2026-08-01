import { useMemo } from "react";

import { avatarDataUri, decodeAvatar, type AvatarSpec } from "@/lib/avatar2d";
import { cn } from "@/lib/utils";

/**
 * Nhân vật 2D dạng SVG (DiceBear) — nhẹ, không WebGL, hợp phong cách phẳng của web.
 * Truyền `spec` để dựng theo mô tả cụ thể, hoặc `value`/`name` để tự suy ra.
 */
export function Avatar2D({
  value,
  name,
  spec,
  className,
  alt,
}: {
  value?: string;
  name?: string;
  spec?: AvatarSpec;
  className?: string;
  alt?: string;
}) {
  const uri = useMemo(() => avatarDataUri(spec ?? decodeAvatar(value, name || "VATM")), [spec, value, name]);
  return (
    <img
      src={uri}
      alt={alt ?? (name ? `Nhân vật của ${name}` : "Nhân vật")}
      decoding="sync"
      draggable={false}
      className={cn("size-full object-contain", className)}
    />
  );
}

export default Avatar2D;
