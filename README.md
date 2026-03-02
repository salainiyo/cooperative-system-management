# Cooperative Financial Management System (Ikimina)

A robust, full-stack financial management platform designed to digitize operations, track savings, and completely manage loan lifecycles for a local cooperative. 

Built with a focus on mathematical accuracy and data integrity, this system handles complex financial logic including automated waterfall payment distributions, dynamic interest calculations, and time-based late fee penalties.

## 🚀 Tech Stack

**Backend**
* **Framework:** Python 3.11, FastAPI
* **Database & ORM:** SQLite, SQLModel, Alembic (Migrations)
* **Testing:** Pytest
* **Security:** JWT Authentication, Role-Based Access Control (RBAC)

**Frontend**
* **Framework:** React.js (Vite)
* **Web Server:** Nginx

**Infrastructure & DevOps**
* **Containerization:** Docker, Docker Compose (Multi-stage builds)
* **Caching & Rate Limiting:** Redis, SlowAPI
* **CI/CD:** GitHub Actions (Automated Pytest suites on push/PR)

## ✨ Key Features

* **Bulletproof Financial Logic:** Double-entry style accounting principles to prevent data corruption. Payments are automatically routed through a waterfall system (Late Fees → Interest → Principal) with overpayment safeguards.
* **Zero-Cost Notifications:** Replaced expensive/heavy SMTP email infrastructure with dynamic "Add to Calendar" links for loan due dates.
* **Redis-Backed Rate Limiting:** Global rate limiting across all API endpoints using a dedicated Redis container to protect against brute-force attacks.
* **Persistent Local Deployment:** Fully containerized architecture using Docker volumes, allowing the cooperative to run an isolated, air-gapped system without losing data between server restarts.

## 🛠️ Local Development & Deployment

This project is fully containerized. You do not need Python or Node installed locally—only Docker.

### 1. Prerequisites
* [Docker](https://docs.docker.com/get-docker/) and Docker Compose installed.

### 2. Environment Setup
Create a `.env` file inside the `backend/` directory with the following variables:
```text
DATABASE_URL=sqlite:///./data/users.db
REDIS_URL=redis://redis:6379/0
SECRET_KEY=your_super_secret_jwt_key
ALGORITHM=HS256
EXPIRATION_TIME_MINUTES=30
EXPIRATION_TIME_DAYS = 3
