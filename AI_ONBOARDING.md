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
2. **JDK 17** installed.
3. **Node.js (v20+)** installed.
4. **SQL Server** running on the host machine (Windows) or update the connection string.

---

## 3. Getting Started (Step-by-Step for AI to help)
Please guide the user through these steps:

### Step 1: Configuration
Check if `.env` exists. If not, copy `.env.example` to `.env`.
**Action:** `cp .env.example .env` (if on Linux/macOS) or `copy .env.example .env` (Windows).

### Step 2: Environment Setup (Critical)
To run this project, you MUST create a `.env` file in the root directory. Use `.env.example` as a template.

### Required Secrets:
- `SPRING_DATASOURCE_PASSWORD`: SQL Server password.
- `SPRING_MAIL_PASSWORD`: Gmail App Password (2-Factor Auth required).
- `JWT_SECRET`: Secret key for token signing (min 32 chars).
- `VNP_HASH_SECRET`: Provided by VNPay Sandbox.
- `GEMINI_API_KEY`: For the AI Chatbot feature.

---

## 3. Docker & Infrastructure
The project uses `docker-compose.yml` to orchestrate services.

### Commands:
- **Build and Start:** `docker-compose up --build -d`
- **Stop:** `docker-compose down`
- **Logs:** `docker-compose logs -f [service_name]`

### Local Services:
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8081
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
- **Backend:** Spring Boot 3 + JPA + WebSocket (STOMP).
- **Frontend:** React + Vite + CSS Variables.
- **Real-time:** Handled via `/ws` endpoint for seat synchronization.
- **Security:** JWT stateless filter + Spring Security.
- **Static Analysis:** Excluded `target/` and generated `MapperImpl` files to maintain high quality scores.

---

## 7. Notes for AI Assistant (Antigravity/Cursor)
1. **Large Data:** Always use server-side pagination for Admin tables (`/api/admin/trips?page=...&size=...`).
2. **UI Patterns:** Use CSS Variables in `index.css` for theme consistency.
3. **Mappers:** Use MapStruct for Entity-DTO conversion. Avoid manual loops.
4. **Logic:** Keep controllers thin; put business logic in Service classes.

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

## 10. Môi trường Production (AWS EC2)
Dự án đã được triển khai chạy thử nghiệm (Staging/Production) tại đám mây AWS.

### Thông tin môi trường:
* **Tên miền:** `https://datxe.duckdns.org` (Hỗ trợ đầy đủ HTTPS bảo mật bởi Let's Encrypt).
* **Kiến trúc trên AWS:**
  * Cổng `80/443 (HTTP/HTTPS)` được quản lý bởi **Nginx** cài trên máy chủ Ubuntu.
  * Nginx đóng vai trò Reverse Proxy điều hướng:
    * Mọi yêu cầu thông thường `/` ➔ React Frontend (đang chạy cổng docker `5173`).
    * Mọi yêu cầu API `/api` ➔ Spring Boot Backend (đang chạy cổng docker `8081`).
  * **Database:** Kết nối trực tiếp tới **AWS RDS SQL Server** (cấu hình bảo mật riêng biệt).

### ⚠️ Lưu ý quan trọng cho các lập trình viên & AI Assistant:
1. **Tuyệt đối KHÔNG sử dụng cấu hình AWS dưới Local:** 
   * Khi code dưới máy cá nhân, hãy sử dụng cơ sở dữ liệu nội bộ (Localhost) và cấu hình trong file `.env` cá nhân.
   * Không được đưa các thông tin nhạy cảm của AWS (Endpoint RDS, mật khẩu, JWT secret của AWS) vào mã nguồn hoặc file `.env.example`.
2. **Cập nhật tính năng:**
   * Luôn kiểm tra hoạt động ổn định ở Local trước khi Push lên Git.
   * Khi code mới được merge vào nhánh `main`, Server AWS sẽ pull về và cập nhật thông qua lệnh:
     ```bash
     git pull
     docker compose up --build -d
     ```
3. **Các API liên kết ngoài (VNPay, Google OAuth):**
   * Các API này đã được đăng ký hoạt động song song cho cả hai môi trường: `http://localhost:5173` và `https://datxe.duckdns.org`.

