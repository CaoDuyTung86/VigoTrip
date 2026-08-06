# 🎫 Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tập trung vào tính ổn định, quy trình nghiệp vụ chặt chẽ và khả năng phân tích dữ liệu thông minh.

---

## 🌟 Tính Năng Nổi Bật

- **AI Business Intelligence & RAG Chatbot:** Tích hợp mô hình Google Gemini AI với kỹ thuật RAG (Retrieval-Augmented Generation) để tư vấn hành trình, phân tích dữ liệu doanh thu và đưa ra các nhận định chiến lược.
- **Real-time Synchronization:** Đồng bộ trạng thái chỗ ngồi thời gian thực qua WebSocket (STOMP / SockJS) & Seat Lock Service, ngăn chặn tình trạng đặt trùng vé (double-booking).
- **QR Check-in System:** Hệ thống xác thực vé tại bến qua mã QR (ZXing + html5-qrcode), tích hợp trình quét camera trực tiếp trên web, tối ưu cho quy trình soát vé nhanh.
- **Hệ thống Giám sát & Quản lý:** Theo dõi sức khỏe hệ thống (CPU, RAM, Request) qua Prometheus & Grafana; Kiểm soát chất lượng mã nguồn qua SonarQube.
- **Quy trình Thanh toán:** Tích hợp cổng thanh toán VNPay Sandbox, xử lý quy trình đặt chỗ và hoàn tiền tự động.

---

## 🌐 Môi Trường Thử Nghiệm (Staging & Production)

Hệ thống hỗ trợ 2 kiến trúc triển khai điện toán đám mây linh hoạt:

1. **Môi trường Serverless Cloud (Khuyên dùng - 0$ Cost & Auto Scaling):**
   - **Frontend:** [https://vigotrip.vercel.app](https://vigotrip.vercel.app) *(Vercel Global Edge Network)*
   - **Backend API:** `https://datxe-com.onrender.com` *(Render Container Service)*
   - **Database:** Neon Cloud PostgreSQL *(Serverless Database)*
   - **Ưu điểm:** Tự động mở rộng, tự cấp SSL, không tốn phí duy trì hạ tầng, không lo sập server.

2. **Môi trường AWS EC2 (Truyền thống):**
   - **Website:** `https://datxe.duckdns.org` *(AWS EC2 t3.micro)*
   - **Cấu hình:** Docker Compose (7 Container), Nginx Reverse Proxy, Let's Encrypt SSL, AWS RDS SQL Server.

---

## 🛠 Công Nghệ Sử Dụng

| Thành phần | Công nghệ |
| :--- | :--- |
| **Backend** | Java Spring Boot 3, Spring Security 6, JWT, JPA/Hibernate, MapStruct, Caffeine Cache |
| **Frontend** | React (Vite), CSS Variables, Recharts (Biểu đồ), WebSocket Client, PWA |
| **Database** | Neon Cloud PostgreSQL (Serverless) / AWS RDS SQL Server / MS SQL Server 2022 (Local Docker) |
| **Hosting & Cloud** | Vercel (Frontend Edge), Render (Backend Container), Neon (Database), AWS EC2 |
| **DevOps & Tools** | Docker Compose, Nginx Reverse Proxy, Prometheus, Grafana, SonarQube |
| **AI Engine** | Google Gemini AI API (`gemini-2.0-flash` / `gemini-flash-latest`) |
| **Real-time & Security** | WebSocket STOMP, Google OAuth2, ZXing QR Code |

---

## 🎯 Trạng Thái Dự Án (Roadmap)

### Các tính năng đã hoàn thành:
- [x] **Hệ thống lõi:** Quản lý chuyến đi, đặt vé, quản lý người dùng và phân quyền (RBAC).
- [x] **AI Business Intelligence & Chatbot:** Phân tích doanh thu và tư vấn chuyến đi bằng RAG + Google Gemini AI.
- [x] **Real-time Seat Locking:** Đồng bộ khóa ghế ngồi thời gian thực qua WebSocket (STOMP).
- [x] **QR Code Check-in:** Quét mã xác thực vé và xem chi tiết hành trình ngay tại bến.
- [x] **Payment Integration:** Thanh toán qua VNPay và quản lý hoàn tiền (Refund).
- [x] **Monitoring:** Triển khai hạ tầng giám sát hệ thống thời gian thực qua Prometheus & Grafana.
- [x] **Security:** Chuyển đổi quản lý Secret sang biến môi trường (.env), Google OAuth2 và tích hợp quét bảo mật tự động.
- [x] **Code Quality:** Kiểm soát chất lượng mã nguồn qua SonarQube.
- [x] **Cloud Deployment (AWS):** Triển khai dự án lên máy chủ AWS EC2 bằng Docker Compose.
- [x] **Database Cloud:** Cấu hình cơ sở dữ liệu tách biệt kết nối đến AWS RDS SQL Server.
- [x] **Web Server & SSL:** Thiết lập Nginx Reverse Proxy điều hướng luồng mạng và cài đặt chứng chỉ SSL bảo mật (Let's Encrypt).
- [x] **Domain Name:** Đăng ký và cấu hình tên miền `datxe.duckdns.org` trỏ về AWS.
- [x] **Serverless Cloud Deployment:** Triển khai hạ tầng Serverless hoàn chỉnh: Frontend (Vercel Edge Network), Backend (Render Java Container với tối ưu hóa RAM `-Xmx256m`), Database (Neon Cloud Serverless PostgreSQL).
- [x] **Proxy & API Routing:** Cấu hình `vercel.json` rewrites điều hướng trong suốt toàn bộ request `/api` và `/ws` (WebSocket) từ Vercel sang Render.

### Hướng phát triển tiếp theo:
- [ ] **Map Integration:** Tích hợp bản đồ Leaflet / OpenStreetMap để theo dõi lộ trình và định vị bến xe/nhà ga.
---

## 📸 Hướng Dẫn Cài Đặt

1. **Yêu cầu hệ thống:** Đã cài đặt Docker và Docker Compose.
2. **Cấu hình:** Sao chép file `.env.example` thành `.env` và điền các thông số cần thiết (DB, GEMINI_API_KEY, VNPay Config, JWT_SECRET).
3. **Khởi chạy:** 
   ```bash
   docker-compose up -d
   ```
4. **Chi tiết thiết lập:** Xem hướng dẫn chi tiết dành cho AI/Developer tại [AI_ONBOARDING.md](./AI_ONBOARDING.md).

---
*Phát triển bởi nhóm sinh viên Đồ án Tốt nghiệp trường Đại Học CMC - 2026*