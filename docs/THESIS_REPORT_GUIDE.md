# 🎓 Hướng Dẫn Trình Bày Báo Cáo Đồ Án Tốt Nghiệp

Tài liệu này tóm tắt các điểm mạnh kỹ thuật và tính năng đặc sắc của dự án **Hệ thống Đặt Vé Đa Phương Tiện (Datxe.com)** để phục vụ việc viết báo cáo và thuyết trình.

---

## 🏗️ 1. Kiến Trúc & Công Nghệ (Architecture & Tech Stack)
*   **Backend:** Java 17, Spring Boot 3, Spring Security 6 (JWT + Google OAuth2), Hibernate/JPA, MapStruct (Data Mapper).
*   **Frontend:** ReactJS (Vite), CSS Variables (Dark/Light mode), Recharts, Responsive Design.
*   **Database:** MS SQL Server 2022 (Quản lý dữ liệu quan hệ), Caffeine Cache (Bộ nhớ đệm hiệu năng cao).
*   **Real-time:** WebSocket (STOMP / SockJS) để đồng bộ và khóa ghế thời gian thực (`SeatLockService`).
*   **AI Engine:** Google Gemini AI API kết hợp kiến trúc RAG (Retrieval-Augmented Generation) cho Chatbot & Business Intelligence.
*   **Infrastructure & Deployment:** 
    *   **Mô hình Serverless (Vercel + Render + Neon):** Tách biệt Frontend (Vercel Edge Network), Backend (Render Container) và Database (Neon Serverless PostgreSQL). Tối ưu chi phí 0$, tự động mở rộng và không cần quản trị hạ tầng.
    *   **Mô hình Docker IaaS (AWS EC2):** Đóng gói 7 container (Spring Boot, Nginx, Prometheus, Grafana, SonarQube, SQL Server) phục vụ giám sát và triển khai toàn diện.
    *   **PWA (Progressive Web App):** Cho phép cài đặt ứng dụng trên điện thoại không cần qua App Store/Google Play.

---

## 🛠️ 2. Quy Trình Phát Triển Chuyên Nghiệp (DevOps & Quality Control)
*Đây là phần cực kỳ quan trọng để lấy điểm tuyệt đối về kỹ thuật:*
*   **CI/CD (GitHub Actions):** Tự động hóa quy trình Build và Test mỗi khi push code.
*   **Secret Management:** Sử dụng `.env` và biến môi trường để bảo mật thông tin nhạy cảm (API Key, JWT Secret, VNPay Secret).
*   **Security Scanning (Gitleaks):** Tự động ngăn chặn việc rò rỉ mật khẩu trong lịch sử Git.
*   **Static Code Analysis (SonarQube):** Kiểm soát chất lượng mã nguồn, phát hiện sớm Bug và Code Smell. (Trích xuất biểu đồ từ `localhost:9000`).
*   **Monitoring (Prometheus & Grafana):** Theo dõi hiệu năng hệ thống, CPU, Memory và lưu lượng request qua Spring Actuator & Micrometer.

---

## 🌟 3. Các Tính Năng Đột Phá (Key Features)
1.  **Hệ thống QR Check-in:** Sinh mã QR qua ZXing, quét mã xác thực vé tại bến bằng Camera di động (html5-qrcode), tích hợp Modal xem chi tiết hành khách.
2.  **Real-time Seat Locking:** Sử dụng WebSocket (STOMP) để khóa ghế tạm thời và đồng bộ trạng thái, ngăn ngừa trùng ghế.
3.  **AI Assistant & BI (RAG + Google Gemini):** AI đọc dữ liệu thực tế chuyến đi và doanh thu trong CSDL để tư vấn khách hàng và hỗ trợ nhà xe phân tích kinh doanh.
4.  **Hệ thống Voucher & Khuyến mãi:** Logic áp dụng mã giảm giá phức tạp (theo loại phương tiện, giá tối thiểu).
5.  **Multi-channel Notification & Auth:** Quy trình xác thực qua Email OTP và đăng nhập nhanh Google OAuth2.

---

## 🏗️ 4. Kiến Trúc Hệ Thống (Architecture)
*   **Mô hình:** Client-Server, Stateless REST API.
*   **Security:** JWT Filter, Spring Security 6, Password Encoding (BCrypt), Google OAuth2.
*   **Database Patterns:** DTO, Data Mapper (MapStruct 1.6.3), Repository Pattern, Service Layer.
*   **Optimization:** Server-side Pagination & Caffeine Cache giúp hệ thống chịu tải tốt.

---

## 🛡️ 5. Quản Lý Chất Lượng (Quality Assurance)
*   **Static Code Analysis:** Sử dụng SonarQube để đảm bảo code sạch (Clean Code), không có lỗi bảo mật (Vulnerabilities) và lỗi tiềm tàng (Bugs).
*   **Security Scanning:** Dùng Gitleaks để ngăn chặn việc lộ lọt thông tin nhạy cảm.
*   **Unit Testing:** Xây dựng bộ test case bằng JUnit 5 & Mockito cho các nghiệp vụ lõi.
*   **Monitoring:** Theo dõi sức khỏe hệ thống bằng Prometheus & Grafana (CPU, Heap Memory, Request Count).

---

## 📊 6. Gợi Ý Các Số Liệu Đưa Vào Báo Cáo
*   **Chất lượng Code:** Chụp màn hình Dashboard SonarQube với điểm **Full A** để minh chứng cho độ chuyên nghiệp.
*   **Hiệu năng:** Chụp biểu đồ Grafana khi hệ thống đang chạy.
*   **Độ bao phủ:** Báo cáo tỉ lệ Unit Test Coverage (Target 80%).

---

## 🤖 7. Hướng dẫn cho AI Assistant (Future Reference)
*Khi nhờ AI tư vấn viết báo cáo, hãy cung cấp file này và yêu cầu:*
- "Dựa trên mục 3 và 5, hãy viết nội dung cho Chương 'Giải pháp và Thực thi'."
- "Dựa trên mục 4, hãy vẽ biểu đồ tuần tự (Sequence Diagram) cho tính năng đặt vé và khóa ghế WebSocket."
1.  "Dựa vào mục 2, hãy viết chương 'Quy trình đảm bảo chất lượng phần mềm' cho báo cáo."
2.  "Dựa vào mục 3, hãy viết mô tả chi tiết luồng nghiệp vụ của tính năng QR Check-in."
3.  "Hãy lập bảng so sánh ưu điểm của việc dùng Docker so với cài đặt phần mềm truyền thống cho dự án này."
