import { createFileRoute, Link } from "@tanstack/react-router";
import { ClipboardList, ShieldCheck, Timer, Trophy } from "lucide-react";

import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/huong-dan")({
  head: () => ({
    meta: [
      { title: "Hướng dẫn & câu hỏi thường gặp | Hội thi trắc nghiệm" },
      {
        name: "description",
        content:
          "Giải đáp quy trình dự thi, cách tính giờ theo máy chủ, cách chấm điểm và xếp hạng của hệ thống thi trắc nghiệm trực tuyến.",
      },
      { property: "og:title", content: "Hướng dẫn & câu hỏi thường gặp" },
      {
        property: "og:description",
        content: "Quy trình dự thi, cách tính giờ và cách chấm điểm trong hệ thống thi trắc nghiệm trực tuyến.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FaqPage,
});

const steps = [
  {
    icon: ClipboardList,
    title: "1. Đăng ký",
    text: "Chọn cuộc thi đang mở và nhập họ tên. Năm sinh, đơn vị là tuỳ chọn.",
  },
  { icon: Timer, title: "2. Làm bài", text: "Đề bốc ngẫu nhiên, đồng hồ chạy theo phiên thi trên máy chủ." },
  { icon: ShieldCheck, title: "3. Nộp bài", text: "Nộp thủ công hoặc hệ thống tự nộp khi hết giờ." },
  { icon: Trophy, title: "4. Xem kết quả", text: "Điểm hiện ngay, kèm phần xem lại bài làm và bảng xếp hạng." },
];

const faqs = [
  {
    q: "Quy trình dự thi diễn ra như thế nào?",
    a: "Tại trang chủ, bạn chọn cuộc thi đang ở trạng thái “Đang mở”, nhập họ tên (bắt buộc) và bổ sung năm sinh, đơn vị nếu muốn hiển thị trong bảng xếp hạng. Bấm “Bắt đầu làm bài” để mở phiên thi. Mỗi lần bắt đầu là một phiên thi độc lập với bộ đề riêng.",
  },
  {
    q: "Thời gian làm bài được tính ra sao?",
    a: "Thời điểm bắt đầu và thời điểm hết hạn của phiên thi do máy chủ ghi nhận, không phụ thuộc đồng hồ máy tính của bạn. Đồng hồ đếm ngược trên màn hình chỉ hiển thị lại phần thời gian còn lại của phiên. Nếu bạn tải lại trang hay đổi giờ máy, thời gian còn lại vẫn giữ nguyên theo máy chủ. Khi hết giờ, hệ thống tự động nộp bài với các câu đã trả lời.",
  },
  {
    q: "Bài thi được chấm như thế nào?",
    a: "Mỗi câu đúng được 1 điểm, câu sai hoặc bỏ trống được 0 điểm; không trừ điểm. Việc chấm thực hiện hoàn toàn trên máy chủ sau khi bạn nộp bài, đáp án không được gửi xuống trình duyệt trong lúc làm bài.",
  },
  {
    q: "Cách xếp hạng khi trùng điểm?",
    a: "Bảng xếp hạng sắp xếp theo điểm từ cao xuống thấp. Nếu bằng điểm, thí sinh có thời gian làm bài ngắn hơn sẽ xếp trên. Bài thi bị huỷ do vi phạm không xuất hiện trong bảng xếp hạng.",
  },
  {
    q: "Đề thi của mỗi người có giống nhau không?",
    a: "Không. Câu hỏi được bốc ngẫu nhiên từ ngân hàng câu hỏi của cuộc thi và thứ tự phương án cũng có thể được xáo trộn cho từng thí sinh.",
  },
  {
    q: "Những hành vi nào bị coi là vi phạm?",
    a: "Rời khỏi màn hình thi (chuyển tab, thu nhỏ cửa sổ) sẽ bị cảnh báo. Quá 3 lần, bài thi bị huỷ kết quả và vẫn được ghi nhận trong hệ thống quản trị. Thao tác sao chép và chuột phải bị vô hiệu trong phòng thi.",
  },
  {
    q: "Tôi có thể thi lại không?",
    a: "Bạn có thể bắt đầu một phiên thi mới khi cuộc thi còn trong thời gian mở. Mỗi lần nộp bài đều được lưu thành một kết quả riêng.",
  },
  {
    q: "Mất mạng hoặc đóng nhầm trình duyệt thì sao?",
    a: "Phiên thi vẫn tính giờ trên máy chủ. Nếu chưa nộp bài trước khi hết hạn, phiên đó sẽ không có kết quả; bạn nên bắt đầu lại khi cuộc thi còn mở.",
  },
];

function FaqPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="surface-hero grid-pattern pb-16">
        <SiteHeader variant="onDark" />
        <div className="mx-auto max-w-4xl px-4 pb-6 pt-8 text-center">
          <h1 className="font-heading text-3xl font-extrabold sm:text-4xl">Hướng dẫn dự thi</h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-primary-foreground/80">
            Quy trình dự thi, cách tính giờ và cách chấm điểm của hệ thống.
          </p>
        </div>
      </div>

      <main className="sheet-panel">
        <div className="mx-auto max-w-4xl px-4 pb-14 pt-8">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.title} className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
                <span className="grid size-10 place-items-center rounded-2xl bg-accent/15 text-accent">
                  <s.icon className="size-5" />
                </span>
                <p className="mt-3 font-heading font-bold">{s.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            ))}
          </div>

          <h2 className="mt-10 font-heading text-xl font-bold sm:text-2xl">Câu hỏi thường gặp</h2>
          <Accordion type="single" collapsible className="mt-4">
            {faqs.map((f) => (
              <AccordionItem key={f.q} value={f.q} className="border-border">
                <AccordionTrigger className="text-left font-semibold">{f.q}</AccordionTrigger>
                <AccordionContent className="text-sm leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-10 flex flex-col gap-3 rounded-3xl border border-border bg-secondary/50 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-heading font-bold">Sẵn sàng dự thi?</p>
              <p className="text-sm text-muted-foreground">Chọn cuộc thi đang mở và bắt đầu ngay.</p>
            </div>
            <div className="flex gap-3">
              <Button asChild className="rounded-full">
                <Link to="/">Đăng ký dự thi</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-full">
                <Link to="/bang-xep-hang">Bảng xếp hạng</Link>
              </Button>
            </div>
          </div>
        </div>
        <SiteFooter />
      </main>
    </div>
  );
}
