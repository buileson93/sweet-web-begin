import type { TourStep } from "@/components/ProductTour";

/** Các bước giới thiệu nhanh giao diện phòng thi cho người thi lần đầu. */
export const EXAM_TOUR_STEPS: TourStep[] = [
  {
    target: "exam-question",
    title: "Nội dung câu hỏi",
    description:
      "Đề bài và hình minh hoạ (nếu có) hiển thị tại đây. Câu hỏi được trộn ngẫu nhiên cho mỗi lượt thi.",
  },
  {
    target: "exam-options",
    title: "Chọn đáp án",
    description:
      "Bấm vào một phương án để chọn. Bạn có thể đổi đáp án bất cứ lúc nào trước khi nộp bài.",
  },
  {
    target: "exam-nav",
    title: "Danh sách câu hỏi",
    description: "Ô sáng màu là câu đã trả lời. Bấm số thứ tự để nhảy nhanh tới câu bất kỳ.",
  },
];
