-- Ghi chú bảo mật: khối đặt lịch watchdog Đấu trường ở migration này từng ghi thẳng
-- khoá bí mật vào mã nguồn. Khoá đó đã bị thu hồi; lịch 'arena-tick' được đặt lại ở
-- migration muộn hơn thông qua private.cron_post (đọc khoá từ private.app_config).
SELECT 1;
