import { useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";

/**
 * Lắng nghe kênh riêng của nhân viên để nhận lời mời thách đấu NGAY LẬP TỨC
 * (không phải chờ vòng hỏi lại). Kênh do máy chủ phát, trình duyệt chỉ nghe.
 */
export function useArenaInviteChannel(employeeId: string | undefined, onEvent: () => void) {
  const cb = useRef(onEvent);
  cb.current = onEvent;

  useEffect(() => {
    if (!employeeId) return;
    const channel = supabase
      .channel(`arena-user:${employeeId}`)
      .on("broadcast", { event: "invite.new" }, () => cb.current())
      .on("broadcast", { event: "invite.accepted" }, () => cb.current())
      .on("broadcast", { event: "invite.declined" }, () => cb.current())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [employeeId]);
}
