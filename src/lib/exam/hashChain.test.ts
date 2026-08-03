import { describe, expect, it } from "vitest";

import {
  canonicalAnswers,
  genesisHash,
  linkHash,
  readChain,
  verifyChainLink,
  withChain,
} from "@/lib/exam/hashChain";

const SESSION = "11111111-1111-1111-1111-111111111111";

describe("canonicalAnswers", () => {
  it("chuẩn hoá theo thứ tự chỉ số, không phụ thuộc thứ tự khoá", () => {
    expect(canonicalAnswers({ "10": 1, "2": 0 })).toBe(canonicalAnswers({ "2": 0, "10": 1 }));
    expect(canonicalAnswers({ "1": 0 })).not.toBe(canonicalAnswers({ "1": 1 }));
  });
});

describe("verifyChainLink", () => {
  it("chấp nhận mắt xích đúng và trả về đầu chuỗi mới", async () => {
    const head = await genesisHash(SESSION);
    const delta = { "0": 2 };
    const hash = await linkHash(head, 1, delta);
    const res = await verifyChainLink({
      expectedHead: head,
      established: false,
      seq: 1,
      delta,
      chainPrev: head,
      chainHash: hash,
    });
    expect(res).toEqual({ ok: true, head: hash });
  });

  it("từ chối khi gửi lại gói cũ (prev không khớp đầu chuỗi)", async () => {
    const head = await genesisHash(SESSION);
    const delta = { "0": 2 };
    const hash = await linkHash(head, 1, delta);
    const res = await verifyChainLink({
      expectedHead: "f".repeat(64),
      established: true,
      seq: 1,
      delta,
      chainPrev: head,
      chainHash: hash,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("fork");
  });

  it("từ chối khi đáp án bị sửa/ghép so với mã băm", async () => {
    const head = await genesisHash(SESSION);
    const hash = await linkHash(head, 1, { "0": 2 });
    const res = await verifyChainLink({
      expectedHead: head,
      established: true,
      seq: 1,
      delta: { "0": 2, "1": 3 },
      chainPrev: head,
      chainHash: hash,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("mismatch");
  });

  it("từ chối gói không có mắt xích khi chuỗi đã hình thành", async () => {
    const head = await genesisHash(SESSION);
    const res = await verifyChainLink({
      expectedHead: head,
      established: true,
      seq: 2,
      delta: { "0": 1 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe("missing");
  });

  it("mắt xích của phiên này không dùng lại được cho phiên khác", async () => {
    const a = await genesisHash(SESSION);
    const b = await genesisHash("22222222-2222-2222-2222-222222222222");
    expect(a).not.toBe(b);
  });
});

describe("readChain/withChain", () => {
  it("giữ nguyên các khoá khác trong helpers", async () => {
    const head = await genesisHash(SESSION);
    const helpers = withChain({ checked: [1, 2] }, head, 5);
    expect(helpers["checked"]).toEqual([1, 2]);
    expect(readChain(helpers)).toEqual({ head, seq: 5 });
  });

  it("bỏ qua dữ liệu chuỗi hỏng", () => {
    expect(readChain({ chain: { head: "abc" } })).toBeNull();
    expect(readChain(null)).toBeNull();
  });
});
