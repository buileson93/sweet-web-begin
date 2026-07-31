import { useCallback, useEffect, useState } from "react";

import {
  clearPlayerIdentity,
  PLAYER_IDENTITY_EVENT,
  readPlayerIdentity,
  savePlayerIdentity,
  type PlayerIdentity,
} from "@/lib/playerIdentity";

/**
 * Nhận diện nhân vật hiện tại (avatar, cấp độ, kinh nghiệm) dùng chung mọi trang.
 * Đọc sau khi hydrate để tránh lệch nội dung giữa máy chủ và trình duyệt.
 */
export function usePlayerIdentity() {
  const [identity, setIdentity] = useState<PlayerIdentity | null>(null);

  useEffect(() => {
    const sync = () => setIdentity(readPlayerIdentity());
    sync();
    window.addEventListener(PLAYER_IDENTITY_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PLAYER_IDENTITY_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const save = useCallback((value: unknown) => {
    setIdentity(savePlayerIdentity(value));
  }, []);

  const clear = useCallback(() => {
    clearPlayerIdentity();
    setIdentity(null);
  }, []);

  return { identity, save, clear };
}
