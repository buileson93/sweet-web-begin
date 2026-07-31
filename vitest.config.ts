import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Cấu hình kiểm thử: alias "@/" lấy từ tsconfig, môi trường mặc định là node.
// Ghi chú: các file *.dom.test.ts cần jsdom — chưa cài package jsdom nên tạm thời
// chưa bật project jsdom (xin phép trước khi thêm dependency).
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: false,
  },
});
