# Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tập trung vào tính ổn định, quy trình nghiệp vụ chặt chẽ và khả năng phân tích dữ liệu thông minh.

---

## Tính Năng Nổi Bật

- **AI Business Intelligence & RAG Chatbot:** Tích hợp mô hình Google Gemini AI với kỹ thuật RAG (Retrieval-Augmented Generation) để tư vấn hành trình, phân tích dữ liệu doanh thu và đưa ra các nhận định chiến lược.
- **Real-time Synchronization:** Đồng bộ trạng thái chỗ ngồi thời gian thực qua WebSocket (STOMP / SockJS) & Seat Lock Service, ngăn chặn tình trạng đặt trùng vé (double-booking).
- **QR Check-in System:** Hệ thống xác thực vé tại bến qua mã QR (ZXing + html5-qrcode), tích hợp trình quét camera trực tiếp trên web, tối ưu cho quy trình soát vé nhanh.
- **Hệ thống Giám sát & Quản lý:** Theo dõi sức khỏe hệ thống (CPU, RAM, Request) qua Prometheus & Grafana; Kiểm soát chất lượng mã nguồn qua SonarQube.
- **Quy trình Thanh toán:** Tích hợp cổng thanh toán VNPay Sandbox, xử lý quy trình đặt chỗ và hoàn tiền tự động.

---

## Môi Trường Thử Nghiệm (Staging & Production)

Hệ thống hỗ trợ 2 kiến trúc triển khai điện toán đám mây linh hoạt:

1. **Môi trường Serverless Cloud (Khuyên dùng - 0$ Cost & Auto Scaling):**
   - **Frontend:** [https://vigotrip.vercel.app](https://vigotrip.vercel.app) _(Vercel Global Edge Network)_
   - **Backend API:** `https://datxe-com.onrender.com` _(Render Container Service)_
   - **Database:** Neon Cloud PostgreSQL _(Serverless Database)_
   - **Ưu điểm:** Tự động mở rộng, tự cấp SSL, không tốn phí duy trì hạ tầng, không lo sập server.

2. **Môi trường AWS EC2 (Truyền thống):**
   - **Website:** `https://datxe.duckdns.org` _(AWS EC2 t3.micro)_
   - **Cấu hình:** Docker Compose (7 Container), Nginx Reverse Proxy, Let's Encrypt SSL, AWS RDS SQL Server.

---

## Công Nghệ Sử Dụng

| Thành phần               | Công nghệ                                                                                   |
| :----------------------- | :------------------------------------------------------------------------------------------ |
| **Backend**              | Java Spring Boot 3, Spring Security 6, JWT, JPA/Hibernate, MapStruct, Caffeine Cache        |
| **Frontend**             | React (Vite), CSS Variables, Recharts (Biểu đồ), WebSocket Client, PWA                      |
| **Database**             | Neon Cloud PostgreSQL (Serverless) / AWS RDS SQL Server / MS SQL Server 2022 (Local Docker) |
| **Hosting & Cloud**      | Vercel (Frontend Edge), Render (Backend Container), Neon (Database), AWS EC2                |
| **DevOps & Tools**       | Docker Compose, Nginx Reverse Proxy, Prometheus, Grafana, SonarQube                         |
| **AI Engine**            | Google Gemini AI API (`gemini-2.0-flash` / `gemini-flash-latest`)                           |
| **Real-time & Security** | WebSocket STOMP, Google OAuth2, ZXing QR Code                                               |

---

## Trạng Thái Dự Án (Roadmap)

### Các tính năng đã hoàn thành:

- [x] **Hệ thống lõi:** Quản lý chuyến đi, đặt vé, quản lý người dùng và phân quyền (RBAC).
- [x] **AI Business Intelligence & Chatbot:** Phân tích doanh thu và tư vấn chuyến đi bằng RAG + Google Gemini AI.
- [x] **Real-time Seat Locking:** Đồng bộ khóa ghế ngồi thời gian thực qua WebSocket (STOMP).
- [x] **QR Code Check-in:** Quét mã xác thực vé và xem chi tiết hành trình ngay tại bến.
- [x] **Payment Integration:** Thanh toán qua VNPay Sanbox và quản lý hoàn tiền (Refund).
- [x] **Monitoring:** Triển khai hạ tầng giám sát hệ thống thời gian thực qua Prometheus & Grafana.
- [x] **Security:** Chuyển đổi quản lý Secret sang biến môi trường (.env), Google OAuth2 và tích hợp quét bảo mật tự động.
- [x] **Code Quality:** Kiểm soát chất lượng mã nguồn qua SonarQube.
- [x] **Database Cloud:** Cấu hình cơ sở dữ liệu tách biệt kết nối đến Neon Cloud PostgreSQL (Serverless).
- [x] **Serverless Cloud Deployment:** Triển khai hạ tầng Serverless hoàn chỉnh: Frontend (Vercel Edge Network), Backend (Render Java Container với tối ưu hóa RAM `-Xmx256m`), Database (Neon Cloud Serverless PostgreSQL).
- [x] **Proxy & API Routing:** Cấu hình `vercel.json` rewrites điều hướng trong suốt toàn bộ request `/api` và `/ws` (WebSocket) từ Vercel sang Render.

### Hướng phát triển tiếp theo:

- [ ] **Zero-Trust Auth & Security Hardening (HttpOnly Cookie + Refresh Token):** Nâng cấp cơ chế xác thực sang HttpOnly Cookie kết hợp Refresh Token (Token Rotation), lưu Access Token ngắn hạn trong in-memory state (React Context), loại bỏ hoàn toàn việc lưu JWT tại localStorage nhằm triệt tiêu nguy cơ tấn công XSS đánh cắp phiên đăng nhập.
- [ ] **Advanced RAG & Vector Database:** Nâng cấp hệ thống tri thức Chatbot lên Vector DB (ChromaDB / Qdrant) kết hợp Hybrid RAG và Semantic Search đa ngôn ngữ.
- [ ] **Multi-model LLM Gateway:** Tích hợp bộ điều phối (Router & Fallback) tự động chuyển đổi giữa Gemini, GPT-4o, và LLaMA nhằm tối ưu chi phí và tính sẵn sàng (High Availability).
- [ ] **AI BI 2.0 (Text-to-SQL & Predictive Analytics):** Hỗ trợ Admin truy vấn dữ liệu kinh doanh bằng ngôn ngữ tự nhiên (NL2SQL), dự báo nhu cầu đặt vé theo mùa vụ (Time-series Forecasting) và gợi ý định giá vé động (Dynamic Pricing).
- [ ] **Map & Realtime Tracking:** Tích hợp bản đồ Leaflet / Mapbox theo dõi lộ trình di chuyển và định vị bến bãi, nhà ga thời gian thực.

---

## Hướng Dẫn Cài Đặt

1. **Yêu cầu hệ thống:** Đã cài đặt Docker và Docker Compose.
2. **Cấu hình:** Sao chép file `.env.example` thành `.env` và điền các thông số cần thiết (DB, GEMINI_API_KEY, VNPay Config, JWT_SECRET).
3. **Khởi chạy:**
   ```bash
   docker-compose up -d
   ```
4. **Chi tiết thiết lập:** Xem hướng dẫn chi tiết dành cho AI/Developer tại [AI_ONBOARDING.md](./AI_ONBOARDING.md).

---

_Phát triển bởi nhóm sinh viên Đồ án Tốt nghiệp trường Đại Học CMC - 2026_
