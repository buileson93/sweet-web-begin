import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Hộp thoại xác nhận nộp bài và thoát phòng thi. */
export function ExamDialogs({
  confirmOpen,
  onConfirmOpenChange,
  exitOpen,
  onExitOpenChange,
  answeredCount,
  total,
  sending,
  onSubmit,
  onExit,
}: {
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  exitOpen: boolean;
  onExitOpenChange: (open: boolean) => void;
  answeredCount: number;
  total: number;
  sending: boolean;
  onSubmit: () => void;
  onExit: () => void;
}) {
  return (
    <>
      <AlertDialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xác nhận nộp bài?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn đã trả lời {answeredCount}/{total} câu. Sau khi nộp sẽ không thể chỉnh sửa, nhưng
              bạn luôn có thể thi lại để cải thiện điểm số.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục làm bài</AlertDialogCancel>
            <AlertDialogAction onClick={onSubmit} disabled={sending}>
              {sending && <Loader2 className="size-4 animate-spin" />}
              Nộp bài
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={exitOpen} onOpenChange={onExitOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Thoát bài thi?</AlertDialogTitle>
            <AlertDialogDescription>
              Lượt thi này sẽ bị huỷ và không được tính điểm. Bạn có thể bắt đầu lượt thi mới bất cứ
              lúc nào.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại làm bài</AlertDialogCancel>
            <AlertDialogAction onClick={onExit}>Thoát</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
