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
1.  **Hệ thống QR Check-in:** Quét mã xác thực vé tại bến bằng Camera di động, hỗ trợ đa thiết bị, có lịch sử và chi tiết hành khách.
2.  **Real-time Seat Sync:** Ngăn chặn việc đặt trùng ghế nhờ cơ chế đẩy dữ liệu thời gian thực qua WebSocket.
3.  **AI Chatbot (RAG):** Tư vấn khách hàng thông minh bằng trí tuệ nhân tạo, hiểu ngữ cảnh và dữ liệu của dự án.
4.  **Hệ thống Voucher & Khuyến mãi:** Cơ chế áp dụng mã giảm giá linh hoạt cho từng lộ trình.
5.  **Multi-channel Notification:** Gửi thông báo xác nhận qua Email tự động.

---

## 📊 4. Gợi Ý Các Số Liệu Đưa Vào Báo Cáo
*   **Chất lượng Code:** Chụp màn hình Dashboard SonarQube để minh chứng cho việc code đạt chuẩn công nghiệp.
*   **Hiệu năng:** Chụp biểu đồ Grafana để thấy hệ thống hoạt động ổn định dưới tải trọng giả lập.
*   **Tính thực tế:** Ảnh chụp màn hình ứng dụng chạy trên Safari/Chrome của điện thoại (giao diện PWA).

---

## 🤖 5. Hướng dẫn cho AI Assistant (Future Reference)
*Khi nhờ AI tư vấn viết báo cáo, hãy cung cấp file này và yêu cầu:*
1.  "Dựa vào mục 2, hãy viết chương 'Quy trình đảm bảo chất lượng phần mềm' cho báo cáo."
2.  "Dựa vào mục 3, hãy viết mô tả chi tiết luồng nghiệp vụ của tính năng QR Check-in."
3.  "Hãy lập bảng so sánh ưu điểm của việc dùng Docker so với cài đặt phần mềm truyền thống cho dự án này."
