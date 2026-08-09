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
  const {
    width = 800,
    fontSize = 16,
    lineHeight = 1.5,
    color = "#ffffff",
    fontFamily = "Inter, system-ui, sans-serif",
    padding = 10,
    noise = true,
  } = options;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
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
  canvas.width = width;
  canvas.height = contentHeight + padding * 2;

  // Vẽ nền trong suốt
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Thiết lập lại font sau khi đổi size canvas
  ctx.font = `${fontSize}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.textBaseline = "top";

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
      ctx.moveTo(Math.random() * canvas.width, 0);
      ctx.lineTo(Math.random() * canvas.width, canvas.height);
      ctx.stroke();
    }
  }

  return canvas.toDataURL("image/png");
}
