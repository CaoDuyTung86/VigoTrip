# 📋 Bảng Kiểm Kê Tổng Duyệt Dự Án (Final Testing Checklist)

Tài liệu này dùng để theo dõi quá trình test tay toàn bộ hệ thống. Hãy đánh dấu `[x]` vào các mục đã kiểm tra và hoạt động tốt.

## 1. Xác thực & Tài khoản (Auth)
- [ ] **Đăng ký:** Tạo tài khoản mới, kiểm tra validate email (đúng định dạng), mật khẩu mạnh.
- [ ] **OTP Email:** Nhận mã OTP xác thực tài khoản thành công.
- [ ] **Đăng nhập:** Vào hệ thống bằng tài khoản vừa tạo (Ưu tiên hiện Login trước).
- [ ] **Quên mật khẩu:** Luồng lấy lại mật khẩu qua OTP email.
- [ ] **Phân quyền:** Tài khoản User không vào được trang `/admin` hoặc `/provider`.

## 2. Tìm kiếm & Lịch trình (Search)
- [ ] **Tìm kiếm:** Chọn điểm đi/đến, ngày đi. Kết quả hiển thị đúng chuyến đi trong ngày.
- [ ] **Lọc phương tiện:** Lọc theo Xe khách/Tàu hỏa/Máy bay hoạt động đúng.
- [ ] **Lịch giá (Calendar):** Hiển thị giá thấp nhất của các ngày lân cận chính xác.
- [ ] **Chi tiết chuyến đi:** Xem thông tin nhà xe, điểm đón/trả, chính sách hủy vé.

## 3. Đặt vé & Chỗ ngồi (Booking)
- [ ] **Chọn ghế:** Chọn ghế (Real-time). Thử mở 2 trình duyệt cùng lúc để test việc khóa ghế tạm thời.
- [ ] **Thông tin hành khách:** Nhập tên, số điện thoại, email cho từng vé.
- [ ] **Dịch vụ thêm:** Chọn suất ăn, bảo hiểm, hành lý... giá tổng thay đổi tương ứng.
- [ ] **Áp dụng Voucher:** Nhập mã giảm giá, kiểm tra số tiền giảm (Discount) và tiền cuối cùng.

## 4. Thanh toán VNPay (Payment)
- [ ] **Tạo Link:** Chuyển hướng sang sandbox VNPay thành công.
- [ ] **Thanh toán thành công:** Sau khi thanh toán ở VNPay, quay về web thấy trạng thái vé là "Đã xác nhận".
- [ ] **Luồng IPN:** Thử thanh toán xong ở VNPay nhưng **TẮT TRÌNH DUYỆT** (không đợi redirect). Sau đó mở lại web kiểm tra xem vé có được xác nhận tự động không.
- [ ] **Email xác nhận:** Nhận được email kèm thông tin chi tiết và **Mã QR Code**.

## 5. Quản lý & Check-in (User & Provider)
- [ ] **Lịch sử đặt vé:** Xem lại danh sách vé đã đặt, trạng thái (Chờ thanh toán/Đã xác nhận).
- [ ] **Hủy vé/Hoàn tiền:** Thực hiện hủy vé (nếu chính sách cho phép) và kiểm tra luồng hoàn tiền.
- [ ] **QR Check-in (Provider/Admin):** Dùng điện thoại quét mã QR từ Email. Hệ thống hiện Modal thông tin khách hàng và cho phép xác nhận lên xe.

## 6. AI & Analytics (Admin)
- [ ] **AI Revenue Insights:** Vào trang Doanh thu Admin, bấm nút "AI Insights". Kiểm tra xem AI có phân tích đúng dữ liệu của Provider đó không.
- [ ] **Biểu đồ:** Các biểu đồ doanh thu, số lượng vé hiển thị số liệu thực tế từ DB.

---

### 🛠 Ghi chú lỗi (Nếu có):
*Nếu bạn phát hiện bước nào bị lỗi hoặc chạy không đúng, hãy ghi chú vào đây để chúng ta cùng sửa:*
- *Lỗi 1: ...*
- *Lỗi 2: ...*
