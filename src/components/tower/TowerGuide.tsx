import { useEffect, useState } from "react";
import { HelpCircle, Keyboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const SEEN_KEY = "vatm:tower:guide-seen";

const STEPS: { title: string; body: string }[] = [
  {
    title: "1. Chọn đường đi trên bản đồ",
    body: "Bản đồ 12 tầng đi từ dưới lên. Mỗi tầng bạn chọn một phòng: chạm vào nút để xem mô tả, chạm lần nữa để vào. Nút mờ có dấu ✓ là chặng đã đi qua.",
  },
  {
    title: "2. Trả lời để gây điểm xử lý",
    body: "Đúng thì đánh trúng phòng, sai thì bạn mất an toàn. Sai một câu không bị loại — chỉ khi thanh an toàn về 0 hành trình mới khép lại.",
  },
  {
    title: "3. An toàn, lớp bảo vệ và hồi phục",
    body: "Thanh an toàn ở đầu màn hình cho biết còn bao nhiêu; phần xanh dương là lớp bảo vệ chịu đòn thay bạn. Phòng nghỉ ca, kho khí tài và một số trang bị sẽ hồi an toàn.",
  },
  {
    title: "4. Trang bị, hỗ trợ kíp trực và yếu tố bất lợi",
    body: "Sau mỗi phòng bạn lật ba lá bài để chọn một trang bị. Gom đủ 3 món cùng hệ được thưởng bộ. Yếu tố bất lợi là tự nguyện: chịu bất lợi để đổi lấy tín chỉ và điểm cao hơn.",
  },
  {
    title: "5. Xem lại mọi thứ",
    body: "Nút Hành trang liệt kê trang bị, thưởng bộ và yếu tố bất lợi đang có. Kết thúc hành trình có bảng nguồn gốc điểm và dòng thời gian diễn biến theo hạt ngẫu nhiên.",
  },
];

/**
 * Hướng dẫn thao tác Tháp — tự bật lần đầu, sau đó nằm ở nút dấu hỏi.
 * Ghi nhớ bằng localStorage nên không làm phiền người chơi quen.
 */
export function TowerGuide() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* bỏ qua khi trình duyệt chặn localStorage */
    }
  }, []);

  function close() {
    setOpen(false);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* bỏ qua */
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full px-3">
          <HelpCircle className="size-4" />
          <span className="text-xs font-semibold">Hướng dẫn</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="text-left">
          <DialogTitle>Chơi Tháp Không Lưu thế nào?</DialogTitle>
          <DialogDescription>Năm điều cần biết trước khi bước vào tầng một.</DialogDescription>
        </DialogHeader>
        <ol className="space-y-2.5">
          {STEPS.map((s) => (
            <li key={s.title} className="rounded-xl border bg-card/60 p-3">
              <p className="text-sm font-semibold">{s.title}</p>
              <p className="type-meta mt-0.5">{s.body}</p>
            </li>
          ))}
        </ol>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Keyboard className="size-4" /> Phím tắt trên máy tính
          </p>
          <ul className="type-meta mt-1 space-y-0.5">
            <li>← → : chuyển giữa các phòng của tầng hiện tại</li>
            <li>Enter hoặc Space : vào phòng đang chọn</li>
            <li>1 – 4 : chọn nhanh đáp án khi đang trả lời</li>
            <li>Tab : di chuyển giữa bản đồ, thẻ bài và nút hành động</li>
          </ul>
        </div>
        <DialogFooter>
          <Button onClick={close}>Đã hiểu, vào tháp</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
