# 🚀 AI Onboarding Guide for Ticket Booking Project

Hi! If you are an AI Assistant (like Cursor, Antigravity, or Claude), please read this document to understand the project and help your human developer get started.

---

## 1. Project Overview
This is a full-stack Ticket Booking System (Flights, Buses, Trains).
- **Backend:** Spring Boot (Java 17) + SQL Server.
- **Frontend:** React (Vite) + Vanilla CSS.
- **Infrastructure:** Docker Compose (Prometheus, Grafana, SonarQube, Postgres).

---

## 2. Mandatory Setup for the Human Developer
Before running the project, ensure the developer has:
1. **Docker Desktop** installed and running.
2. **JDK 17** installed (optional, only needed for local IDE running).
3. **Node.js (v20+)** installed (optional, only needed for local IDE running).
4. **SQL Server:** **Không cần cài đặt SQL Server trên máy thật!** Dự án đã cấu hình sẵn container SQL Server tự động khởi chạy và tạo database thông qua Docker Compose.

---

## 3. Getting Started (Step-by-Step for AI to help)
Please guide the user through these steps:

### Step 1: Configuration
Check if `.env` exists. If not, copy `.env.example` to `.env`.
**Action:** `cp .env.example .env` (if on Linux/macOS) or `copy .env.example .env` (Windows).

### Step 2: Environment Setup (Critical)
To run this project, you MUST create a `.env` file in the root directory. Use `.env.example` as a template.

### Required Secrets:

Sáu biến dưới đây **chặn khởi động** nếu thiếu. Danh sách này phải khớp với
`StartupSecretsValidator.REQUIRED` — sửa một bên thì sửa cả bên kia, vì sai lệch ở đây nghĩa
là người mới điền xong vẫn thấy ứng dụng chết mà không hiểu tại sao.

| Biến | Lấy ở đâu |
| :-- | :-- |
| `SPRING_DATASOURCE_PASSWORD` | Mật khẩu SQL Server. Tự đặt, container sẽ dùng chính nó |
| `JWT_SECRET` | `openssl rand -base64 48`. **Phải là base64 hợp lệ**, không phải "chuỗi 32 ký tự bất kỳ": gõ tay một chuỗi có dấu `-` là ứng dụng không khởi động |
| `VNP_TMN_CODE` | Đăng ký terminal ở sandbox.vnpayment.vn |
| `VNP_HASH_SECRET` | Cùng chỗ với `VNP_TMN_CODE` |
| `ADMIN_PASSWORD` | Tự đặt. `AdminSeeder` đồng bộ lại tài khoản này ở **mỗi** lần khởi động |
| `PROVIDER_PASSWORD` | Tự đặt, như trên |

**Không** bắt buộc, thiếu thì mất tính năng chứ ứng dụng vẫn chạy:

- `GEMINI_API_KEY`, `GROQ_API_KEY` — nhà cung cấp nào bỏ trống khoá sẽ bị loại khỏi
  `LlmRouter` lúc khởi động. Không khai cái nào thì chatbot không còn nhà cung cấp để gọi,
  phần còn lại của hệ thống không bị ảnh hưởng. Truy hồi RAG tự lùi về BM25 thuần.
- `SPRING_MAIL_PASSWORD` / `BREVO_API_KEY` — không có thì không gửi được thư xác nhận vé
  và thư nhắc chuyến. Đặt vé vẫn xong, vé vẫn xem được trong tài khoản.
- `VITE_TURNSTILE_SITE_KEY` — biến của **frontend**, nằm ở `my-react-app/.env.*` chứ không
  phải `.env` gốc. Thiếu thì widget CAPTCHA không hiện mà backend vẫn chặn, nên khách vãng
  lai nhận "Captcha verification failed" ở mọi tin nhắn chatbot.

Đọc `.env.example` ở gốc repo để biết chi tiết từng biến — nó là nguồn đầy đủ nhất, file này
chỉ tóm tắt phần chặn khởi động.

---

## 3. Docker & Infrastructure
The project uses `docker-compose.yml` to orchestrate services.

### Commands:
- **Build and Start:** `docker-compose up --build -d`
- **Stop:** `docker-compose down`
- **Logs:** `docker-compose logs -f [service_name]`

### Local & Staging Services:
- **Frontend (Local):** http://localhost:5173
- **Backend API (Local):** http://localhost:8081
- **Frontend (Serverless Staging):** https://vigotrip.vercel.app (Vercel Edge Network)
- **Backend API (Serverless Staging):** https://datxe-com.onrender.com (Render Container Service)
- **Database (Serverless Staging):** Neon Cloud PostgreSQL
- **SonarQube:** http://localhost:9000
- **Grafana:** http://localhost:3000 (Monitoring)
- **Prometheus:** http://localhost:9090

---

## 4. Coding Standards & Git Workflow
To keep the project stable, please enforce these rules on the developer:
1. **Secrets:** NEVER hardcode passwords or API keys. Use variables from `application.yml` and add values to `.env`.
2. **Branching:** DO NOT commit to `main`. Create a feature branch: `git checkout -b feat-[feature-name]`.
3. **Pull Request:** Before merging, run `run_sonar_analysis.bat` to ensure "Full A" rating and no security vulnerabilities.

---

## 5. Troubleshooting (Common Issues)

### 1. Database Connection Failed
- **Error 10048:** SQL Server port 1433 is occupied. Restart SQL Server service or kill the process.
- **Docker Access:** Use `host.docker.internal` as DB host if SQL Server is on Windows Host.

### 2. Email Sending Failed
- Ensure Gmail App Password is used, not the account password.

### 3. SonarQube Errors
- If the scan fails, ensure the SonarQube container is running at port 9000.
- Check `sonar-project.properties` for correct project keys.

---

## 6. Project Architecture for AI Context
- **Backend:** Spring Boot 3 + JPA + WebSocket (STOMP) + MapStruct + Caffeine Cache.
- **Frontend:** React + Vite + CSS Variables + Recharts + PWA.
- **Real-time:** Handled via `/ws` endpoint for seat synchronization (`SeatLockService`).
- **AI Engine:** Multi-provider LLM Gateway (Gemini + Groq fallback) with Hybrid RAG (vector + BM25, fused by Reciprocal Rank Fusion). Full explanation: [docs/CHATBOT_AI.md](./docs/CHATBOT_AI.md).
- **Security:** JWT stateless filter + Spring Security 6 + Google OAuth2.
- **Static Analysis:** Excluded `target/` and generated `MapperImpl` files to maintain high quality scores.

---

## 7. Notes for AI Assistant (Antigravity/Cursor)
1. **Large Data:** Always use server-side pagination for Admin tables (`/api/admin/trips?page=...&size=...`).
2. **UI Patterns:** Use CSS Variables in `index.css` for theme consistency.
3. **Mappers:** Use MapStruct for Entity-DTO conversion. Avoid manual loops.
4. **Logic:** Keep controllers thin; put business logic in Service classes.
5. **Trip data:** `TripSupplyService` is the *only* place allowed to create trips. It owns the catalogue of real routes per mode and tops the schedule up to a 30-day horizon, keyed per `(route, vehicle type, day)`. **Do not add another seeder** — the bug it replaced was exactly that: two seeders with different route coverage, the later one making production look like only `HAN <-> SGN` and `HAN <-> DAD` existed. Never delete past trips either: `Trip.tickets` cascades `ALL` + `orphanRemoval`, so deleting an old trip deletes the sold tickets that every revenue query in `BookingRepository` joins through.
6. **Analytics/BI:** every number in a report comes from `AnalyticsService.getSummary()` — the dashboard and the AI narrative share it, so they can never disagree. When adding a metric, take the period window `[from, to)` from `ReportPeriod` and pass `providerIds` through; **never** write an analytics query without both. The bug this replaced: only the monthly-revenue chart filtered by date, so a report headed "Tháng 8/2026" was filled with all-time figures. Also note `Booking.totalPrice` (money collected) and `Ticket.price` (per-carrier attribution) legitimately differ — shares are computed on ticket revenue so they total 100%.
7. **Place codes:** a city currently has two codes depending on mode (`HUI`/`HUE`, `CXR`/`NTR`, `DLI`/`DLT`, `VII`/`VIN`), and `QNH` means Quảng Ninh — not Quy Nhơn. Keep the four `CITY_NAME_MAP`-style tables in `AdminRoutes.jsx`, `AdminTrips.jsx`, `TrainTickets.jsx` and `BusTickets.jsx` in agreement. See the `tuyen_duong` notes in `SRS_FSD_SPECIFICATION.md` for the normalisation plan that Map Integration depends on.

### Directory Map
- `/backend/ticket-booking`: Main Spring Boot application.
- `/my-react-app`: Main React frontend.
- `/docker-compose.yml`: Infrastructure definition.
- `/.github/workflows`: CI/CD pipelines (Gitleaks, Build tests).
---

---

## 8. Role-Based Onboarding Guidance (Hướng dẫn theo vai trò)
When new team members join, they can copy the prompt in their section below and paste it into their AI Assistant (Cursor, Windsurf, Claude) to immediately start working.

### 🎨 1. If you are the **Frontend Developer** (React + UI/UX)
* **Your Goals:**
  * Implement **Map Integration** (bản đồ định vị bến xe/lộ trình dùng Leaflet/OpenStreetMap).
  * Expand the **Notification Center** (Zalo, SMS, Email alerts).
  * Optimize UI/UX using CSS Variables in `/my-react-app/src/index.css`.
* **Where to start:**
  * Explore `/my-react-app/src` folder.
  * Read existing routes in `App.jsx` and components in `/components`.
* **AI Prompt to use:**
  > *"I am the Frontend Developer for this project. Read the `/my-react-app` folder. I need to integrate Leaflet map into the frontend. Show me where to register the new route and components, and how to query the backend map APIs."*

### 🧑‍💻 2. If you are the **Backend Developer** (Java Spring Boot + AI)
* **Your Goals:**
  * Maintain core booking, VNPay payment, WebSocket real-time seat lock APIs.
  * Expose APIs for mobile QR scanners and Map integration.
* **Where to start:**
  * Explore `/backend/ticket-booking/src/main/java/com/booking/api`.
  * Review `BookingService.java`, `AuthService.java` and `SecurityConfig.java`.
* **AI Prompt to use:**
  > *"I am the Backend Developer for this project. Read `/backend/ticket-booking` codebase. I need to expose a REST API to authenticate and process QR ticket check-ins for the mobile application. Help me design the DTOs, Controller, and Service logic."*

### 🛡️ 3. If you are the **DevOps & Security Engineer**
* **Your Goals:**
  * Fix SonarQube code smells, security vulnerabilities, and keep Quality Gate "Green".
  * Optimize MS SQL Server database indexes and implement Spring Boot caching.
  * Manage Docker, Prometheus, Grafana, and CI/CD workflows.
* **Where to start:**
  * Explore `/run_sonar_analysis.bat`, `/docker-compose.yml`, `/prometheus.yml` and `/grafana`.
* **AI Prompt to use:**
  > *"I am the DevOps Engineer for this project. Read `/docker-compose.yml`, `/run_sonar_analysis.bat` and `/backend/ticket-booking/pom.xml`. Help me find ways to optimize build times and fix Java code smells flagged by static analysis."*

### 📝 4. If you are the **QA/QC Tester**
* **Your Goals:**
  * Write Unit Tests & Integration Tests for backend services using JUnit 5 & Mockito.
  * Maintain and update `TESTING_CHECKLIST.md`.
* **Where to start:**
  * Explore `/backend/ticket-booking/src/test/java/com/booking/api/service`.
  * Read `BookingServiceTest.java` and `PaymentServiceTest.java`.
* **AI Prompt to use:**
  > *"I am the QA/QC Tester. Read `TESTING_CHECKLIST.md` and the existing tests under `/backend/ticket-booking/src/test`. Help me write unit tests with Mockito to cover voucher application and ticket refund service logic."*

### 📚 5. If you are the **Business Analyst (BA) & Technical Writer**
* **Your Goals:**
  * Draft the official graduation thesis report (Báo cáo Đồ án).
  * Draw UML diagrams (Use Case, Sequence, Class diagrams).
  * Maintain project documentation.
* **Where to start:**
  * Read `THESIS_REPORT_GUIDE.md` and `README.md`.
* **AI Prompt to use:**
  > *"I am the BA & Technical Writer for this project. Read `README.md` and `THESIS_REPORT_GUIDE.md`. Please help me draft the Introduction and System Architecture chapters of our graduation thesis report."*

---

## 9. Branch Protection & Pull Request Workflow (Quy trình đóng góp code)
Nhánh `main` của dự án đã được bảo vệ (Branch Protection). Không thành viên nào có thể commit trực tiếp vào `main`.

### Quy trình đẩy code lên:
1. **Tạo nhánh phụ từ main:**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b [tên_nhánh]  # Ví dụ: git checkout -b feat/map-integration
   ```
2. **Code & Commit:**
   ```bash
   git add .
   git commit -m "feat: mô tả tính năng đã làm"
   ```
3. **Push lên GitHub:**
   ```bash
   git push origin [tên_nhánh]
   ```
4. **Tạo Pull Request (PR):**
   * Truy cập trang web GitHub của dự án.
   * Nhấn nút **"Compare & pull request"** màu vàng.
   * Viết mô tả chi tiết công việc đã làm và nhấn **"Create pull request"**.
5. **Review & Merge:**
   * Team Leader sẽ kiểm tra code của bạn và chạy CI/CD test.
   * Nếu code đạt yêu cầu, Leader sẽ bấm **Merge pull request** để gộp code vào `main`. Nếu không đạt, Leader sẽ comment yêu cầu sửa đổi.

---

---

## 10. Môi trường Production & Staging
Dự án được hỗ trợ chạy thử nghiệm trên cả 2 môi trường Cloud:

### 1. Môi trường Serverless (Khuyên dùng):
* **Tên miền Frontend:** `https://vigotrip.vercel.app` (Bảo mật HTTPS qua Vercel Edge).
* **Backend API:** `https://datxe-com.onrender.com` (Render Container Service).
* **Database:** Neon Cloud Serverless PostgreSQL.

### 2. Môi trường AWS EC2 (Truyền thống):
* **Tên miền:** `https://datxe.duckdns.org` (HTTPS qua Let's Encrypt).
* **Kiến trúc:** Nginx Reverse Proxy + Docker Compose (7 Container) + AWS RDS SQL Server.

### ⚠️ Lưu ý quan trọng cho các lập trình viên & AI Assistant:
1. **Tuyệt đối KHÔNG sử dụng cấu hình AWS/Render dưới Local:** 
   * Khi code dưới máy cá nhân, hãy sử dụng cơ sở dữ liệu nội bộ (Localhost) và cấu hình trong file `.env` cá nhân.
   * Không được đưa các thông tin nhạy cảm (Endpoint RDS, mật khẩu, JWT secret) vào mã nguồn hoặc file `.env.example`.
2. **Cập nhật tính năng:**
   * Luôn kiểm tra hoạt động ổn định ở Local trước khi Push lên Git.
3. **Các API liên kết ngoài (VNPay, Google OAuth):**
   * Các API này đã được đăng ký hoạt động song song cho các môi trường: `http://localhost:5173`, `https://vigotrip.vercel.app` và `https://datxe.duckdns.org`.

