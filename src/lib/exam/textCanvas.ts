/**
 * Utility để vẽ văn bản lên Canvas và chuyển thành ảnh (Image-based protection).
 * Mục tiêu: Chống script cào DOM bằng cách không để text thô xuất hiện trong HTML.
 */

export type RenderOptions = {
  width?: number;
  fontSize?: number;
  lineHeight?: number;
  color?: string;
  fontFamily?: string;
  padding?: number;
  noise?: boolean;
};

/**
 * Vẽ text lên canvas với nhiễu nhẹ để chống OCR đơn giản.
 */
export async function renderTextToImage(
  text: string,
  options: RenderOptions = {}
): Promise<string> {
  // Đảm bảo font đã được tải hoàn toàn trước khi vẽ
  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.ready;
    } catch (e) {
      console.warn("Font loading failed, proceeding with default fonts", e);
    }
  }

  const {
    width = 800,
    fontSize = 16,
    lineHeight = 1.5,
    color = "#ffffff",
    fontFamily = "Inter, system-ui, -apple-system, sans-serif",
    padding = 10,
    noise = true,
  } = options;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return "";

  // Thiết lập font để đo đạc
  ctx.font = `${fontSize}px ${fontFamily}`;
  
  // Xử lý xuống dòng đơn giản
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  const maxWidth = width - padding * 2;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  // Tính toán kích thước canvas thực tế
  const contentHeight = lines.length * fontSize * lineHeight;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  
  // Set kích thước hiển thị
  canvas.width = width * dpr;
  canvas.height = (contentHeight + padding * 2) * dpr;
  
  // Scale context để vẽ bình thường nhưng độ phân giải cao hơn
  ctx.scale(dpr, dpr);
  
  // Style để responsive
  canvas.style.width = `${width}px`;
  canvas.style.height = `${contentHeight + padding * 2}px`;

  // Style để responsive
  canvas.style.width = `${width}px`;
  canvas.style.height = `${contentHeight + padding * 2}px`;

  // Thiết lập state vẽ (font cần set LẠI sau mỗi lần resize canvas)
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";

  // Vẽ nền trong suốt
  ctx.clearRect(0, 0, width, contentHeight + padding * 2);

  // Vẽ text
  lines.forEach((line, i) => {
    ctx.fillText(line, padding, padding + i * fontSize * lineHeight);
  });

  // Thêm nhiễu nhẹ (Noise)
  if (noise) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      // Chỉ tác động vào các pixel có màu (alpha > 0)
      if (data[i + 3]! > 0) {
        const n = (Math.random() - 0.5) * 20; // Nhiễu +/- 10
        data[i] = Math.max(0, Math.min(255, data[i]! + n));
        data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + n));
        data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + n));
      }
      
      // Thêm một vài điểm ảnh nhiễu ngẫu nhiên vào nền
      if (Math.random() < 0.001) {
        data[i] = 128;
        data[i + 1] = 128;
        data[i + 2] = 128;
        data[i + 3] = 20; // Rất mờ
      }
    }
    ctx.putImageData(imageData, 0, 0);

    // Vẽ thêm một vài đường kẻ siêu mảnh, mờ
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.05;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * width, 0);
      ctx.lineTo(Math.random() * width, contentHeight + padding * 2);
      ctx.stroke();
    }
  }

  return canvas.toDataURL("image/png");
}
