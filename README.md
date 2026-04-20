# Hệ Thống Đặt Vé Đa Phương Tiện (Flight, Train, Bus Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách, tích hợp quản lý doanh thu cho nhà cung cấp và quản trị viên.

## 🚀 Tổng Quan Dự Án
Hệ thống được xây dựng trên kiến trúc Client-Server hiện đại, tách biệt hoàn toàn Frontend (React) và Backend (Spring Boot), đảm bảo tính mở rộng và bảo mật.

### 🛠 Công Nghệ Sử Dụng
- **Backend:** Java Spring Boot, Spring Security (JWT), Hibernate/JPA.
- **Frontend:** React JS (Vite), Tailwind CSS/Vanilla CSS, Recharts (Dashboard).
- **Database:** MS SQL Server.
- **Xác thực:** JWT + Google OAuth2.
- **Thanh toán:** Tích hợp VNPay (Sandbox).

---

## 📂 Cấu Trúc Thư Mục
Dự án được chia thành 2 module chính:

### 1. `/backend/ticket-booking`
Chứa toàn bộ mã nguồn xử lý logic nghiệp vụ, API và kết nối cơ sở dữ liệu.
- `src/main/java/com/booking/api/controller`: Quản lý các điểm cuối API.
- `src/main/java/com/booking/api/entity`: Định nghĩa cấu trúc dữ liệu (Booking, Trip, Refund, v.v.).
- `src/main/java/com/booking/api/security`: Cấu hình bảo mật và JWT.

### 2. `/my-react-app`
Chứa mã nguồn giao diện người dùng và bảng điều khiển quản trị.
- `src/components`: Các thành phần giao diện dùng chung.
- `src/pages`: Giao diện chính (Flight, Train, Bus, Dashboard).
- `src/context`: Quản lý trạng thái ứng dụng (Theme, Auth).

---

## ✨ Tính Năng Chính
- **Người dùng:** Tìm kiếm chuyến đi, đặt vé, chọn chỗ ngồi, thanh toán online (VNPay), quản lý lịch sử đặt vé, yêu cầu hoàn tiền, và áp dụng **Mã giảm giá (Voucher)**.
- **Hệ thống thông báo:** Tự động gửi Email xác nhận đặt vé, gửi mã OTP khôi phục mật khẩu và xác thực tài khoản qua Gmail SMTP.
- **Nhà cung cấp (Provider):** Xem đánh giá chuyến đi từ người dùng, theo dõi doanh thu qua biểu đồ trực quan.
- **Quản trị viên (Admin):** 
    - Quản lý người dùng, duyệt yêu cầu hoàn tiền, thống kê toàn hệ thống.
    - **Quản lý chuyến đi tối ưu:** Áp dụng **Server-Side Pagination & Search** giúp hệ thống tải mượt mà hàng trăm nghìn bản ghi chuyến đi mà không gây lag trình duyệt.

---

## 🏗 Cơ Sở Hạ Tầng & Giám Sát
Dự án tích hợp các công cụ hiện đại để quản lý vận hành:
- **Docker:** Đã đóng gói toàn bộ hệ thống qua `docker-compose.yml`.
- **Giám Sát (Monitoring):** Tích hợp **Prometheus** và **Grafana** để theo dõi hiệu năng hệ thống (CPU, RAM, Request Rate) tại `http://localhost:3000`.
- **Dữ liệu mẫu (Data Seeder):** Hệ thống tự động sinh dữ liệu chuyến đi trong tương lai nếu dữ liệu thực tế bị thiếu, đảm bảo demo luôn có dữ liệu mới.

---

## 🛠 Hướng Dẫn Chạy Dự Án
Để khởi chạy nhanh toàn bộ hệ thống:
1. Chạy file `run_all.bat` ở thư mục gốc.
2. Frontend sẽ chạy tại: `http://localhost:5173`
3. Backend sẽ chạy tại: `http://localhost:8081` (Cổng 8080 mặc định đã được chuyển sang 8081 để tránh xung đột với Jenkins/Local Services).

---

## 🛠 Giải Quyết Lỗi Thường Gặp (Troubleshooting)

### 1. Lỗi kết nối Cơ sở dữ liệu (`failed for user 'sa'` hoặc lỗi `10048`)
- **Lỗi 10048:** SQL Server không khởi động được do cổng 1433 bị chiếm. 
    - *Giải pháp:* Khởi động lại máy hoặc tìm phần mềm chiếm cổng bằng lệnh `netstat -ano | findstr :1433`.
- **Lỗi Login failed:** Sai mật khẩu trong `application.yml`.
    - *Kiểm tra:* Đảm bảo tài khoản `sa` đã được kích hoạt và mật khẩu đúng là `Toibingu1234`.

### 2. Backend bị lag khi load nhiều dữ liệu
- Dự án đã giải quyết vấn đề này bằng cách phân trang ở phía Server. Admin chỉ load 20 bản ghi mỗi lần. Nếu vẫn lag, hãy kiểm tra kết nối mạng và log Docker của container `booking_backend`.

### 3. Không gửi được Email thông báo
- Đảm bảo tài khoản Gmail gửi đi (`spring.mail.username`) đã được bật **Xác minh 2 bước** và đã tạo **Mật khẩu ứng dụng (App Password)**.
- Kiểm tra cổng kết nối (mặc định là 587 cho TLS).
- Nếu chạy trong Docker, đảm bảo máy host không chặn kết nối đi tới `smtp.gmail.com`.

---

## 🎯 Lộ Trình Phát Triển (Graduation Thesis Roadmap)

Các tính năng đã hoàn thành:
- [x] **Dockerization:** Đóng gói ứng dụng vào Docker Container.
- [x] **Server-Side Pagination:** Tối ưu hiệu năng quản lý chuyến đi (Admin).
- [x] **Monitoring:** Prometheus & Grafana.
- [x] **CI/CD:** Cấu hình GitHub Actions để tự động kiểm tra code.
- [x] **AI Chatbot (RAG):** Hỗ trợ tìm kiếm chuyến đi, tư vấn chính sách và tra cứu đơn hàng bằng ngôn ngữ tự nhiên (Sử dụng Groq llama-3.3-70b).
- [x] **Voucher System:** Hệ thống mã giảm giá tích hợp đa phương tiện (Máy bay, Tàu, Xe).
- [x] **Notification System:** Tự động gửi Email thông báo (Booking, OTP, Verification).

Các tính năng dự kiến:
- [ ] **Mobile App (PWA):** Chuyển đổi giao diện Web thành ứng dụng Android/iOS có thể cài đặt.
- [ ] **Map Integration:** Tích hợp Google Maps chỉ đường đến bến xe/nhà ga.
- [ ] **Real-time Seat Booking:** Sử dụng WebSocket để cập nhật trạng thái ghế ngồi theo thời gian thực.

---

## 📝 Nhật Ký Cập Nhật (Recent Updates / Commits)

### [2024-04-20] - Đồng bộ hóa và Hệ thống Thông báo
- **Tính năng:** Triển khai luồng Quên mật khẩu (Forgot Password) và Xác thực Email hoàn chỉnh.
- **Tính năng:** Tích hợp Gmail SMTP gửi mã OTP và xác nhận đặt vé thành công.
- **Sửa lỗi:** Khắc phục lỗi trắng trang tại `/auth` khi truy cập trực tiếp.
- **Cấu hình:** Chuyển đổi cổng Backend sang 8081 để tránh xung đột hệ thống.

### [2024-04-19] - Hệ thống Voucher & UI Sync
- **Tính năng:** Hoàn thiện hệ thống Voucher (Backend validation + Frontend real-time update).
- **Giao diện:** Đồng bộ hóa giao diện "Review & Payment" cho Tàu hỏa và Xe khách giống hệt Máy bay.
- **Sửa lỗi:** Sửa lỗi thiếu icon và biến `passengerNames` chưa định nghĩa khi đặt vé Xe/Tàu.
- **AI:** Nâng cấp Chatbot hỗ trợ tra cứu lịch sử đặt vé cá nhân qua JWT Token.

---

## 🤖 Ghi chú cho AI Assistant (Antigravity/Cursor)
1. **Dữ liệu lớn:** Khi xử lý danh sách Chuyến đi (Trips), luôn ưu tiên sử dụng API phân trang `/api/admin/trips?page=...&size=...`.
2. **Database:** SQL Server nằm ở máy Host, kết nối qua `host.docker.internal`.
3. **Seeder:** Không sửa logic tạo `Vehicle` lung tung vì dễ gây trùng lặp dữ liệu trong DB.
4. **Cấu trúc UI:** Sử dụng CSS Variable (đã định nghĩa trong `index.css`) để duy trì tính nhất quán của giao diện (Light/Dark mode).