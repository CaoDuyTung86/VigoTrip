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

### Step 2: Launch Infrastructure
Run Docker Compose to start all services (Backend, Frontend, Monitoring, SonarQube).
**Command:** `docker compose up --build -d`

### Step 3: Verify Services
- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8081
- **SonarQube:** http://localhost:9000
- **Grafana:** http://localhost:3000

---

## 4. Coding Standards & Git Workflow
To keep the project stable, please enforce these rules on the developer:
1. **Secrets:** NEVER hardcode passwords or API keys. Use variables from `application.yml` and add values to `.env`.
2. **Branching:** DO NOT commit to `main`. Create a feature branch: `git checkout -b feat-[feature-name]`.
3. **Quality:** After finishing a task, run `run_sonar_analysis.bat` and fix any "Blocker" or "Critical" issues before pushing.
4. **Pull Requests:** Always create a PR on GitHub and wait for the CI/CD pipeline (Gitleaks, Build Test) to pass.

---

## 5. Directory Map
- `/backend/ticket-booking`: Main Spring Boot application.
- `/my-react-app`: Main React frontend.
- `/docker-compose.yml`: Infrastructure definition.
- `/.github/workflows`: CI/CD pipelines (Gitleaks, Build tests).
- `/.env`: Local secrets (ignored by git).

---

## 6. Common Troubleshooting for AI
- **Database Connection:** If the backend container can't connect to SQL Server, ensure the URL uses `host.docker.internal` instead of `localhost`.
- **JWT Expired:** If API calls return 401, ask the user to re-login.
- **Port Conflict:** If a service fails to start, check if ports 8081, 5173, 9000, or 3000 are already in use.
