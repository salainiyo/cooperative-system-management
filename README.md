# Cooperative Financial Management System (Ikimina)

A full-stack financial management platform for a local savings cooperative (Ikimina):
member savings, loans with declining-balance interest and late fees, repayments,
member self-service portal, password recovery over email, portfolio reporting and CSV exports.

Built around mathematical accuracy and data integrity: payments are distributed with a
waterfall rule (late fees → interest → principal), balances are recalculated from the
transaction history, and every financial rule is configurable from the admin UI.

## Tech stack

**Backend** — Python 3.11, FastAPI, SQLModel/SQLite, Alembic migrations, SlowAPI rate limiting (Redis),
JWT auth with RBAC, Fernet-encrypted secrets, pytest.

**Frontend** — React 18 + Vite, Tailwind CSS, Recharts, code-split routes (React.lazy),
Vitest + React Testing Library.

**Infrastructure** — Docker Compose, Caddy (HTTPS + `/api` reverse proxy), GitHub Actions CI
(backend pytest **and** frontend vitest/build on every push/PR), Terraform + Ansible
deployment to Oracle Cloud Always Free.

## Key features

**Admin console**
* Dashboard with KPI cards (`?` tooltips explaining every metric), 30-day trend badges,
  savings-growth and disbursed-vs-collected charts, capital health & loan performance panels.
* Members directory, member profiles, deposits/withdrawals, loan issuance, payments with
  waterfall allocation, printable member statements.
* **Due Payments (Collections Radar)** — one backend query powers the whole table
  (no N+1), filters for due-this-week / overdue, calendar reminders.
* **All Loans** — paginated, filterable list with CSV export.
* Loan requests queue (approve/reject with notes → creates the loan, emails the member).
* Reports: portfolio aging + Portfolio-at-Risk, collections, savings/loans/payments CSV exports.
* Settings: organisation name, interest rate (default 1.5% flat, declining balance),
  late-fee rate (default 3%/month), loan↔savings multiplier (default 2×), and
  **Gmail SMTP (app password)** — stored Fernet-encrypted, never returned by the API.
* Portal account management for members: create/reset/revoke/delete login credentials.

**Member portal** (`/account`, `/loans`, `/request-loan`, …)
* Members sign in with credentials issued by the office and view their own savings,
  loans, and payment history — nothing else (403s for admins and unlinked users).
* Loan eligibility with the maximum they can request (`savings × multiplier`) and a
  guided loan-request form with status tracking.
* Change their own password.

**Auth & recovery**
* `POST /auth/setup` bootstraps the first admin (only while the user table is empty).
* Admin-only registration of additional staff accounts.
* Forgot/reset password via emailed, single-use, 30-minute tokens (generic responses —
  no user enumeration). Password changes invalidate every previously issued JWT (`iat` check).
* Rate limits on login/refresh/forgot-password, refresh-token rotation with reuse
  detection, blocklisted tokens on logout.

## Architecture

```
Browser ──HTTPS──▶ Caddy ──/api/* (prefix stripped)──▶ backend (FastAPI, port 80)
                       └──everything else───────────▶ frontend (Nginx, React SPA)
```

Compose services: `caddy`, `redis`, `postgres` (volume `postgres_data`), `backend`,
`frontend`. The backend waits for PostgreSQL to be healthy, then runs
`alembic upgrade head` before serving traffic.

## Quick start

Prerequisites: Docker + Docker Compose.

```bash
# 1. Configure the environment (root of the repo)
cp .env.example .env            # then edit SECRET_KEY, POSTGRES_PASSWORD, ALLOWED_ORIGINS, FRONTEND_URL

# 2. Build and start everything (migrations run automatically on backend start)
docker compose up -d --build

# 3. Create the first admin account — only possible while no users exist
curl -X POST http://localhost/api/auth/setup \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@yourcoop.rw","password":"choose-a-strong-password"}'
```

Then open the site (`https://<your-domain>` in production, `http://localhost` if you
point Caddy at localhost) and sign in. Migrations are applied by `backend/entrypoint.sh`
(`alembic upgrade head`) on every container start, so the manual
`alembic upgrade head` step from earlier docs is no longer needed.

**First things to do after logging in**
1. *Settings → Email*: enter the Gmail address and a 16-character **app password**
   (create one at myaccount.google.com → Security → App passwords), then send a test email.
   Until this is configured, password-reset emails are disabled (API returns 503).
2. *Members → Add New Member*, record savings, then *Portal Access* on a member profile
   to create their portal login (the temporary password is emailed and shown once).

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SECRET_KEY` | — (required) | Signs JWTs and encrypts the stored SMTP password. Changing it invalidates sessions and stored secrets. |
| `ALGORITHM` | `HS256` | JWT algorithm. |
| `EXPIRATION_TIME_MINUTES` | `30` | Access-token lifetime. |
| `EXPIRATION_TIME_DAYS` | `3` | Refresh-token lifetime. |
| `DATABASE_URL` | `sqlite:///./dev.db` | SQLAlchemy URL. Compose injects `postgresql+psycopg2://coop:…@postgres:5432/coop` automatically. |
| `POSTGRES_PASSWORD` | `coop_secret` | Password of the PostgreSQL container (keep it in `.env`). |
| `REDIS_URL` | `memory://` | Rate-limit backend. |
| `ALLOWED_ORIGINS` | `http://localhost:5173,http://localhost:3000` | Comma-separated CORS origins. Never `*` with credentials. |
| `FRONTEND_URL` | `http://localhost:5173` | Base URL used in password-reset emails. |
| `VITE_API_URL` | (unset → `/api`) | Frontend build-time API origin, only if not same-origin. |

The Gmail app password is **not** an environment variable — it is entered in the
admin Settings UI and stored encrypted in the database.

### Database

Production runs on **PostgreSQL 16** (the `postgres` service in `docker-compose.yml`);
local development can use SQLite (`DATABASE_URL=sqlite:///./dev.db`) for zero setup.
Migrations (`backend/migrations/`) work identically on both engines.

**Upgrading an existing SQLite deployment** (older versions stored data in
`/data/users.db`): keep the old volume mounted somewhere, then copy the data with
[pgloader](https://pgloader.io/):

```bash
pgloader sqlite:///path/to/users.db \
  postgresql://coop:POSTGRES_PASSWORD@postgres:5432/coop
```

The old `coop_db_data` volume is untouched by `docker compose down` — do not remove it
until you have verified the migrated data.

## Testing

Backend (55 tests — auth, password reset, settings/SMTP, portal & loan requests,
savings/withdrawals, reports & CSV exports):

```bash
cd backend
DATABASE_URL=sqlite:// SECRET_KEY=test-secret-key-1234567890abcdef \
ALGORITHM=HS256 EXPIRATION_TIME_MINUTES=30 EXPIRATION_TIME_DAYS=3 \
pytest -q

# same suite against PostgreSQL (what CI runs as a second pass):
TEST_DATABASE_URL=postgresql+psycopg2://user:pw@localhost:5432/test \
pytest -q
```

Frontend (27 tests — formatters, tooltip a11y, confirm dialog, login, savings modal,
member directory):

```bash
cd frontend
npm ci
npm test           # one-shot
npm run test:watch # watch mode
npm run build      # production build (also runs in CI)
```

Both suites run in GitHub Actions on every push/PR.

## CI/CD: GitHub Actions → Docker Hub

Everything lives in `.github/workflows/backend-ci.yml`:

| Job | When | What it does |
|---|---|---|
| `test-backend` | every push/PR to `main` | 55 pytest tests on SQLite, then the same suite on PostgreSQL, then `alembic upgrade head` from an empty Postgres database |
| `test-frontend` | every push/PR to `main` | 27 vitest tests + production build |
| `build-and-push` | pushes to `main`, after both test jobs pass | builds both images with Buildx (layer cache) and pushes them to Docker Hub |

**Tags published** for each of `alains04/coop-backend` and `alains04/coop-frontend`:

- `latest` — what `docker-compose.yml` pulls (deploy = merge to `main`)
- `sha-<7-char>` — the exact commit; keep this in a run summary for rollbacks
- `main` — tracks the branch
- plus a version tag when you push a git tag (`git tag v1.2.0 && git push --tags`)

**Required repository secrets** (GitHub → Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DOCKERHUB_USERNAME` | your Docker Hub username |
| `DOCKERHUB_TOKEN` | a Docker Hub **access token** (Account settings → Security → New access token), not your password |

**Deploy / roll back on the server:**

```bash
docker compose pull && docker compose up -d          # deploy what's on main

# rollback: pin the known-good commit in docker-compose.yml, e.g.
#   image: alains04/coop-backend:sha-1234567
docker compose up -d
```

## Deploying to Oracle Cloud (Always Free)

`infra/` contains a `$0/month` single-instance deployment (one AMD micro
1/8 OCPU · 1 GB RAM, free-tier guardrails enforced as Terraform validations):

```bash
# 1. OCI API key + values → infra/terraform/README.md (Phase 0)
cd infra/terraform && cp terraform.tfvars.example terraform.tfvars   # edit
terraform init && terraform plan && terraform apply

# 2. Secrets (gitignored) → infra/ansible/group_vars/vault.yml.example
cd ../ansible && cp group_vars/vault.yml.example group_vars/vault.yml  # edit
ansible-vault encrypt group_vars/vault.yml

# 3. Harden + deploy (ufw, swap, Docker, stack, DuckDNS, backups)
ansible-playbook playbooks/site.yml -v
```

Full runbook, verification and day-2 operations: [`infra/README.md`](infra/README.md).

## Project structure

```
backend/
  api/            routers: auth, members, loans, payments, savings, portal,
                  admin settings, loan requests, member accounts, reports/exports
  core/           crypto (Fernet), email (SMTP), settings cache, rate limiting, logging
  models/         SQLModel tables + DTOs (members, loans, savings, payments,
                  loan requests, users, password-reset tokens, settings)
  dependancies/   auth (JWT), admin guard, helpers
  migrations/     Alembic revisions
  tests/          pytest suite (conftest provides session/client/admin/email fixtures)
  entrypoint.sh   alembic upgrade head → uvicorn
frontend/
  src/components/ admin pages, member-portal pages, modals, ui/ primitives
  src/utils/      format helpers (formatRWF, dates)
  src/content/    KPI explanations shown in dashboard tooltips
  src/context/    toast notifications
```

## Security notes

* JWTs carry `iat`; tokens issued before a password change are rejected everywhere.
* Refresh tokens are single-use (rotated, reuse is rejected) and all tokens are unique (`jti`).
* Member portal and admin routes are separate: members get 403 on `/admin/*`,
  admins get 403 on `/portal/*`, and unlinked users see a clear "no profile" page.
* Money fields are validated `> 0`; withdrawals cannot exceed the member's balance;
  loans cannot be edited or deleted after payments exist; member deletion is blocked
  while they still hold savings or an active loan.
* The SMTP password is encrypted at rest and masked in API responses; reset emails
  never reveal whether an account exists.
