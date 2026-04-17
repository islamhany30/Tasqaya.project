# Tasqaya — Short-Term Workforce Management Platform

> A backend REST API that connects organizing companies with temporary workers and supervisors for short-term events and tasks.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Core Features](#core-features)
- [System Workflow](#system-workflow)
- [Project Structure](#project-structure)
- [Entity Model](#entity-model)
- [API Modules](#api-modules)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running Tests](#running-tests)

---

## Overview

Tasqaya is a platform that allows companies to post short-term workforce tasks (events, exhibitions, conferences, etc.), and lets workers browse and apply for those tasks. The platform handles the full lifecycle: task creation, cost calculation, worker filtration, attendance confirmation, supervisor assignment, and payments resolving.

The project is a **pure REST API** built for consumption by a frontend client. No UI is included.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | NestJS (TypeScript) |
| Database | MySQL via TypeORM |
| Queue | BullMQ + Redis |
| Scheduler | @nestjs/schedule (cron jobs) |
| Auth | JWT (access tokens) |
| Payments | Paymob gateway |
| Email | Nodemailer via MailService |
| Testing | Jest (unit tests, fully mocked) |

---

## Architecture

The project follows a **modular monolith** architecture. Each domain is an independent NestJS module with its own controller, service, and DTOs. All modules share a central `TaskService` as the aggregate root for task-related business logic.

```
src/
├── AllModules/
│   ├── Admin/          # Platform administration
│   ├── Company/        # Company-facing task management
│   ├── Worker/         # Worker applications and job browsing
│   ├── Supervisor/     # Supervisor profile management
│   ├── Task/           # Core task lifecycle + scheduler
│   ├── Confirmation/   # Attendance confirmation flow (BullMQ)
│   ├── Payment/        # Paymob integration
│   └── Webhook/        # Paymob webhook handler
├── Auth/               # JWT guards, roles, auth service
├── entities/           # TypeORM entities
├── Enums/              # All platform enums
├── Mail/               # Email service
└── common/             # Filters, utils
```

---

## Core Features

### Worker Filtration Engine
When a job post receives enough applications (2.5× the required workers) or its deadline passes, the platform automatically ranks applicants and assigns them:
- Ranked by: `reliabilityRate DESC` → `appliedAt ASC` → `score DESC` → `completedTasks DESC`
- Top N → **PRIMARY** workers
- Next 3 → **BACKUP** workers (ordered by `backupOrder`)
- Rest → **REJECTED**

Filtration can also be triggered manually by an admin.

### Task Lifecycle & Cost Calculation
When a company creates a task, the platform automatically calculates the total cost:

```
totalDays            = endDate - startDate + 1
totalHoursPerWorker  = durationHoursPerDay × totalDays
baseWorkersCost      = requiredWorkers × totalHoursPerWorker × companyHourlyRate
requiredSupervisors  = max(ceil(requiredWorkers × 0.1), 1)
supervisingFees      = requiredSupervisors × globalSupervisorBonus
platformFee          = baseWorkersCost × platformFeePercentage
totalCost            = baseWorkersCost + supervisingFees + platformFee
```

Task statuses transition automatically via a nightly cron job:
```
UNAPPROVED → PENDING (on company approval)
PENDING    → IN_PROGRESS (on startDate)
IN_PROGRESS → COMPLETED (on endDate)
```

### Attendance Confirmation Flow
48 hours before a task starts:
1. Confirmation emails sent to all PRIMARY workers with tokenized YES/NO links
2. Tokens expire in 12 hours — BullMQ queues auto-decline on expiry
3. Declined or timed-out workers → next BACKUP promoted automatically
4. When all slots confirmed → supervisor notified to create WhatsApp group
5. Confirmed workers receive the WhatsApp group link via email

### Reliability Rate Calculation
After each completed task, each worker's reliability rate is recalculated:
```
currentTaskRate = (daysPresent / totalDays) × 100
newAvg = ((oldAvg × (n-1)) + currentTaskRate) / n
reliabilityRate = min(newAvg, 99.99)
```
This rate is the primary ranking factor in future filtration runs.

### Role-Based Auth
Four roles with separate guards:
- **ADMIN** — full platform oversight via `AdminAuthGuard`
- **COMPANY** — task creation and management
- **WORKER** — job browsing and applications
- **SUPERVISOR** — task supervision

All roles authenticate through a central `Account` entity. JWT tokens carry `{ sub, email, role }`.

### Admin Dashboard
Platform-wide aggregated stats including total/active tasks by status, total revenue vs pending payments, worker reliability averages, company activity, and platform rating.

---

## System Workflow

```
Company registers → creates Task
  └─ Platform calculates cost automatically
  └─ Company approves (must be ≥7 days before startDate)
       └─ Payment invoice created (Paymob)
       └─ JobPost published (OPEN)

Workers browse OPEN job posts → apply
  └─ Application validated (level match, gender, no duplicates)
  └─ If applicationCount ≥ requiredWorkers × 2.5 → filtration runs
  └─ If deadline passes → filtration runs (hourly cron)

Filtration:
  └─ Rank applications → assign PRIMARY + BACKUP
  └─ JobPost → CLOSED

48hrs before startDate:
  └─ Confirmation emails sent to PRIMARY workers
  └─ Workers confirm/decline via email link
  └─ Declines → next BACKUP promoted
  └─ All confirmed → supervisor notified

Task runs:
  └─ IN_PROGRESS on startDate (nightly cron)
  └─ COMPLETED on endDate (nightly cron)
  └─ Reliability rates recalculated
```

---

## Entity Model

| Entity | Description |
|---|---|
| `Account` | Central auth table (email, password, role) |
| `Admin / Company / Worker / Supervisor` | Role profile entities linked to Account |
| `Task` | Core entity with full lifecycle tracking |
| `JobPost` | Published when task is approved (OneToOne with Task) |
| `Application` | Worker applies to a JobPost |
| `TaskWorker` | Assigned workers (PRIMARY/BACKUP) with confirmation status |
| `TaskSupervisor` | Supervisor assignment with WhatsApp group link |
| `Attendance` | Check-in/out per worker per task day |
| `Payment` | Paymob invoice linked to a Task |
| `WorkerLevel` | GOLD / SILVER / BRONZE with hourly rates and score ranges |
| `WorkerType` | ORGANIZING, REGISTRATION, CROWD_MANAGEMENT, etc. |
| `ConfirmationToken` | UUID token for YES/NO confirmation emails |
| `SystemConfig` | Singleton config (supervisor bonus, platform fee %) |
| `CompanyFeedback` | Post-task rating (1–5 stars) |

---

## API Modules

### Auth — `/api/auth`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/login` | Login for all roles |
| POST | `/forgot-password` | Send reset code to email |
| POST | `/verify-reset-code` | Verify the reset code |
| POST | `/resend-reset-code` | Resend reset code |
| PATCH | `/reset-password` | Set new password |

### Company — `/api/company`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register company account |
| POST | `/tasks` | Create a new task |
| PATCH | `/tasks/:id` | Update a pending task |
| DELETE | `/tasks/:id` | Delete a pending task |
| POST | `/tasks/:id/approve` | Approve task (triggers job post creation) |
| GET | `/tasks` | Get company's tasks by status |
| GET | `/tasks/:id` | Get full task details |
| POST | `/tasks/:id/feedback` | Submit post-task feedback |
| POST | `/payment/pay` | Pay task invoice via Paymob |

### Worker — `/api/worker`
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register worker account |
| GET | `/jobs` | Browse open job posts (with filters) |
| POST | `/apply` | Apply for a job post |
| GET | `/my-applications` | View own applications |

### Admin — `/api/admin`
| Method | Endpoint | Description |
|---|---|---|
| GET | `/dashboard/stats` | Platform-wide aggregated stats |
| GET | `/manage/tasks` | All tasks (filterable by status, company, date) |
| GET | `/manage/tasks/:id` | Full task details |
| GET | `/manage/job-posts/:id/applicants` | View all applicants for a job post |
| POST | `/manage/job-posts/:id/filter` | Manually trigger worker filtration |
| POST | `/manage/tasks/:id/assign-supervisor` | Assign supervisor to task |
| DELETE | `/manage/tasks/:id/supervisors/:supervisorId` | Unassign supervisor |
| GET | `/manage/tasks/:id/supervisors` | List task supervisors |

---

## Getting Started

### Prerequisites
- Node.js v18+
- MySQL 8+
- Redis

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/Tasqaya.project.git
cd Tasqaya.project
npm install
```

### Database Setup

Create the database:
```sql
CREATE DATABASE Tasqaya;
```

Set up your `.env.development` file (see [Environment Variables](#environment-variables)), then start the server with `synchronize: true` on first run to let TypeORM create all tables automatically.

### Seed Admin Account

Since admin registration is not exposed via API, insert the admin account directly:

```bash
# Generate a bcrypt hash for your password
node -e "const b = require('bcryptjs'); b.hash('YourPassword', 10).then(console.log)"
```

```sql
INSERT INTO accounts (email, password, role, isActive)
VALUES ('admin@tasqaya.com', '<hashed_password>', 'ADMIN', 1);

INSERT INTO admins (name, email, password, phone, isVerified, isActive, accountId)
VALUES ('Super Admin', 'admin@tasqaya.com', '<hashed_password>', '01000000000', 1, 1, LAST_INSERT_ID());
```

### Start the Server

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

Server runs on `http://localhost:3000` by default.

---

## Environment Variables

Create a `.env.development` file in the root:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_db_password
DB_NAME=Tasqaya

# JWT
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Mail
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USER=your_email@gmail.com
MAIL_PASS=your_app_password

# Paymob
PAYMOB_API_KEY=your_paymob_api_key
PAYMOB_INTEGRATION_ID=your_integration_id
PAYMOB_IFRAME_ID=your_iframe_id
PAYMOB_HMAC_SECRET=your_hmac_secret
```

---

## Running Tests

Unit tests use fully mocked repositories — no database connection required.

```bash
# Run all tests
npx jest --verbose

# Run specific test suite
npx jest task.service.spec --verbose
npx jest task.admin.spec --verbose
```

Test coverage includes:
- Task creation and cost calculation
- Task approval and job post creation
- Worker filtration engine (all edge cases)
- Admin dashboard stats aggregation
- Task detail views for company and admin
- Confirmation and feedback flows
