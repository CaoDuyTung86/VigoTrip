# 🎫 Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tập trung vào tính ổn định, quy trình nghiệp vụ chặt chẽ và khả năng phân tích dữ liệu thông minh.

---

## 🌟 Tính Năng Nổi Bật

- **AI Business Intelligence:** Tích hợp mô hình ngôn ngữ lớn (Llama 3) để phân tích dữ liệu, dự báo xu hướng và đưa ra các nhận định chiến lược cho nhà cung cấp.
- **Real-time Synchronization:** Đồng bộ trạng thái chỗ ngồi thời gian thực qua WebSocket (STOMP), ngăn chặn tình trạng đặt trùng vé (double-booking).
- **QR Check-in System:** Hệ thống xác thực vé tại bến qua mã QR, tích hợp trình quét camera trực tiếp trên web, tối ưu cho quy trình soát vé nhanh.
- **Hệ thống Giám sát & Quản lý:** Theo dõi sức khỏe hệ thống (CPU, RAM, Request) qua Prometheus & Grafana; Quản lý chất lượng mã nguồn qua SonarQube.
- **Quy trình Thanh toán:** Tích hợp cổng thanh toán VNPay, xử lý quy trình đặt chỗ và hoàn tiền tự động.

---

## 🛠 Công Nghệ Sử Dụng

| Thành phần | Công nghệ |
| :--- | :--- |
| **Backend** | Java Spring Boot 3, Spring Security, JWT, JPA/Hibernate |
| **Frontend** | React (Vite), Recharts (Biểu đồ), WebSocket Client |
| **Database** | MS SQL Server |
| **DevOps** | Docker, Prometheus, Grafana, SonarQube |
| **AI Engine** | Groq API (Llama 3.3) |

---

## 🎯 Trạng Thái Dự Án (Roadmap)

### Các tính năng đã hoàn thành:
- [x] **Hệ thống lõi:** Quản lý chuyến đi, đặt vé, quản lý người dùng và phân quyền (RBAC).
- [x] **AI Analytics:** Phân tích doanh thu và dự báo kinh doanh thông minh.
- [x] **Real-time Seat Booking:** Đồng bộ ghế ngồi qua WebSocket.
- [x] **QR Code Check-in:** Quét mã xác thực vé và xem chi tiết hành trình ngay tại bến.
- [x] **Payment Integration:** Thanh toán qua VNPay và quản lý hoàn tiền (Refund).
- [x] **Monitoring:** Triển khai hạ tầng giám sát hệ thống thời gian thực.
- [x] **Security:** Chuyển đổi quản lý Secret sang biến môi trường (.env) và tích hợp quét bảo mật tự động.
- [x] **Code Quality:** Kiểm soát chất lượng mã nguồn qua SonarQube.

### Hướng phát triển tiếp theo:
- [ ] **Map Integration:** Tích hợp bản đồ để theo dõi lộ trình và định vị bến xe/nhà ga.
- [ ] **Notification Center:** Mở rộng thông báo qua nhiều kênh (Zalo, SMS) thay vì chỉ Email.

---

## 📸 Hướng Dẫn Cài Đặt

1. **Yêu cầu hệ thống:** Đã cài đặt Docker và Docker Compose.
2. **Cấu hình:** Sao chép file `.env.example` thành `.env` và điền các thông số cần thiết (DB, Groq API Key, VNPay Config).
3. **Khởi chạy:** 
   ```bash
   docker-compose up -d
   ```
4. **Chi tiết thiết lập:** Xem hướng dẫn chi tiết dành cho AI/Developer tại [AI_ONBOARDING.md](./AI_ONBOARDING.md).

---
*Phát triển bởi nhóm sinh viên Đồ án Tốt nghiệp trường Đại Học CMC - 2026*