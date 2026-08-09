/**
 * Phân tích sinh trắc học hành vi (Behavioral Biometrics).
 *
 * Mục tiêu: Phân biệt người thật và script dựa trên quỹ đạo chuột và tọa độ click.
 * - Người thật: Quỹ đạo cong, vận tốc thay đổi, tọa độ click lệch ngẫu nhiên.
 * - Script: Quỹ đạo thẳng tắp hoặc nhảy vọt, tọa độ click thường vào tâm tuyệt đối (pixel-perfect).
 */

export type Point = { x: number; y: number; t: number };

export type ClickStats = {
  /** Khoảng cách từ điểm click tới tâm của phần tử (0-1, 0 là chính tâm). */
  offsetFromCenter: number;
  /** Tọa độ click tuyệt đối để so sánh giữa các lần bấm. */
  x: number;
  y: number;
};

/** Theo dõi quỹ đạo và hành vi thao tác. */
export function createBehaviorTracker() {
  let points: Point[] = [];
  const clicks: ClickStats[] = [];
  const MAX_POINTS = 50;
  const MAX_CLICKS = 10;

  return {
    /** Ghi nhận di chuyển chuột/touch. */
    move(x: number, y: number, t = Date.now()) {
      points.push({ x, y, t });
      if (points.length > MAX_POINTS) points.shift();
    },

    /** Ghi nhận một cú click/touch vào phương án. */
    click(event: { clientX: number; clientY: number }, target: HTMLElement) {
      const rect = target.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Tính khoảng cách từ điểm click tới tâm phần tử (chuẩn hóa theo kích thước nút)
      const dx = (event.clientX - centerX) / (rect.width / 2);
      const dy = (event.clientY - centerY) / (rect.height / 2);
      const offset = Math.sqrt(dx * dx + dy * dy);

      clicks.push({
        offsetFromCenter: offset,
        x: event.clientX,
        y: event.clientY,
      });

      if (clicks.length > MAX_CLICKS) clicks.shift();
    },

    /** Phân tích xem có dấu hiệu "máy móc" không. */
    analyze(): { robotic: boolean; signals: string[] } {
      const signals: string[] = [];

      // 1. Kiểm tra pixel-perfect click: Nếu nhiều lần click vào cùng một tọa độ chính xác
      if (clicks.length >= 5) {
        const uniqueCoordinates = new Set(clicks.map(c => `${c.x},${c.y}`)).size;
        if (uniqueCoordinates === 1) {
          signals.push("pixel_perfect_clicks");
        }

        // 2. Kiểm tra center-perfect click: Script thường click vào đúng tâm (0,0)
        // Cần Entropy: Con người thật hiếm khi bấm vào đúng tâm điểm 100% trong 5 lần liên tiếp.
        const avgOffset = clicks.reduce((sum, c) => sum + c.offsetFromCenter, 0) / clicks.length;
        if (avgOffset < 0.005) { // Tăng độ nhạy (0.5% tâm)
          signals.push("center_perfect_clicks");
        }
        
        // 3. Click Entropy (Độ lệch chuẩn cực thấp -> script)
        const offsets = clicks.map(c => c.offsetFromCenter);
        const mean = offsets.reduce((a, b) => a + b, 0) / offsets.length;
        const variance = offsets.reduce((a, b) => a + (b - mean) ** 2, 0) / offsets.length;
        if (variance < 0.0001 && clicks.length >= 8) {
          signals.push("unnatural_click_entropy");
        }
      }

      // 4. Phân tích quỹ đạo (chỉ áp dụng nếu có di chuyển chuột)
      if (points.length >= 10) {
        const movementType = analyzeTrajectory(points);
        if (movementType === "too_straight") {
          signals.push("robotic_trajectory");
        }
      }

      return {
        robotic: signals.length > 0,
        signals,
      };
    },

    reset() {
      points = [];
      clicks.length = 0;
    }
  };
}

/** Phân tích độ thẳng của quỹ đạo. */
function analyzeTrajectory(pts: Point[]): "natural" | "too_straight" | "jump" {
  if (pts.length < 3) return "natural";
  
  // Tính độ lệch so với đường thẳng nối điểm đầu và điểm cuối
  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const dist = Math.sqrt((end.x - start.x) ** 2 + (end.y - start.y) ** 2);
  
  if (dist < 10) return "natural"; // Di chuyển quá ngắn

  let maxDev = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]!;
    // Công thức tính khoảng cách từ điểm tới đường thẳng (Ax + By + C = 0)
    const area = Math.abs((end.y - start.y) * p.x - (end.x - start.x) * p.y + end.x * start.y - end.y * start.x);
    const dev = area / dist;
    maxDev = Math.max(maxDev, dev);
  }

  // Nếu độ lệch cực nhỏ (< 1px) trên quãng đường dài -> quá thẳng
  if (maxDev < 0.5 && dist > 50) return "too_straight";
  
  return "natural";
}

export const behaviorTracker = createBehaviorTracker();
