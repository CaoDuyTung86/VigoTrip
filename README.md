# Hệ Thống Đặt Vé Đa Phương Tiện (Ticket Booking System)

Dự án đồ án tốt nghiệp cung cấp giải pháp đặt vé toàn diện cho máy bay, tàu hỏa và xe khách. Hệ thống tập trung vào tính ổn định, quy trình nghiệp vụ chặt chẽ và khả năng phân tích dữ liệu thông minh.

---

## Tính Năng Nổi Bật

- **AI Chatbot với Hybrid RAG:** Tri thức lưu trong CSDL kèm vector embedding, truy hồi lai giữa tìm kiếm ngữ nghĩa (cosine) và BM25, hợp nhất bằng Reciprocal Rank Fusion. Đo được: recall@3 94.7%, MRR 0.795 trên bộ 57 câu hỏi vàng.
- **Multi-model LLM Gateway:** Bộ điều phối tự động chuyển đổi giữa các nhà cung cấp LLM (Gemini, Groq) kèm circuit breaker và metric Prometheus, bảo đảm chatbot vẫn trả lời khi một nhà cung cấp trả 429/503.
- **AI Business Intelligence:** Phân tích dữ liệu doanh thu và đưa ra các nhận định chiến lược cho Admin & Nhà xe.
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
| **Backend**              | Java Spring Boot 4, Spring Security 6, JWT, JPA/Hibernate, MapStruct, Caffeine Cache        |
| **Frontend**             | React (Vite), CSS Variables, Recharts (Biểu đồ), WebSocket Client, PWA                      |
| **Database**             | Neon Cloud PostgreSQL (Serverless) / AWS RDS SQL Server / MS SQL Server 2022 (Local Docker) |
| **Hosting & Cloud**      | Vercel (Frontend Edge), Render (Backend Container), Neon (Database), AWS EC2                |
| **DevOps & Tools**       | Docker Compose, Nginx Reverse Proxy, Prometheus, Grafana, SonarQube                         |
| **AI Engine**            | Multi-provider LLM Gateway (giao thức OpenAI-compatible): Google Gemini, Groq fallback      |
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
- [x] **Advanced RAG & Hybrid Search:** Knowledge base chuyển từ hằng số hardcode sang bảng `tri_thuc` trong CSDL, mỗi chunk kèm vector embedding. Truy hồi lai vector + BM25 hợp nhất bằng Reciprocal Rank Fusion, tự suy giảm êm về BM25 khi thiếu API key. Có API quản trị tri thức cho Admin và bộ đo chất lượng truy hồi tự động (recall@3, MRR).
- [x] **Multi-model LLM Gateway:** Tầng `LlmRouter` với chuỗi nhà cung cấp cấu hình được, tự động failover khi gặp 429/5xx, circuit breaker theo từng nhà cung cấp, và metric Prometheus (`llm_requests_total`, `llm_fallback_total`, `llm_latency_seconds`).
- [x] **AI Hardening & Cost Control:** Đóng lỗ hổng bypass CAPTCHA, siết rate limit chống giả mạo IP qua `X-Forwarded-For`, timeout HTTP cho mọi lời gọi ra ngoài, và trần ngân sách LLM theo ngày cho toàn hệ thống.
- [x] **Chat History:** Lưu hội thoại cho người dùng đã đăng nhập, chỉ chính chủ đọc được, tự động xóa sau 30 ngày.
- [x] **Proxy & API Routing:** Cấu hình `vercel.json` rewrites điều hướng trong suốt toàn bộ request `/api` và `/ws` (WebSocket) từ Vercel sang Render.

### Hướng phát triển tiếp theo:

- [ ] **Zero-Trust Auth & Security Hardening (HttpOnly Cookie + Refresh Token):** Nâng cấp cơ chế xác thực sang HttpOnly Cookie kết hợp Refresh Token (Token Rotation), lưu Access Token ngắn hạn trong in-memory state (React Context), loại bỏ hoàn toàn việc lưu JWT tại localStorage nhằm triệt tiêu nguy cơ tấn công XSS đánh cắp phiên đăng nhập.
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
5. **Tìm hiểu Chatbot AI:** Giải thích toàn diện về kiến trúc RAG, LLM Gateway, cách đo chất lượng (Recall@3, MRR, F1) và các quyết định thiết kế: [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md).
6. **Demo & kiểm thử bản deploy:** Kịch bản demo theo từng màn kèm checklist smoke test sau mỗi lần deploy: [docs/DEMO_SCRIPT.md](./docs/DEMO_SCRIPT.md).

---

_Phát triển bởi nhóm sinh viên Đồ án Tốt nghiệp trường Đại Học CMC - 2026_
