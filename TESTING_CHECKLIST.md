# 📋 Bảng Kiểm Kê Tổng Duyệt Dự Án (Final Testing Checklist)

Tài liệu này dùng để theo dõi quá trình test tay toàn bộ hệ thống. Hãy đánh dấu `[x]` vào các mục đã kiểm tra và hoạt động tốt.

## 1. Xác thực & Tài khoản (Auth)

- [x] **Đăng ký:** Tạo tài khoản mới, kiểm tra validate email (đúng định dạng), mật khẩu mạnh.
- [x] **OTP Email:** Nhận mã OTP xác thực tài khoản thành công.
- [x] **Đăng nhập:** Vào hệ thống bằng tài khoản vừa tạo (Ưu tiên hiện Login trước).
- [ ] **Quên mật khẩu:** Luồng lấy lại mật khẩu qua OTP email.
- [ ] **Phân quyền:** Tài khoản User không vào được trang `/admin` hoặc `/provider`.

## 2. Tìm kiếm & Lịch trình (Search)

- [x] **Tìm kiếm:** Chọn điểm đi/đến, ngày đi. Kết quả hiển thị đúng chuyến đi trong ngày.
- [x] **Lọc phương tiện:** Lọc theo Xe khách/Tàu hỏa/Máy bay hoạt động đúng.
- [x] **Lịch giá (Calendar):** Hiển thị giá thấp nhất của các ngày lân cận chính xác.
- [x] **Chi tiết chuyến đi:** Xem thông tin nhà xe, điểm đón/trả, chính sách hủy vé.

## 3. Đặt vé & Chỗ ngồi (Booking)

- [ ] **Chọn ghế:** Chọn ghế (Real-time). Thử mở 2 trình duyệt cùng lúc để test việc khóa ghế tạm thời.
- [x] **Thông tin hành khách:** Nhập tên, số điện thoại, email cho từng vé.
- [x] **Dịch vụ thêm:** Chọn suất ăn, bảo hiểm, hành lý... giá tổng thay đổi tương ứng.
- [ ] **Áp dụng Voucher:** Nhập mã giảm giá, kiểm tra số tiền giảm (Discount) và tiền cuối cùng.

## 4. Thanh toán VNPay (Payment)

- [x] **Tạo Link:** Chuyển hướng sang sandbox VNPay thành công.
- [x] **Thanh toán thành công:** Sau khi thanh toán ở VNPay, quay về web thấy trạng thái vé là "Đã xác nhận".
- [ ] **Luồng IPN:** Thử thanh toán xong ở VNPay nhưng **TẮT TRÌNH DUYỆT** (không đợi redirect). Sau đó mở lại web kiểm tra xem vé có được xác nhận tự động không.
- [x] **Email xác nhận:** Nhận được email kèm thông tin chi tiết và **Mã QR Code**.

## 5. Quản lý & Check-in (User & Provider)

- [x] **Lịch sử đặt vé:** Xem lại danh sách vé đã đặt, trạng thái (Chờ thanh toán/Đã xác nhận).
- [x] **Hủy vé/Hoàn tiền:** Thực hiện hủy vé (nếu chính sách cho phép) và kiểm tra luồng hoàn tiền.
- [ ] **QR Check-in (Provider/Admin):** Dùng điện thoại quét mã QR từ Email. Hệ thống hiện Modal thông tin khách hàng và cho phép xác nhận lên xe.

## 6. AI & Analytics (Admin & Chatbot)

- [ ] **AI Revenue Insights:** Vào trang Doanh thu Admin, bấm nút "AI Insights". Kiểm tra xem AI có phân tích đúng dữ liệu của Provider đó không.
- [ ] **AI Chatbot tư vấn:** Chat với trợ lý AI (ví dụ: "Tìm vé xe từ Sài Gòn đi Đà Lạt ngày mai"). Kiểm tra AI gọi Function Calling tra cứu đúng DB.
- [ ] **AI Hỏi đáp chính sách (RAG FAQ):** Hỏi AI các câu về hành lý, chính sách hủy vé, thú cưng, mã giảm giá (`SUMMER2026`).
- [ ] **AI Tra cứu đơn vé cá nhân:** Hỏi AI "Kiểm tra vé của tôi" (Bảo mật 100%: Hệ thống tự ép tham số email từ JWT Token chính chủ, tuyệt đối không cho phép tra cứu vé của email người khác).
- [x] **Biểu đồ:** Các biểu đồ doanh thu, số lượng vé hiển thị số liệu thực tế từ DB.

## 7. Nhắc lịch & Hệ thống ngầm (Automated Services)

- [x] **Email nhắc khởi hành (12 tiếng):** Cron job chạy tự động quét vé CONFIRMED trước 12h và gửi mail nhắc nhở (Đã tối ưu 100% Idempotence chống trùng & bù mail khi server restart).

## 8. Giao diện & Trải nghiệm (UI & UX)

- [x] **Bộ lọc & Sắp xếp nâng cao:** Thanh kéo kép chọn khung giờ khởi hành (Dual Slider 0h-24h liền mạch), lọc nhà xe/hãng bay, lọc giá, lọc chỗ trống.
- [ ] **Giao diện Sáng/Tối (Dark/Light Mode):** Nút chuyển Theme trên Header hoạt động mượt mà, đồng bộ toàn trang.
- [ ] **Đa ngôn ngữ (Tiếng Việt / English):** Chuyển đổi ngôn ngữ hệ thống hiển thị đúng các nhãn từ vựng.

---

### 🛠 Ghi chú lỗi (Nếu có):

_Nếu bạn phát hiện bước nào bị lỗi hoặc chạy không đúng, hãy ghi chú vào đây để chúng ta cùng sửa:_

- _Lỗi 1: ..._
- _Lỗi 2: ..._
