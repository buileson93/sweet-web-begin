# Giai đoạn 3 + 4 — Cá nhân hoá và phục vụ tổ chức

Gộp hai giai đoạn cuối vào một file: cùng dựa trên dữ liệu đã tích luỹ, cùng
không đụng tới đường đi của kỳ thi.

## Giai đoạn 3 — Cá nhân hoá và chiều sâu

- [ ] `topic_ratings(employee_id, tag, rating, games)` — Elo **theo chủ đề**,
      tận dụng `Blueprint.tags`. Cập nhật một lệnh lúc kết phiên, không trigger.
- [ ] Chọn câu thích ứng nhắm xác suất đúng ~0,8 (độ khó mong muốn).
- [ ] **Bản đồ năng lực**: lưới chủ đề tô màu theo mức thành thạo —
      là **một tab trong trang Thống kê sẵn có**, không phải trang mới.
- [ ] Bản đồ phân nhánh 2–3 phòng; thêm Lửa trại + Cửa hàng.
- [ ] Nâng lên 18 trợ học + hệ + thưởng bộ (thêm bằng **JSON**, không sửa code).
- [ ] Ràng buộc luyện tập, mở cho người đã thành thạo ≥ 5 chủ đề.
- [ ] Ba bài tổng hợp có luật riêng.

**Nghiệm thu:** bản đồ năng lực khác biệt rõ giữa các người học; thời gian đạt
thành thạo một chủ đề giảm.

## Giai đoạn 4 — Phục vụ tổ chức

- [ ] **Bảng điều khiển ban tổ chức**: chủ đề toàn đơn vị yếu nhất → biết cần
      tập huấn gì. Đặt trong khu quản trị hiện có, truy vấn **chỉ đọc** trên
      `review_log` / `topic_ratings`, có phân trang phía máy chủ.
- [ ] **Báo cáo sẵn sàng thi**: dự báo điểm từ mức thành thạo hiện tại.
      Là báo cáo tham khảo, **không** ghi vào `results` và không ảnh hưởng
      xếp hạng kỳ thi thật.
- [ ] Thử thách hằng ngày cùng hạt (`vnDayKey()`) + bảng xếp hạng tự nguyện,
      tách khỏi bảng xếp hạng kỳ thi.
- [ ] Chế độ mã đề cố định cho đánh giá công bằng toàn đơn vị.
- [ ] Nâng Leitner → FSRS **chỉ khi** đủ dữ liệu; giữ Leitner làm đường lui,
      chuyển đổi sau cờ cấu hình.
- [ ] Sự kiện ngẫu nhiên dạng văn bản (rẻ nhất, tăng đa dạng nhiều nhất).
- [ ] Cảnh báo độ phủ ngân hàng đề cho người ra đề (chỉ cảnh báo, không chặn).

**Nghiệm thu:** ban tổ chức dùng được báo cáo để ra quyết định tập huấn thật.

## Chỉ số theo dõi

| Nên đo | Đừng lấy làm mục tiêu |
| --- | --- |
| Tỉ lệ nhớ sau 7 ngày | Thời gian ở trong ứng dụng |
| Số chủ đề thành thạo / người | Số phiên mỗi ngày |
| Thời gian trung bình để thành thạo | Độ dài chuỗi ngày |
| Độ phủ ngân hàng đề | Tỉ lệ quay lại hằng ngày |
| Độ chênh giữa độ khó gán và thực | Số lượt chia sẻ |

## Kế hoạch chịu tải buổi hội thi

- Đỉnh 50–100 người đồng thời — thiết kế theo con số này.
- Trong khung giờ thi chính thức: **tạm khoá Leo Tháp bằng cờ cấu hình** để mọi
  tài nguyên dành cho kỳ thi. Cờ đọc một lần lúc mở phiên, không thăm dò.
