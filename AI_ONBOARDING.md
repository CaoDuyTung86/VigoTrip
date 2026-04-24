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

## 6. Common Troubleshooting for AI
- **Database Connection:** If the backend container can't connect to SQL Server, ensure the URL uses `host.docker.internal` instead of `localhost`.
- **JWT Expired:** If API calls return 401, ask the user to re-login.
- **Port Conflict:** If a service fails to start, check if ports 8081, 5173, 9000, or 3000 are already in use.
