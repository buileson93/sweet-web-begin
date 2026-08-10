/**
 * VATM Fingerprint v1 - Công nghệ định danh thiết bị không phụ thuộc cookie/localStorage.
 * Kết hợp nhiều đặc điểm phần cứng và trình duyệt để tạo ra một chữ ký số bền vững.
 */

/** Hàm băm FNV-1a nhỏ gọn để tạo chuỗi định danh từ dữ liệu thô. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** 1. Canvas Fingerprinting: Vẽ văn bản ẩn để phát hiện sai khác đồ họa/driver. */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    canvas.width = 200;
    canvas.height = 50;
    
    // Vẽ nền
    ctx.fillStyle = '#f60';
    ctx.fillRect(10, 10, 50, 20);
    
    // Vẽ chữ với font và hiệu ứng đặc biệt
    ctx.fillStyle = '#069';
    ctx.font = '14px Arial';
    ctx.fillText('VATM AntiCheat 2026', 15, 30);
    
    // Vẽ bóng và ký tự lạ
    ctx.strokeStyle = 'rgba(102, 204, 0, 0.7)';
    ctx.strokeText('VATM AntiCheat 2026', 16, 31);
    
    return hash(canvas.toDataURL());
  } catch {
    return 'canvas_err';
  }
}

/** 2. WebGL Fingerprinting: Thu thập thông tin card đồ họa. */
function getWebGLFingerprint(): string {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) return 'no_webgl';
    
    const debugInfo = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return 'no_webgl_info';
    
    const renderer = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = (gl as WebGLRenderingContext).getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    
    return hash(`${vendor}|${renderer}`);
  } catch {
    return 'webgl_err';
  }
}

/** 3. Hardware Entropy: Thu thập cấu hình phần cứng cơ bản. */
function getHardwareEntropy(): string {
  const nav = navigator as Navigator & { deviceMemory?: number; hardwareConcurrency?: number };
  const screen = window.screen || {};
  
  const data = [
    nav.hardwareConcurrency || 0, // số nhân CPU
    nav.deviceMemory || 0,        // dung lượng RAM (GB)
    screen.width, screen.height,  // độ phân giải màn hình
    screen.availWidth, screen.availHeight, // kích thước khả dụng (trừ taskbar)
    screen.colorDepth,            // độ sâu màu
    new Date().getTimezoneOffset(), // múi giờ
    nav.language,                 // ngôn ngữ
    nav.platform,                 // nền tảng
  ];
  
  return hash(data.join('|'));
}

/** 
 * Tạo mã định danh thiết bị VATM Fingerprint v1.
 * Kết quả là một chuỗi 3 phần, ví dụ: "c1234567-w890abcd-h1234567"
 */
export async function getVATMFingerprint(): Promise<string> {
  if (typeof window === 'undefined') return '';
  
  const canvas = getCanvasFingerprint();
  const webgl = getWebGLFingerprint();
  const hardware = getHardwareEntropy();
  
  return `v1-${canvas}-${webgl}-${hardware}`;
}
