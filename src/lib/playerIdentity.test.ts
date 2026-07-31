import { describe, expect, it } from "vitest";

import {
  clearPlayerIdentity,
  normalizeIdentity,
  readPlayerIdentity,
  savePlayerIdentity,
} from "@/lib/playerIdentity";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
}

describe("playerIdentity", () => {
  it("từ chối dữ liệu thiếu mã nhân viên hoặc tên", () => {
    expect(normalizeIdentity(null)).toBeNull();
    expect(normalizeIdentity({ employeeId: "e1" })).toBeNull();
    expect(normalizeIdentity({ displayName: "Thảo" })).toBeNull();
  });

  it("chuẩn hoá cấp độ và phần trăm về khoảng hợp lệ", () => {
    const id = normalizeIdentity({
      employeeId: "e1",
      displayName: "Phương Thảo",
      level: 0,
      percent: 180,
      into: -5,
    });
    expect(id).toMatchObject({ level: 1, percent: 100, into: 0, need: 100 });
  });

  it("lưu, đọc lại và xoá được nhận diện", () => {
    const store = memoryStorage();
    savePlayerIdentity(
      { employeeId: "e1", displayName: "Thảo", unit: "Kỹ thuật", level: 4, percent: 42, into: 20, need: 250 },
      store,
    );
    expect(readPlayerIdentity(store)).toMatchObject({ displayName: "Thảo", level: 4, need: 250 });
    clearPlayerIdentity(store);
    expect(readPlayerIdentity(store)).toBeNull();
  });

  it("bỏ qua dữ liệu hỏng trong bộ nhớ", () => {
    const store = memoryStorage();
    store.setItem("player:identity:v1", "{khong-phai-json");
    expect(readPlayerIdentity(store)).toBeNull();
  });
});
