import { memo, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { cn } from "@/lib/utils";
import { renderTextToImage } from "@/lib/exam/textCanvas";


/**
 * Hiển thị nội dung Markdown + công thức toán (KaTeX) cho đề bài, phương án và giải thích.
 * Cú pháp: **đậm**, *nghiêng*, `mã`, danh sách, bảng, $x^2$ (nội dòng) và $$...$$ (khối).
 * Chỉ render, không cho HTML thô nên an toàn với nội dung do quản trị viên nhập.
 */
export const RichText = memo(function RichText({
  children,
  className,
  inline = false,
  secureMode = false,
}: {
  children: string | null | undefined;
  className?: string;
  /** Bố cục gọn một dòng — dùng cho phương án trả lời. */
  inline?: boolean;
  /** Chế độ bảo vệ: render văn bản thành ảnh để chống script cào DOM. */
  secureMode?: boolean;
}) {
  const text = (children ?? "").trim();
  const [imageSrc, setImageSrc] = useState<string | null>(null);

  useEffect(() => {
    if (secureMode && text) {
      renderTextToImage(text, {
        fontSize: inline ? 15 : 18,
        width: inline ? 600 : 900,
        color: "#ffffff",
      }).then(setImageSrc);
    } else {
      setImageSrc(null);
    }
  }, [secureMode, text, inline]);

  if (!text) return null;

  if (secureMode && imageSrc) {
    return (
      <div className={cn("rich-text-secure", className)}>
        <img
          src={imageSrc}
          alt="Nội dung bảo mật"
          className={cn(
            "max-w-full h-auto select-none pointer-events-none",
            inline ? "inline-block align-middle" : "block"
          )}
          loading="lazy"
        />
        {/* Hidden text for screen readers, but structured to be annoying for simple scripts */}
        <span className="sr-only">
          {text.split("").join("\u200B")}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rich-text break-words",
        inline ? "rich-text--inline" : "space-y-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        // Không cho ảnh Markdown tuỳ tiện: ảnh câu hỏi đi qua kho ảnh riêng.
        components={{ img: () => null }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
