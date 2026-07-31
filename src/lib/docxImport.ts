/**
 * Đọc đề thi soạn bằng Word (.docx) ngay trên trình duyệt.
 * Dùng mammoth để chuyển sang HTML, giữ chữ in đậm và trích xuất ảnh nhúng,
 * sau đó đưa về dạng văn bản chuẩn cho bộ phân tích thuần `docxParse`.
 */
import { parseDocxQuestions } from "@/lib/docxParse";
import { parsedToDraft, type ImportDraft } from "@/lib/questionImport";

const BLOCK_TAGS = new Set(["P", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TD", "TH", "DIV"]);
const BOLD_TAGS = new Set(["STRONG", "B"]);

/** Nối nội dung một khối, bọc phần in đậm bằng `**` và tách ảnh ra dòng riêng. */
function blockToText(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      out += child.textContent ?? "";
      return;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const el = child as HTMLElement;
    if (el.tagName === "IMG") {
      const ref = el.getAttribute("src") ?? "";
      const m = /^#img-(\d+)$/.exec(ref);
      out += `\n[[IMG:${m ? m[1] : 0}]]\n`;
      return;
    }
    if (el.tagName === "BR") {
      out += "\n";
      return;
    }
    const inner = blockToText(el);
    out += BOLD_TAGS.has(el.tagName) && inner.trim() ? `**${inner.trim()}**` : inner;
  });
  return out;
}

/** Chuyển HTML do mammoth sinh ra thành văn bản mỗi đoạn một dòng. */
export function htmlToLines(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: string[] = [];
  doc.body.querySelectorAll("*").forEach((el) => {
    if (!BLOCK_TAGS.has(el.tagName)) return;
    if (el.querySelector(BLOCK_TAGS_SELECTOR)) return; // bỏ khối lồng ngoài
    blocks.push(blockToText(el));
  });
  if (blocks.length === 0) blocks.push(blockToText(doc.body));
  return blocks.join("\n");
}

const BLOCK_TAGS_SELECTOR = "p, li, h1, h2, h3, h4, h5, h6, td, th, div";

export type DocxImportResult = { drafts: ImportDraft[]; images: File[] };

/** Đọc tệp .docx và trả về danh sách câu hỏi kèm ảnh nhúng theo thứ tự. */
export async function readDocxQuestions(file: File): Promise<DocxImportResult> {
  const mammoth = (await import("mammoth/mammoth.browser.js")) as unknown as {
    convertToHtml: (
      input: { arrayBuffer: ArrayBuffer },
      options: Record<string, unknown>,
    ) => Promise<{ value: string }>;
    images: {
      imgElement: (
        fn: (image: {
          contentType: string;
          read: (encoding: string) => Promise<string>;
        }) => Promise<{ src: string }>,
      ) => unknown;
    };
  };

  const images: File[] = [];
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.convertToHtml(
    { arrayBuffer },
    {
      convertImage: mammoth.images.imgElement(async (image) => {
        const index = images.length;
        const base64 = await image.read("base64");
        const mime = image.contentType || "image/png";
        const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "png";
        images.push(new File([base64ToBytes(base64)], `docx-${index}.${ext}`, { type: mime }));
        return { src: `#img-${index}` };
      }),
    },
  );

  const drafts = parseDocxQuestions(htmlToLines(value)).map((q, i) => parsedToDraft(q, i + 1));
  return { drafts, images };
}

function base64ToBytes(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}
