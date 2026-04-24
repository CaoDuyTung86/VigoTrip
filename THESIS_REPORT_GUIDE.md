# 🎓 Hướng Dẫn Trình Bày Báo Cáo Đồ Án Tốt Nghiệp

Tài liệu này tóm tắt các điểm mạnh kỹ thuật và tính năng đặc sắc của dự án **Hệ thống Đặt Vé Đa Phương Tiện (Datxe.com)** để phục vụ việc viết báo cáo và thuyết trình.

---

## 🏗️ 1. Kiến Trúc & Công Nghệ (Architecture & Tech Stack)
*   **Backend:** Java 17, Spring Boot 3, Spring Security (JWT), Hibernate/JPA.
*   **Frontend:** ReactJS (Vite), CSS Variables (Dark/Light mode), Responsive Design.
*   **Database:** MS SQL Server (Quản lý dữ liệu quan hệ), Redis (Caching - dự kiến).
*   **Real-time:** WebSocket (STOMP) để đồng bộ trạng thái ghế ngồi tức thời.
*   **Infrastructure:** 
    *   **Docker & Docker Compose:** Đóng gói toàn bộ hệ thống giúp triển khai nhất quán trên mọi môi trường.
    *   **PWA (Progressive Web App):** Cho phép cài đặt ứng dụng trên điện thoại không cần qua App Store/Google Play.

---

## 🛠️ 2. Quy Trình Phát Triển Chuyên Nghiệp (DevOps & Quality Control)
*Đây là phần cực kỳ quan trọng để lấy điểm tuyệt đối về kỹ thuật:*
*   **CI/CD (GitHub Actions):** Tự động hóa quy trình Build và Test mỗi khi push code.
*   **Secret Management:** Sử dụng `.env` và biến môi trường để bảo mật thông tin nhạy cảm (API Key, Password).
*   **Security Scanning (Gitleaks):** Tự động ngăn chặn việc rò rỉ mật khẩu trong lịch sử Git.
*   **Static Code Analysis (SonarQube):** Kiểm soát chất lượng mã nguồn, phát hiện sớm Bug và Code Smell. (Có thể trích xuất biểu đồ từ `localhost:9000`).
*   **Monitoring (Prometheus & Grafana):** Theo dõi hiệu năng hệ thống, lưu lượng truy cập và tài nguyên máy chủ theo thời gian thực.

---

## 🌟 3. Các Tính Năng Đột Phá (Key Features)
1.  **Hệ thống QR Check-in:** Quét mã xác thực vé tại bến bằng Camera di động, hỗ trợ đa thiết bị, tích hợp Modal xem chi tiết hành khách.
2.  **Real-time Seat Sync:** Sử dụng WebSocket (STOMP) để khóa ghế tạm thời và đồng bộ trạng thái, đảm bảo tính toàn vẹn dữ liệu.
3.  **AI Chatbot (RAG):** Sử dụng kỹ thuật Retrieval-Augmented Generation để AI hiểu được dữ liệu chuyến đi thực tế và tư vấn chính xác.
4.  **Hệ thống Voucher & Khuyến mãi:** Logic áp dụng mã giảm giá phức tạp (theo loại phương tiện, giá tối thiểu).
5.  **Multi-channel Notification:** Quy trình xác thực 2 lớp qua Email OTP.

---

## 🏗️ 4. Kiến Trúc Hệ Thống (Architecture)
*   **Mô hình:** Client-Server, Stateless REST API.
*   **Security:** JWT Filter, Spring Security 6, Password Encoding (BCrypt).
*   **Database Patterns:** DTO, Data Mapper (MapStruct), Repository Pattern, Service Layer.
*   **Optimization:** Server-side Pagination giúp hệ thống chịu tải tốt với hàng triệu bản ghi.

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
- "Dựa trên mục 4, hãy vẽ biểu đồ tuần tự (Sequence Diagram) cho tính năng đặt vé."
1.  "Dựa vào mục 2, hãy viết chương 'Quy trình đảm bảo chất lượng phần mềm' cho báo cáo."
2.  "Dựa vào mục 3, hãy viết mô tả chi tiết luồng nghiệp vụ của tính năng QR Check-in."
3.  "Hãy lập bảng so sánh ưu điểm của việc dùng Docker so với cài đặt phần mềm truyền thống cho dự án này."
