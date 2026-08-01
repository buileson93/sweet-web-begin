import { beforeEach, describe, expect, it } from "vitest";

import { QUICK_LOGIN_TTL_MS, clearQuickLogin, readQuickLogin, saveQuickLogin } from "@/lib/quickLogin";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

let storage = memoryStorage();
beforeEach(() => {
  storage = memoryStorage();
});

describe("quickLogin", () => {
  it("nhớ họ tên và 4 số cuối trong 3 giờ", () => {
    saveQuickLogin({ name: " Vũ Hồng Sơn ", credential: " 5195 " }, storage, 0);
    expect(readQuickLogin(storage, QUICK_LOGIN_TTL_MS - 1)).toEqual({
      name: "Vũ Hồng Sơn",
      credential: "5195",
    });
  });

  it("hết hiệu lực sau 3 giờ", () => {
    saveQuickLogin({ name: "A B", credential: "1234" }, storage, 0);
    expect(readQuickLogin(storage, QUICK_LOGIN_TTL_MS + 1)).toBeNull();
    expect(readQuickLogin(storage, 0)).toBeNull(); // đã bị xoá khỏi bộ nhớ
  });

  it("bỏ qua khi thiếu dữ liệu hoặc JSON hỏng", () => {
    saveQuickLogin({ name: "  ", credential: "1234" }, storage, 0);
    expect(readQuickLogin(storage, 0)).toBeNull();
    storage.setItem("vatm:quick-login:v1", "{hỏng");
    expect(readQuickLogin(storage, 0)).toBeNull();
  });

  it("giữ thông tin phụ khi có trùng họ tên và xoá được", () => {
    saveQuickLogin({ name: "A B", credential: "1234", extraCredential: "01/02/1990" }, storage, 0);
    expect(readQuickLogin(storage, 0)?.extraCredential).toBe("01/02/1990");
    clearQuickLogin(storage);
    expect(readQuickLogin(storage, 0)).toBeNull();
  });
});
