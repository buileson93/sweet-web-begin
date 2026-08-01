import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

import { cn } from "@/lib/utils";

/**
 * Hiển thị nội dung Markdown + công thức toán (KaTeX) cho đề bài, phương án và giải thích.
 * Cú pháp: **đậm**, *nghiêng*, `mã`, danh sách, bảng, $x^2$ (nội dòng) và $$...$$ (khối).
 * Chỉ render, không cho HTML thô nên an toàn với nội dung do quản trị viên nhập.
 */
export const RichText = memo(function RichText({
  children,
  className,
  inline = false,
}: {
  children: string | null | undefined;
  className?: string;
  /** Bố cục gọn một dòng — dùng cho phương án trả lời. */
  inline?: boolean;
}) {
  const text = (children ?? "").trim();
  if (!text) return null;
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
