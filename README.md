# 🎫 Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tích hợp các công nghệ hiện đại để đảm bảo tính ổn định, bảo mật và trải nghiệm người dùng tối ưu.

---

## 🌟 Tính Năng Đột Phá

- **Real-time Seat Sync:** Sử dụng Spring WebSocket (STOMP) để đồng bộ hóa chỗ ngồi thời gian thực, ngăn chặn đặt trùng vé.
- **PWA (Mobile App Ready):** Giao diện Responsive cực tốt, có thể cài đặt như ứng dụng Native trên iOS và Android.
- **AI Consultation Chatbot:** Tích hợp AI (Gemini/Llama) để tư vấn chuyến đi, voucher và hỗ trợ khách hàng.
- **QR Check-in System:** Quét mã QR trực tiếp trên trình duyệt điện thoại để xác thực hành khách tại bến.
- **Advanced Monitoring:** Theo dõi sức khỏe hệ thống (CPU, RAM, Request) qua bộ đôi Prometheus & Grafana.
- **Chất lượng Code:** Đạt chuẩn **Full A** (Security, Reliability, Maintainability) theo đánh giá của SonarQube.

---

## 🛠 Công Nghệ Cốt Lõi

| Thành phần | Công nghệ |
| :--- | :--- |
| **Backend** | Java Spring Boot 3, Spring Security, JWT, JPA/Hibernate |
| **Frontend** | React (Vite), CSS Variables, WebSocket Client |
| **Database** | MS SQL Server |
| **DevOps** | Docker, SonarQube, Gitleaks, Prometheus, Grafana |
| **AI/LLM** | Groq API (Llama 3.3), Google Gemini |

---

## 📸 Demo & Hướng Dẫn

- **Cách chạy dự án:** Vui lòng đọc chi tiết tại [AI_ONBOARDING.md](./AI_ONBOARDING.md).
- **Hướng dẫn cho AI:** Cung cấp file [AI_ONBOARDING.md](./AI_ONBOARDING.md) cho AI Assistant của bạn để thiết lập môi trường trong 1 phút.
- **Báo cáo đồ án:** Tham khảo khung sườn và số liệu tại [THESIS_REPORT_GUIDE.md](./THESIS_REPORT_GUIDE.md).

---

## 📂 Cấu Trúc Dự Án

- `/backend/ticket-booking`: Logic nghiệp vụ & API.
- `/my-react-app`: Giao diện người dùng & Admin.
- `docker-compose.yml`: Quản lý hạ tầng (DB, Monitoring, Sonar).

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

*Phát triển bởi nhóm sinh viên Đồ án Tốt nghiệp trường Đại Học CMC - 2026*