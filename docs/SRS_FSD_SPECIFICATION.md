# 📘 TÀI LIỆU ĐẶC TẢ YÊU CẦU & CHỨC NĂNG HỆ THỐNG (SRS & FSD)
## Dự Án: VigoTrip - Hệ Thống Đặt Vé & Quản Lý Hành Trình Đa Phương Tiện

---

- **Tên dự án**: VigoTrip (Nền tảng Đặt vé Xe khách, Tàu hỏa, Máy bay)
- **Mã hệ thống**: `VIGOTRIP-SYS-2026`
- **Phiên bản**: 2.0.0 (Release)
- **Đối tượng sử dụng**: Hội đồng Đánh giá Đồ án, Ban Quản trị, Đội ngũ Lập trình (Dev), Đội ngũ Kiểm thử (Tester)

---

## 📑 MỤC LỤC

1. [TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)](#1-tổng-quan-hệ-thống-system-overview)
   - 1.1. Mục tiêu hệ thống
   - 1.2. Phân quyền người dùng (Role-Based Access Control - RBAC)
   - 1.3. Kiến trúc Công nghệ (Technology Stack)
2. [ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS - SOFTWARE REQUIREMENT SPECIFICATION)](#2-đặc-tả-yêu-cầu-phần-mềm-srs)
   - 2.1. Yêu cầu Chức năng (Functional Requirements)
   - 2.2. Yêu cầu Phi chức năng (Non-Functional Requirements)
3. [ĐẶC TẢ CHỨC NĂNG CHI TIẾT (FSD - FUNCTIONAL SPECIFICATION DOCUMENT)](#3-đặc-tả-chức-năng-chi-tiết-fsd)
   - [Mô-đun 1]: Xác thực & Quản lý Tài khoản (Authentication & Account)
   - [Mô-đun 2]: Tìm kiếm & Lịch trình Đa Phương tiện (Multi-Vehicle Search Engine)
   - [Mô-đun 3]: Đặt vé & Khóa ghế Real-time (Booking & Seat Locking)
   - [Mô-đun 4]: Thanh toán VNPay & Xử lý Tự động (Payment Gateway & Background Services)
   - [Mô-đun 5]: Quản lý Đơn vé & QR Check-in (Management & Soát vé)
   - [Mô-đun 6]: Trợ lý AI Chatbot & Phân tích Doanh thu (AI Assistant & Analytics)
4. [MÔ HÌNH DỮ LIỆU & API CONTRACTS](#4-mô-hình-dữ-liệu--api-contracts)
   - 4.1. Sơ đồ Thực thể Liên kết (ERD & Database Schema)
   - 4.2. Danh sách API Endpoints Chính
5. [CƠ CHẾ BẢO MẬT & AN TOÀN DỮ LIỆU (SECURITY ARCHITECTURE)](#5-cơ-chế-bảo-mật--an-toàn-dữ-liệu)

---

<a name="1-tổng-quan-hệ-thống-system-overview"></a>
## 1. TỔNG QUAN HỆ THỐNG (SYSTEM OVERVIEW)

### 1.1. Mục tiêu hệ thống
VigoTrip là nền tảng thương mại điện tử chuyên cung cấp dịch vụ đặt vé giao thông đa phương tiện (Xe khách, Tàu hỏa, Máy bay) kết hợp ứng dụng Trí tuệ nhân tạo (AI) và công nghệ thời gian thực (Real-time WebSocket). Hệ thống giải quyết các bài toán:
- **Tối ưu trải nghiệm đặt vé**: Hỗ trợ tìm kiếm nhanh, lọc theo giá/giờ/hãng, đặt ghế thời gian thực chống đè ghế.
- **Tự động hóa thanh toán & vé điện tử**: Tích hợp VNPay IPN tự động xác nhận đơn vé, xuất mã QR Code check-in gửi qua Email.
- **Trợ lý AI thông minh**: Tư vấn chuyến đi, tra cứu lịch sử vé cá nhân (Zero-Trust Security), giải đáp thắc mắc RAG FAQ.
- **Chăm sóc khách hàng tự động**: Hệ thống Cron Scheduler quét và gửi Email nhắc nhở trước 12h khởi hành hoàn toàn Idempotence.

### 1.2. Phân quyền người dùng (RBAC)
Hệ thống phân chia 3 nhóm người dùng chính:
- **Khách hàng / User (`ROLE_USER`)**: Tìm kiếm chuyến đi, chọn ghế, thanh toán, nhận vé QR, tra cứu lịch sử đặt vé, hủy vé, đánh giá chuyến đi, chat với trợ lý AI.
- **Nhà xe / Provider (`ROLE_PROVIDER`)**: Quản lý lịch trình chuyến đi của hãng, kiểm soát danh sách hành khách, quét mã QR Check-in lên xe, xem báo cáo doanh thu AI của hãng.
- **Quản trị viên / Admin (`ROLE_ADMIN`)**: Quản lý toàn bộ người dùng, duyệt yêu cầu hoàn tiền (Refund), theo dõi doanh thu toàn hệ thống, cấu hình hệ thống.

### 1.3. Kiến trúc Công nghệ (Technology Stack)
```
+-----------------------------------------------------------------------+
|                           FRONTEND LAYER                              |
|   React (Vite) | Tailwind CSS | React Router | WebSocket STOMP Client |
|   Hosted on Vercel Edge Network                                       |
+-----------------------------------------------------------------------+
                                   | HTTP / WebSocket Rewrites (/api, /ws)
                                   v
+-----------------------------------------------------------------------+
|                           BACKEND LAYER                               |
|   Java 17 | Spring Boot 3.4 | Spring Security 6 (JWT & OAuth2)        |
|   Spring Data JPA | Google Gemini AI (RAG + Function Calling)         |
|   ZXing QR Code Generator | JavaMailSender | Caffeine Cache         |
|   Hosted on Render Container (Linux -Xmx256m)                         |
+-----------------------------------------------------------------------+
                                   | JPA / JDBC
                                   v
+-----------------------------------------------------------------------+
|                           DATABASE LAYER                              |
|   SQL Server / Neon Serverless PostgreSQL Database                    |
+-----------------------------------------------------------------------+
```

---

<a name="2-đặc-tả-yêu-cầu-phần-mềm-srs"></a>
## 2. ĐẶC TẢ YÊU CẦU PHẦN MỀM (SRS)

### 2.1. Yêu cầu Chức năng (Functional Requirements)
- **FR-01 (Auth)**: Người dùng có thể Đăng ký, Đăng nhập (thường & Google OAuth2), Xác thực OTP Email, Khôi phục mật khẩu.
- **FR-02 (Search)**: Tra cứu chuyến đi theo Điểm đi, Điểm đến, Ngày đi, Loại phương tiện (Máy bay, Tàu hỏa, Xe khách).
- **FR-03 (Filter)**: Lọc chuyến đi theo khung giờ (Dual-Slider 0h-24h liền mạch), lọc giá từ thấp đến cao, lọc hãng vận tải, lọc còn chỗ.
- **FR-04 (Seat Locking)**: Khóa ghế thời gian thực bằng WebSocket STOMP khi người dùng đang chọn ghế.
- **FR-05 (Checkout & Payment)**: Tạo đơn đặt vé, áp dụng Voucher giảm giá, tạo link thanh toán VNPay Sandbox.
- **FR-06 (IPN & Email)**: Xử lý IPN checksum HMAC SHA512 từ VNPay, cập nhật trạng thái đơn vé, gửi Email vé điện tử chứa mã QR Code.
- **FR-07 (Reminder Scheduler)**: Tự động chạy tiến trình ngầm gửi mail nhắc nhở trước 12h cho các đơn vé `CONFIRMED`.
- **FR-08 (QR Check-in)**: Quét mã QR Code bằng thiết bị di động để đối soát thông tin khách hàng và check-in lên xe.
- **FR-09 (AI Chatbot)**: Chatbot AI tư vấn chuyến đi, tra cứu lịch sử vé cá nhân ép tham số JWT chính chủ, RAG FAQ chính sách.
- **FR-10 (AI Revenue Analytics)**: Phân tích doanh thu bằng Google Gemini AI Insights, theo **kỳ báo cáo** chọn được là Tháng / Quý / Năm.
  - Mọi chỉ số trong một báo cáo — doanh thu, số đơn, số vé, cơ cấu theo loại phương tiện, doanh thu theo nhà cung cấp, top tuyến — đều cắt theo đúng một khoảng `[đầu kỳ, đầu kỳ kế tiếp)`. Giao diện và phần AI đọc **chung một** đối tượng số liệu, nên con số AI dẫn ra không thể lệch với biểu đồ đang hiển thị.
  - Có so sánh với **kỳ liền trước** (tăng trưởng doanh thu và số đơn). Kỳ trước bằng 0 thì bỏ trống chỉ số tăng trưởng thay vì quy ra vô cực.
  - Kỳ được chọn không có giao dịch thì hệ thống **tự chuyển về kỳ gần nhất có dữ liệu** và hiển thị thông báo nêu rõ kỳ đã yêu cầu lẫn kỳ đang xem — không bao giờ trả về màn hình trắng, cũng không gán số liệu kỳ này thành kỳ khác.
  - Không có dữ liệu thì không gọi LLM, để tiết kiệm trần ngân sách token hằng ngày.
- **FR-11 (Trip Supply Scheduler)**: Lịch chuyến luôn được phủ đủ 30 ngày kể từ ngày hiện tại. Tiến trình ngầm chạy 03:00 hằng ngày (và lặp lại lúc khởi động ứng dụng, phòng trường hợp container Render ngủ đúng giờ cron) rà từng bộ ba `(tuyến, loại phương tiện, ngày)` trong danh mục tuyến và chỉ sinh phần còn thiếu. Tiến trình **chỉ thêm, không xoá**: chuyến đã khởi hành được giữ nguyên trong CSDL làm dữ liệu lịch sử cho FR-10, việc ẩn chúng khỏi giao diện khách do tầng truy vấn đảm nhiệm.
- **FR-12 (Provider Data Scoping)**: Tài khoản `ROLE_PROVIDER` chỉ đọc được số liệu của những thương hiệu mình vận hành, xác định qua `nha_cung_cap.owner_user_id`. Yêu cầu phạm vi toàn hệ thống từ tài khoản đối tác bị **từ chối thẳng (403)** chứ không âm thầm hạ xuống phạm vi hẹp — hạ ngầm sẽ khiến đối tác tưởng con số đang xem là của toàn sàn.

### 2.2. Yêu cầu Phi chức năng (Non-Functional Requirements)
- **NFR-01 (Performance)**: Thời gian phản hồi API tra cứu chuyến đi $< 500\text{ms}$. AI Streaming phản hồi ngay câu đầu tiên $< 1.5\text{s}$.
- **NFR-02 (Security)**: Mật khẩu mã hóa BCrypt. Xác thực JWT Stateless. Zero-Trust Security ngăn chặn rò rỉ dữ liệu chéo giữa các người dùng.
- **NFR-03 (Availability)**: Hệ thống hoạt động 24/7 trên môi trường Cloud (Vercel + Render + Neon DB).
- **NFR-04 (Usability)**: Giao diện chuẩn Responsive, hỗ trợ Dark/Light Theme và Đa ngôn ngữ (Tiếng Việt / English).
---
### 2.3. Bảng Truy vết Yêu cầu (Traceability Matrix)

| Mã FR | Mô tả ngắn | Mã FSD tương ứng |
| :--- | :--- | :--- |
| FR-01 | Đăng ký / Đăng nhập / OTP | FSD-AUTH-01, FSD-AUTH-02 |
| FR-02 | Tra cứu chuyến đi | FSD-SEARCH-01 |
| FR-03 | Bộ lọc nâng cao | FSD-SEARCH-02 |
| FR-04 | Khóa ghế Real-time | FSD-BOOKING-01 |
| FR-05 | Checkout & Voucher & VNPay | FSD-BOOKING-02, FSD-PAY-01 |
| FR-06 | IPN & Email vé điện tử | FSD-PAY-01 |
| FR-07 | Nhắc lịch tự động | FSD-SCHEDULER-01 |
| FR-08 | QR Check-in | FSD-MGMT-02 |
| FR-09 | AI Chatbot | FSD-AI-01 |
| FR-10 | AI Revenue Analytics (theo kỳ) | FSD-AI-02 |
| FR-11 | Trip Supply Scheduler | FSD-SCHEDULER-01 |
| FR-12 | Provider Data Scoping | FSD-AI-02, FSD-MGMT-01 |
| *(bổ sung)* | Duyệt hoàn tiền | FSD-MGMT-03 |
| *(bổ sung)* | Đánh giá chuyến đi | FSD-MGMT-04 |
---

<a name="3-đặc-tả-chức-năng-chi-tiết-fsd"></a>
## 3. ĐẶC TẢ CHỨC NĂNG CHI TIẾT (FSD)

### 📌 MÔ-ĐUN 1: XÁC THỰC & TÀI KHOẢN (AUTH MODULE)

#### 1.1. Chức năng: Đăng ký & Xác thực OTP Email
- **Mã chức năng**: `FSD-AUTH-01`
- **User Story**: Là một người dùng mới, tôi muốn đăng ký tài khoản bằng Email và xác thực mã OTP để đảm bảo tài khoản chính chủ.
- **Luồng xử lý (Flow)**:
  1. Người dùng nhập Email, Mật khẩu, Họ tên, Số điện thoại -> Bấm "Đăng ký".
  2. Hệ thống kiểm tra Email tồn tại trong DB chưa. Nếu chưa, tạo mã OTP 6 chữ số ngẫu nhiên, lưu tạm vào DB kèm thời gian hết hạn (15 phút).
  3. Gửi Email OTP kích hoạt qua `EmailService`.
  4. Người dùng nhập 6 số OTP -> Hệ thống đối soát -> Chuyển trạng thái tài khoản sang `ENABLED`.
- **Điều kiện Nghiệm thu (Acceptance Criteria - AC)**:
  - `AC-01`: Email sai định dạng hoặc mật khẩu $< 6$ ký tự phải hiển thị thông báo lỗi ngay tại form.
  - `AC-02`: Mã OTP nhập sai hoặc quá 15 phút sẽ báo lỗi "Mã OTP đã hết hạn hoặc không hợp lệ".

#### 1.2. Chức năng: Đăng nhập & Phân quyền JWT
- **Mã chức năng**: `FSD-AUTH-02`
- **User Story**: Là người dùng, tôi muốn đăng nhập bằng Email/Mật khẩu hoặc Google OAuth2 để nhận JWT Token sử dụng dịch vụ.
- **Điều kiện Nghiệm thu (AC)**:
  - `AC-01`: Trả về `accessToken` chứa Claims (`sub`, `roles`, `exp`) lưu ở Frontend `localStorage` / `Cookie`.
  - `AC-02`: Tài khoản `ROLE_USER` truy cập các tuyến đường `/admin` hoặc `/provider` sẽ bị chặn bởi HTTP 403 Forbidden.

---

### 📌 MÔ-ĐUN 2: TÌM KIẾM & LỊCH TRÌNH ĐA PHƯƠNG TIỆN (SEARCH ENGINE MODULE)

#### 2.1. Chức năng: Tra cứu Chuyến đi & Bảng giá lân cận
- **Mã chức năng**: `FSD-SEARCH-01`
- **User Story**: Là hành khách, tôi muốn tìm chuyến xe/tàu/máy bay theo điểm đi, điểm đến và ngày đi để chọn hành trình phù hợp.
- **Quy tắc Nghiệm thu & Bảo trì (Rules & Maintenance Status)**:
  - `AC-01`: Mặc định hệ thống chọn luồng **Vé Một chiều (One-way)**.
  - `AC-02`: Đối với tab **Khứ hồi (Round-trip)**, hệ thống hiện nhãn `(Đang bảo trì)`. Khi người dùng click chọn, hệ thống tự động hiển thị thông báo:  
    `"⚠️ Tính năng vé Khứ hồi hiện đang bảo trì & nâng cấp hệ thống. Vui lòng sử dụng vé Một chiều quý khách nhé!"` và giữ nguyên luồng một chiều để đảm bảo trải nghiệm không bị ngắt quãng.
  - `AC-03`: Hiển thị thanh Lịch giá (Calendar Bar) cập nhật giá vé rẻ nhất của các ngày lân cận.

#### 2.2. Chức năng: Bộ lọc & Sắp xếp Nâng cao (Dual-Slider Filter)
- **Mã chức năng**: `FSD-SEARCH-02`
- **Quy tắc Thiết kế (Design Rule)**:
  - Bộ lọc khung giờ sử dụng **Dual-Slider (Thanh kéo kép 0h - 24h)**.
  - Khung track màu xanh nối khít 100% từ đúng tâm nút kéo bên trái đến tâm nút kéo bên phải theo công thức bù lề 10px:
    - **Vị trí cạnh trái (`left`)**: `calc(10px + (startHour / 24) * (100% - 20px))`
    - **Vị trí cạnh phải (`right`)**: `calc(10px + ((24 - endHour) / 24) * (100% - 20px))`

---

### 📌 MÔ-ĐUN 3: ĐẶT VÉ & KHÓA GHẾ REAL-TIME (BOOKING MODULE)

#### 3.1. Chức năng: Khóa ghế thời gian thực (WebSocket Seat Locking)
- **Mã chức năng**: `FSD-BOOKING-01`
- **User Story**: Khi tôi bấm chọn ghế, ghế đó phải được tạm khóa real-time để người khác không chọn trùng.
- **Luồng xử lý (Flow)**:
  1. Client kết nối tới WebSocket STOMP endpoint `/ws`.
  2. Khi click chọn ghế `A12` trên chuyến `TRIP-10`, Client gửi message tới `/app/seat/lock`.
  3. Server phát sóng (broadcast) sự kiện tới kênh `/topic/trip/TRIP-10/seats`: Ghế `A12` chuyển trạng thái `LOCKED` bởi Session X.
  4. Sau 10 phút nếu đơn vé chưa thanh toán, Server Scheduler giải phóng ghế về trạng thái `AVAILABLE`.

#### 3.2. Chức năng: Áp dụng Mã giảm giá (Voucher Engine)
- **Mã chức năng**: `FSD-BOOKING-02`
- **Điều kiện Nghiệm thu (AC)**:
  - `AC-01`: Mã giảm giá hợp lệ (`WELCOME20`, `SUMMER2026`, `AI_PROMO_10`) sẽ tính lại `totalPrice = originalPrice - discountAmount`.
  - `AC-02`: Mã hết hạn hoặc vượt quá lượt sử dụng sẽ báo lỗi cụ thể.

---

### 📌 MÔ-ĐUN 4: THANH TOÁN VNPAY & DỊCH VỤ NGẦM (PAYMENT & SCHEDULER MODULE)

#### 4.1. Chức năng: Tích hợp Thanh toán VNPay Sandbox & IPN
- **Mã chức năng**: `FSD-PAY-01`
- **User Story**: Tôi muốn thanh toán an toàn qua cổng VNPay và tự động nhận xác nhận vé ngay cả khi tôi lỡ đóng trình duyệt.
- **Luồng xử lý IPN (Asynchronous IPN Callback Flow)**:
  ```
  [User Browser] ---> (Thanh toán trên cổng VNPay Sandbox)
                             |
                             v
                 [VNPay Server Gate]
                             |
                             |---> (1) Redirect Browser (GET /api/payment/vnpay-return)
                             |
                             +---> (2) Asynchronous IPN Call (GET /api/payment/vnpay-ipn)
                                         |
                                         v
                               [VigoTrip Backend]
                                 - Checksum HMAC-SHA512
                                 - Verify vnp_ResponseCode == '00'
                                 - Update Booking status -> 'CONFIRMED'
                                 - Trigger EmailService (Send QR Code)
  ```
- **Điều kiện Nghiệm thu (AC)**:
  - `AC-01`: Mã SHA-512 Checksum phải khớp 100% với `vnp_HashSecret`.
  - `AC-02`: Đảm bảo Idempotency (xử lý trùng IPN): Nếu đơn đã `CONFIRMED`, IPN gọi lại chỉ trả về `RspCode: 02` (Order already confirmed), không tạo trùng vé.

#### 4.2. Chức năng: Tự động gửi Email Nhắc lịch 12h trước khởi hành
- **Mã chức năng**: `FSD-SCHEDULER-01`
- **Mô tả**: Tiến trình ngầm Cron Job chạy tự động quét Database gửi Email nhắc nhở hành khách.
- **Cơ chế Tối ưu Triệt để (Idempotent & Resilient Architecture)**:
  - Bổ sung trường `reminder_sent` (Boolean, default `false`) trong bảng `dat_ve` (Booking Entity).
  - Cron Job `@Scheduled(fixedRate = 3600000)` (Chạy mỗi 1 giờ) gọi SQL Query:
    ```sql
    SELECT b FROM Booking b 
    WHERE b.status = 'CONFIRMED' 
      AND (b.reminderSent IS NULL OR b.reminderSent = FALSE)
      AND b.trip.departureTime > :now 
      AND b.trip.departureTime <= :nowPlus12Hours
    ```
  - Ngay khi Email gửi thành công, cập nhật `booking.setReminderSent(true)` và `bookingRepository.save(booking)`.
  - **Ưu điểm**:
    1. Chống gửi trùng email 100% (Idempotence).
    2. Nếu Server bị tắt/bảo trì, ngay khi khởi động lại, tiến trình sẽ tự động quét và gửi bù mail cho các chuyến khởi hành trong 12h mà không bị bỏ sót.

---

### 📌 MÔ-ĐUN 5: QUẢN LÝ ĐƠN VÉ & QR CHECK-IN (MANAGEMENT & CHECK-IN MODULE)

#### 5.1. Chức năng: Quản lý Lịch sử Đặt vé & Hủy vé
- **Mã chức năng**: `FSD-MGMT-01`
- **User Story**: Tôi muốn xem lại các vé đã đặt (`/my-bookings`) và thực hiện hủy vé theo chính sách hoàn tiền.
- **Chính sách Hủy vé (Cancellation Rules)**:
  - Hủy trước > 24 tiếng: Hoàn 100% giá trị vé.
  - Hủy từ 12 - 24 tiếng: Hoàn 50% giá trị vé.
  - Hủy dưới 12 tiếng: Không hỗ trợ hoàn tiền.

#### 5.2. Chức năng: QR Code Check-in Soát vé tại bến
- **Mã chức năng**: `FSD-MGMT-02`
- **User Story**: Là nhà xe/phụ xe, tôi muốn dùng camera điện thoại quét mã QR từ Email của khách để check-in lên xe.
- **Luồng xử lý (Flow)**:
  1. Email xác nhận vé chứa ảnh QR Code (sinh bởi thư viện `ZXing` chứa số `<ID>` của booking).
  2. Nhà xe mở tính năng Scan QR trên ứng dụng Web Provider -> Quét camera vào mã QR.
  3. Modal hiển thị chi tiết: Họ tên hành khách, Tuyến đường, Số ghế, Trạng thái thanh toán.
  4. Bấm "Xác nhận Lên xe" -> Cập nhật `is_checked_in = true` và `check_in_date = NOW()`.
---
#### 5.3. Chức năng: Duyệt Yêu cầu Hoàn tiền (Admin Refund Approval)
- **Mã chức năng**: `FSD-MGMT-03`
- **User Story**: Là Quản trị viên, tôi muốn xem và duyệt/từ chối các yêu cầu hoàn tiền để đảm bảo minh bạch tài chính và đúng chính sách hủy vé.
- **Luồng xử lý (Flow)**:
  1. Khi User hủy vé (`PUT /api/bookings/{id}/cancel`), hệ thống tự động tạo bản ghi `Refund` với trạng thái `PENDING` và số tiền hoàn được tính theo chính sách tại `FSD-MGMT-01` (100% / 50% / 0%).
  2. Nếu tỷ lệ hoàn = 0% (hủy dưới 12h), hệ thống tự động đặt trạng thái `REJECTED` (lý do: "Hủy vé cận giờ khởi hành"), **không cần Admin duyệt**.
  3. Với các yêu cầu có tỷ lệ hoàn > 0%, Admin truy cập trang `/admin/refunds`, xem danh sách `PENDING` gồm: thông tin khách hàng, mã vé, số tiền hoàn, thời điểm hủy.
  4. Admin bấm **"Duyệt"** → cập nhật `status = APPROVED`, ghi nhận `processed_by` (admin_id) và `processed_at` → gửi Email thông báo đã hoàn tiền cho khách.
  5. Admin bấm **"Từ chối"** kèm lý do → cập nhật `status = REJECTED`.
- **Điều kiện Nghiệm thu (AC)**:
  - `AC-01`: Chỉ tài khoản `ROLE_ADMIN` được truy cập các API `/api/admin/refunds/**`.
  - `AC-02`: Yêu cầu hủy vé dưới 12h tự động chuyển `REJECTED`, không hiển thị trong danh sách chờ duyệt của Admin.
  - `AC-03`: Trạng thái Refund gồm 4 giá trị: `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`.
  - `AC-04`: Một `booking_id` chỉ được phép có duy nhất một bản ghi `Refund` (ràng buộc Unique).
---
#### 5.4. Chức năng: Đánh giá Chuyến đi (Trip Review)
- **Mã chức năng**: `FSD-MGMT-04`
- **User Story**: Là hành khách đã hoàn thành chuyến đi, tôi muốn đánh giá (số sao + bình luận) để chia sẻ trải nghiệm và giúp hành khách khác tham khảo.
- **Luồng xử lý (Flow)**:
  1. Hệ thống chỉ hiển thị nút "Đánh giá" trên các vé có `status = CONFIRMED` và `trip.departure_time < NOW()`.
  2. Người dùng chọn số sao (1-5) và nhập bình luận (tùy chọn) → Submit.
  3. Hệ thống lưu vào bảng `danh_gia`, liên kết `booking_id`, `trip_id`, `user_id`.
  4. Đánh giá hiển thị công khai trên trang chi tiết tuyến đường / trang của Nhà xe (Provider).
- **Điều kiện Nghiệm thu (AC)**:
  - `AC-01`: Chỉ được đánh giá vé đã `CONFIRMED` và chuyến đi đã diễn ra (`departure_time` < thời điểm hiện tại).
  - `AC-02`: Mỗi `booking_id` chỉ được đánh giá **duy nhất một lần** (ràng buộc Unique trên `booking_id` tại bảng `danh_gia`).
  - `AC-03`: `rating` bắt buộc trong khoảng 1-5; `comment` không bắt buộc, tối đa 1000 ký tự.
---

### 📌 MÔ-ĐUN 6: TRỢ LÝ AI CHATBOT & PHÂN TÍCH DOANH THU (AI & ANALYTICS MODULE)

#### 6.1. Chức năng: Trợ lý AI Chatbot "Son" (Gemini RAG + Function Calling)
- **Mã chức năng**: `FSD-AI-01`
- **Mô tả**: Chatbot AI tích hợp Google Gemini 1.5/2.0 API, kết hợp cơ chế RAG Engine và Function Calling.
- **Các tính năng của AI Chatbot**:
  - **Tư vấn chuyến đi**: Tự động nhận diện ý định và gọi tool `search_trips(origin, destination, date)` tra cứu DB thật.
  - **Hỏi đáp chính sách (RAG FAQ Engine)**: Hỗ trợ tra cứu từ đồng nghĩa & không dấu (Synonym & Normalization Map) đối với các câu hỏi về hành lý, thú cưng, quy định hủy vé, mã voucher.
  - **Tra cứu đơn vé cá nhân (Zero-Trust Security)**:
    - *Quy tắc Bảo mật tuyệt đối*: Khi khách hàng chat *"Kiểm tra vé của tôi"* hoặc cố tình chat *"Kiểm tra vé của email userB@gmail.com"*, Backend Spring Boot sẽ **TỰ ĐỘNG GHI ĐÈ THAM SỐ `username` BẰNG JWT TOKEN CỦA USER ĐANG ĐĂNG NHẬP**:
      ```java
      if ("get_user_bookings".equals(fnName) && username != null) {
          newArgs.put("username", authenticatedJwtUsername); // Ép email JWT chính chủ
      }
      ```
    - *Kết quả*: Người dùng A **tuyệt đối KHÔNG THỂ** xem dữ liệu vé của Người dùng B. Khách chưa đăng nhập sẽ nhận phản hồi thông báo yêu cầu đăng nhập.

#### 6.2. Chức năng: AI Revenue Insights (Admin & Provider)
- **Mã chức năng**: `FSD-AI-02`
- **Mô tả**: AI phân tích tự động dữ liệu doanh thu, tỷ lệ lấp đầy ghế và đưa ra nhận xét chiến lược kinh doanh cho Nhà xe & Admin.

---

<a name="4-mô-hình-dữ-liệu--api-contracts"></a>
## 4. MÔ HÌNH DỮ LIỆU & API CONTRACTS

### 4.1. Sơ đồ Thực thể Liên kết (ERD & Database Schema)

Các bảng chính trong Cơ sở dữ liệu SQL Server / PostgreSQL:

1. **`users` (NguoiDung)**:
   - `user_id` (PK, BigInt, Auto-Increment)
   - `email` (VarChar(255), Unique, Not Null)
   - `password` (VarChar(255), Not Null)
   - `full_name` (NVarChar(255))
   - `phone` (VarChar(20))
   - `role` (VarChar(20)) -- `ROLE_USER`, `ROLE_PROVIDER`, `ROLE_ADMIN`
   - `enabled` (Boolean, Default `false`)

2. **`chuyen_di` (Trips)**:
   - `trip_id` (PK, BigInt, Auto-Increment)
   - `route_id` (FK -> `tuyen_duong`)
   - `vehicle_id` (FK -> `phuong_tien`)
   - `departure_time` (DateTime2, Index)
   - `arrival_time` (DateTime2)
   - `price` (Decimal(15,2))
   - `available_seats` (Int)

3. **`dat_ve` (Bookings)**:
   - `booking_id` (PK, BigInt, Auto-Increment)
   - `user_id` (FK -> `users`, Index)
   - `booking_date` (DateTime2)
   - `total_price` (Decimal(15,2))
   - `status` (VarChar(30)) -- `PENDING`, `CONFIRMED`, `CANCELLED`
   - `voucher_code` (VarChar(50))
   - `is_checked_in` (Boolean, Default `false`)
   - `check_in_date` (DateTime2)
   - `reminder_sent` (Boolean, Default `false`, Index)

4. **`danh_gia` (Reviews)**:
   - `review_id` (PK, BigInt, Auto-Increment)
   - `user_id` (FK -> `users`)
   - `trip_id` (FK -> `chuyen_di`)
   - `booking_id` (FK -> `dat_ve`)
   - `rating` (Int)
   - `comment` (NVarChar(1000))
   
5. **`tuyen_duong` (Routes)**:
   - `route_id` (PK, BigInt, Auto-Increment)
   - `origin` (NVarChar(255), Index) — Mã điểm đi
   - `destination` (NVarChar(255), Index) — Mã điểm đến
   - *(Index tổ hợp `(origin, destination)` phục vụ FR-02.)*

   > **Ghi chú hiện trạng.** `provider_id` và `distance_km` từng được đặc tả ở đây nhưng **chưa hiện thực hoá**: một hàng `tuyen_duong` đang dùng chung cho cả ba loại phương tiện (nhà cung cấp xác định gián tiếp qua `chuyen_di -> phuong_tien -> nha_cung_cap`), và hệ thống chưa lưu khoảng cách.
   >
   > **Hạn chế đã biết — mã điểm phụ thuộc phương tiện.** `origin`/`destination` là chuỗi tự do, không khoá ngoại, và cùng một thành phố đang mang hai mã khác nhau tuỳ phương tiện: `HUI`/`HUE` (Huế), `CXR`/`NTR` (Nha Trang), `DLI`/`DLT` (Đà Lạt), `VII`/`VIN` (Vinh) — hàng không dùng mã IATA, tàu/xe dùng mã ga - bến. Hệ quả: một tuyến logic bị lưu thành hai hàng không liên quan nhau, và không có toạ độ để hiển thị bản đồ.
   >
   > **Hướng chuẩn hoá (điều kiện cần cho hạng mục Map & Realtime Tracking).** Tách hai bảng mới rồi trỏ `tuyen_duong` sang chúng:
   > - `dia_diem` (Locations) — cấp **thành phố**, mỗi thành phố **một mã duy nhất** không phụ thuộc phương tiện: `location_id`, `code`, `name_vi/en/ja/zh`, `region`, `latitude`, `longitude`.
   > - `diem_don_tra` (Terminals) — **điểm vật lý**, là thứ được cắm pin trên bản đồ: `terminal_id`, `location_id` (FK), `mode` (`AIR`/`RAIL`/`ROAD`), `code`, `iata_code` (nullable), `name`, `address`, `latitude`, `longitude`.
   > - `tuyen_duong` bổ sung `origin_terminal_id`, `destination_terminal_id` (FK), `mode`, `distance_km`, `typical_duration_min`, `active`, `path_geojson` (đường đi thực tế cho `RAIL`/`ROAD`; `AIR` nội suy cung vòng lớn).
   >
   > Hai cột `origin`/`destination` được **giữ lại ở dạng phi chuẩn hoá** (mã thành phố) để các truy vấn và màn quản trị hiện có không phải sửa đồng loạt trong cùng một lần triển khai.

6. **`nha_cung_cap` (Providers)**:
   - `provider_id` (PK, BigInt, Auto-Increment)
   - `provider_name` (NVarChar(255), Not Null)
   - `provider_type` (VarChar(20)) -- `AIRLINE`, `BUS`, `TRAIN`
   - `contact_info` (NVarChar(255))
   - `owner_user_id` (FK -> `users`, **Nullable**) — tài khoản đối tác vận hành thương hiệu này

   > Cột `owner_user_id` là thứ hiện thực hoá FR-12. Trước khi có nó, `ROLE_PROVIDER` thực chất là admin thứ hai vì không tồn tại liên kết nào giữa `nha_cung_cap` và `users`.
   >
   > Để **nullable** có chủ đích: `ddl-auto=update` không thể thêm cột `NOT NULL` vào bảng đã có dữ liệu, và một thương hiệu chưa gán chủ sở hữu vẫn phải bán vé được — chỉ là ngoài admin thì không ai xem được báo cáo của nó.
   >
   > Hệ thống dựng sẵn **một** tài khoản đối tác duy nhất cho mục đích trình diễn. Danh sách thương hiệu mà tài khoản đó vận hành khai trong `app.provider.owned-providers`, theo mô hình đại lý tổng — một đối tác quản lý nhiều thương hiệu. Cấu hình đúng một tên là quay về mô hình 1 đối tác = 1 hãng mà không phải sửa mã.

7. **`phuong_tien` (Vehicles)**:
   - `vehicle_id` (PK, BigInt, Auto-Increment)
   - `provider_id` (FK -> `nha_cung_cap`, Not Null)
   - `vehicle_type` (VarChar(20)) -- `BUS`, `TRAIN`, `PLANE`
   - `vehicle_name` (NVarChar(255))
   - `total_seats` (Int)
   - `seat_map` (JSON/NVarChar(MAX)) — Sơ đồ ghế

8. **`voucher` (Mã giảm giá)**:
   - `voucher_id` (PK, BigInt, Auto-Increment)
   - `code` (VarChar(50), Unique, Not Null)
   - `discount_type` (VarChar(20)) -- `PERCENT`, `FIXED`
   - `discount_value` (Decimal(15,2))
   - `max_usage` (Int)
   - `used_count` (Int, Default `0`)
   - `expiry_date` (DateTime2)

9. **`hoan_tien` (Refunds)**:
   - `refund_id` (PK, BigInt, Auto-Increment)
   - `booking_id` (FK -> `dat_ve`, Unique)
   - `amount` (Decimal(15,2))
   - `status` (VarChar(20)) -- `PENDING`, `APPROVED`, `REJECTED`, `COMPLETED`
   - `reason` (NVarChar(500))
   - `processed_by` (FK -> `users`, nullable — admin xử lý)
   - `processed_at` (DateTime2, nullable)

10. **`thong_bao` (Tin nhập tay cho dải tin chạy)**:
    - `thong_bao_id` (PK, BigInt, Auto-Increment)
    - `noi_dung_vi` (NVarChar(500), Not Null) — bản dự phòng khi thiếu bản dịch
    - `noi_dung_en` (NVarChar(500), nullable)
    - `duong_dan` (VarChar(300), nullable) — null thì mẩu tin không bấm được
    - `loai` (VarChar(20)) -- `ROUTE`, `MAINTENANCE`, `INFO`
    - `hieu_luc_tu` (DateTime2, nullable) — null là hiện ngay
    - `hieu_luc_den` (DateTime2, nullable) — null là hiện tới khi có người tắt
    - `thu_tu` (Int, Default `0`)
    - `dang_bat` (Bit, Default `1`)
   >
   > Bảng này KHÔNG chứa tin suy ra từ voucher: dải tin hợp nhất hai nguồn lúc đọc, còn voucher
   > vẫn nằm nguyên ở bảng `voucher` với cờ `hien_thi_bang_tin` quyết định có lên dải tin hay
   > không. Cặp `hieu_luc_tu` / `hieu_luc_den` là lý do bảng tồn tại: tin phải tự hết hạn thay
   > vì chờ một người nhớ ra mà vào tắt.
---

### 4.2. Danh sách API Endpoints Chính

| HTTP Method | API Endpoint | Mô tả chức năng | Quyền truy cập (Authorization) |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Đăng ký tài khoản mới | Public (`permitAll`) |
| `POST` | `/api/auth/verify-otp` | Xác thực mã OTP Email | Public (`permitAll`) |
| `POST` | `/api/auth/login` | Đăng nhập hệ thống & lấy JWT | Public (`permitAll`) |
| `GET` | `/api/trips/search` | Tìm kiếm chuyến đi & lịch giá | Public (`permitAll`) |
| `POST` | `/api/bookings` | Tạo đơn đặt vé mới | Authenticated (`ROLE_USER`) |
| `GET` | `/api/bookings` | Lấy danh sách lịch sử vé của tôi | Authenticated (`ROLE_USER`) |
| `PUT` | `/api/bookings/{id}/cancel` | Hủy vé & tạo yêu cầu hoàn tiền | Authenticated (`ROLE_USER`) |
| `GET` | `/api/payment/create-vnpay` | Lấy URL chuyển hướng sang VNPay | Authenticated (`ROLE_USER`) |
| `GET` | `/api/payment/vnpay-ipn` | Cổng webhook nhận kết quả VNPay | Public (`permitAll`) |
| `POST` | `/api/chat/message` | Gửi tin nhắn tới Trợ lý AI "Son" | Public / Authenticated |
| `GET` | `/api/admin/revenue` | Lấy thống kê doanh thu & AI Insights | Provider / Admin |
| `PUT` | `/api/provider/check-in/{id}` | Quét mã QR xác nhận lên xe | Provider / Admin |

---
| `GET` | `/api/admin/refunds` | Danh sách yêu cầu hoàn tiền chờ duyệt | Admin |
| `PUT` | `/api/admin/refunds/{id}/approve` | Duyệt yêu cầu hoàn tiền | Admin |
| `PUT` | `/api/admin/refunds/{id}/reject` | Từ chối yêu cầu hoàn tiền | Admin |
| `POST` | `/api/reviews` | Gửi đánh giá chuyến đi | Authenticated (`ROLE_USER`) |
| `GET` | `/api/reviews/trip/{tripId}` | Lấy danh sách đánh giá theo chuyến đi | Public (`permitAll`) |
---

<a name="5-cơ-chế-bảo-mật--an-toàn-dữ-liệu"></a>
## 5. CƠ CHẾ BẢO MẬT & AN TOÀN DỮ LIỆU (SECURITY ARCHITECTURE)

1. **Xác thực & Phân quyền Stateless**:
   - Sử dụng JWT (JSON Web Token) HMAC-SHA256 mã hóa chữ ký.
   - Spring Security Filter Chain kiểm tra Token trong Header `Authorization: Bearer <TOKEN>` trước mỗi request.
   - *(Lộ trình nâng cấp tiếp theo)*: Chuyển đổi sang cơ chế HttpOnly Cookie + Refresh Token (Token Rotation) để triệt tiêu hoàn toàn rủi ro XSS đánh cắp token.

2. **Chống tấn công Brute-force & DDoS**:
   - Tích hợp `RateLimitingFilter` giới hạn tần suất request (10 requests/giây/IP đối với API Đặt vé và Auth).

3. **Bảo mật Thông tin Cá nhân (PII Protection)**:
   - Các API truy vấn danh sách vé bắt buộc lọc theo `user_id` lấy trực tiếp từ `SecurityContextHolder.getContext().getAuthentication()`.
   - AI Chatbot chủ động ép tham số JWT Principal cho các lệnh Tool Call, ngăn chặn triệt để lỗ hổng Prompt Injection / Data Leakage giữa các tài khoản.

4. **An toàn Thanh toán**:
   - Kiểm tra mã Hash HMAC-SHA512 tất cả dữ liệu tham số nhận về từ VNPay IPN, bảo vệ hệ thống khỏi giả mạo giao diện hoặc thay đổi số tiền (Parameter Tampering).

---
*Tài liệu này được biên soạn đầy đủ theo tiêu chuẩn Quốc tế về Đặc tả Phần mềm (IEEE Std 830-1998 / ISO 29148) và sẵn sàng sử dụng cho báo cáo Khoá luận Tốt nghiệp & Chấm điểm Hội đồng.*
