# Hệ Thống Đặt Vé Đa Phương Tiện (Flight, Train, Bus Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách, tích hợp quản lý doanh thu cho nhà cung cấp và quản trị viên, với tính năng đồng bộ hóa thời gian thực và trải nghiệm ứng dụng di động (PWA).

## 🚀 Tổng Quan Dự Án
Hệ thống được xây dựng trên kiến trúc Client-Server hiện đại, tách biệt hoàn toàn Frontend (React) và Backend (Spring Boot), đảm bảo tính mở rộng và bảo mật.

### 🛠 Công Nghệ Sử Dụng
- **Backend:** Java Spring Boot 3, Spring Security (JWT), Hibernate/JPA, Spring WebSocket (STOMP).
- **Frontend:** React JS (Vite), CSS Variables (Modern Design), React Router.
- **Database:** MS SQL Server.
- **Giám sát:** Prometheus & Grafana.
- **Thanh toán:** Tích hợp VNPay (Sandbox).

---

## ✨ Tính Năng Chính
- **Real-time Seat Booking:** Đồng bộ hóa trạng thái ghế ngồi ngay lập tức qua WebSocket (STOMP). Tránh tình trạng đặt trùng ghế (Double Booking).
- **PWA (Progressive Web App):** Cài đặt ứng dụng trực tiếp từ trình duyệt trên Android/iOS mà không cần qua App Store.
- **Đa Ngôn Ngữ:** Hỗ trợ Tiếng Việt, Tiếng Anh, Tiếng Nhật và Tiếng Trung.
- **Người dùng:** Tìm kiếm chuyến đi, đặt vé, chọn chỗ ngồi, thanh toán online (VNPay), quản lý lịch sử đặt vé, yêu cầu hoàn tiền, và áp dụng **Mã giảm giá (Voucher)**.
- **Hệ thống thông báo:** Tự động gửi Email xác nhận đặt vé, gửi mã OTP khôi phục mật khẩu và xác thực tài khoản qua Gmail SMTP.
- **Nhà cung cấp (Provider):** Xem đánh giá chuyến đi từ người dùng, theo dõi doanh thu qua biểu đồ trực quan.
- **Quản trị viên (Admin):** 
    - Quản lý người dùng, duyệt yêu cầu hoàn tiền, thống kê toàn hệ thống.
    - **Quản lý chuyến đi tối ưu:** Áp dụng **Server-Side Pagination & Search** giúp hệ thống tải mượt mà hàng trăm nghìn bản ghi.

---

## 📦 Hướng Dẫn Cài Đặt (Docker)

1.  **Clone repository:**
    ```bash
    git clone [url-your-repo]
    cd WebProject
    ```

2.  **Khởi chạy hệ thống:**
    ```bash
    docker-compose up --build -d
    ```

3.  **Truy cập:**
    *   **Frontend:** `http://localhost:5173`
    *   **Backend API:** `http://localhost:8081`
    *   **Grafana:** `http://localhost:3000` (User: `admin`, Pass: `admin`)

---

## 💡 Hướng Dẫn Demo Tính Năng Real-time

Để kiểm tra tính năng đồng bộ hóa ghế ngồi thời gian thực:
1.  Mở **Trình duyệt A** (Tab bình thường) và đăng nhập vào tài khoản người dùng 1.
2.  Mở **Trình duyệt B** (Tab ẩn danh/Incognito) và đăng nhập vào tài khoản người dùng 2.
3.  Cả hai người dùng cùng vào chọn một chuyến bay/tàu/xe.
4.  Khi người dùng 1 chọn một ghế, người dùng 2 sẽ thấy ghế đó chuyển sang trạng thái "Đang được chọn" (màu cam/vàng) ngay lập tức.

---

## 📱 Cách Cài Đặt Ứng Dụng (PWA)
1.  Truy cập vào trang web bằng trình duyệt Chrome trên điện thoại hoặc máy tính.
2.  Bấm vào biểu tượng **"Install App"** trên thanh địa chỉ hoặc chọn **"Add to Home Screen"** trong menu trình duyệt.
3.  Ứng dụng sẽ xuất hiện trên màn hình chính và hoạt động như một ứng dụng native.

---

## 🛡 Bảo Mật & Logic
*   **Xác thực:** JWT (JSON Web Token) cho mọi yêu cầu API + Google OAuth2.
*   **Phân quyền:** Admin (Quản lý), Provider (Nhà cung cấp), User (Khách hàng).
*   **Khóa ghế tạm thời:** Bảo vệ ghế đang chọn trong quá trình thanh toán.

---

## 📂 Cấu Trúc Thư Mục
Dự án được chia thành 2 module chính:

### 1. `/backend/ticket-booking`
Chứa toàn bộ mã nguồn xử lý logic nghiệp vụ, API và kết nối cơ sở dữ liệu.

### 2. `/my-react-app`
Chứa mã nguồn giao diện người dùng và bảng điều khiển quản trị.

---

## 🛠 Giải Quyết Lỗi Thường Gặp (Troubleshooting)

### 1. Lỗi kết nối Cơ sở dữ liệu (`failed for user 'sa'` hoặc lỗi `10048`)
- **Lỗi 10048:** SQL Server không khởi động được do cổng 1433 bị chiếm. 
- **Lỗi Login failed:** Sai mật khẩu trong `application.yml`. (Mật khẩu đúng: `Toibingu1234`).

### 2. Backend bị lag khi load nhiều dữ liệu
- Admin đã sử dụng phân trang phía Server. Kiểm tra log Docker nếu vẫn lag.

### 3. Không gửi được Email thông báo
- Đảm bảo tài khoản Gmail đã bật **Xác minh 2 bước** và tạo **Mật khẩu ứng dụng (App Password)**.

---

## 🎯 Lộ Trình Phát Triển (Graduation Thesis Roadmap)

Các tính năng đã hoàn thành:
- [x] **Dockerization:** Đóng gói ứng dụng vào Docker Container.
- [x] **Monitoring:** Prometheus & Grafana.
- [x] **Real-time Seat Booking:** Sử dụng WebSocket (STOMP) để đồng bộ ghế ngồi.
- [x] **PWA (Mobile App):** Chuyển đổi giao diện thành ứng dụng di động có thể cài đặt.
- [x] **AI Chatbot (RAG):** Hỗ trợ tư vấn bằng ngôn ngữ tự nhiên.
- [x] **Voucher System:** Hệ thống mã giảm giá đa phương tiện.
- [x] **Notification System:** Tự động gửi Email thông báo.
- [x] **QR Code Check-in:** Hệ thống quét mã QR bằng Camera (hỗ trợ chọn thiết bị) để xác thực vé tại bến.
- [x] **Ticket History Detail:** Xem chi tiết thông tin hành khách và lộ trình bằng Modal trong lịch sử quét.
- [x] **Mobile Camera Access:** Camera hoạt động trong Safari trên điện thoại. (trừ app trên IOS không cho phép PWA truy cập camera, còn hệ điều hành khác chưa test)

- [x] **Secret Management:** Chuyển toàn bộ thông tin nhạy cảm sang biến môi trường (`.env`).
- [x] **Security Scanning:** Tích hợp Gitleaks vào GitHub Actions để quét rò rỉ secret.
- [x] **Static Analysis:** Tích hợp SonarQube (Self-hosted Docker) để đánh giá chất lượng code.

Các tính năng dự kiến (Advanced Features):
- [ ] **Map Integration:** Tích hợp Google Maps chỉ đường và định vị bến xe/nhà ga theo thời gian thực.
- [ ] **Smart Revenue Forecasting:** Sử dụng Machine Learning (Regression) để dự báo doanh thu và nhu cầu đặt vé theo mùa.
- [ ] **E-KYC & Face Check-in:** Tự động nhận diện hành khách qua khuôn mặt và trích xuất thông tin CCCD bằng OCR.
- [ ] **Multi-Channel Notification:** Tích hợp thông báo qua SMS, Zalo và WhatsApp cho người dùng.
- [ ] **Blockchain Ticket Verification:** Ứng dụng công nghệ Blockchain để đảm bảo tính minh bạch và chống làm giả vé.
- [ ] **Voice-to-Command Search:** Tìm kiếm và đặt vé bằng giọng nói tích hợp AI.

---

## 🔒 Bảo Mật & Cấu Hình (.env)
Dự án sử dụng file `.env` để quản lý các thông tin nhạy cảm. Để chạy dự án cục bộ, bạn cần tạo file `.env` tại thư mục gốc với các biến sau:
```env
SPRING_DATASOURCE_PASSWORD=your_db_password
SPRING_MAIL_PASSWORD=your_gmail_app_password
JWT_SECRET=your_jwt_secret
VNP_HASH_SECRET=your_vnpay_secret
GEMINI_API_KEY=your_gemini_api_key
```

---

## 🤖 Ghi chú cho AI Assistant (Antigravity/Cursor)
1. **Dữ liệu lớn:** Luôn sử dụng API phân trang `/api/admin/trips?page=...&size=...`.
2. **Database:** SQL Server nằm ở máy Host, kết nối qua `host.docker.internal`.
3. **Cấu trúc UI:** Sử dụng CSS Variable trong `index.css` để duy trì theme Light/Dark.
4. **Secret:** Tuyệt đối không hardcode mật khẩu hay API Key vào code. Sử dụng biến môi trường.