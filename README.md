# Student Attendance Management System

A local-first attendance manager for a single instructor. React + TypeScript frontend,
Express + Prisma + PostgreSQL backend, JWT authentication. All data lives in your own
database on your own computer.

## Features

- JWT login for one admin account, protected routes, remembered session, change password
- Dashboard: totals, present/absent today, overall percentage, recent sessions, quick actions
- Students: add / edit / delete, search, department & batch filters, pagination, profile page
- Attendance: pick a session date, searchable roster, Present / Late / Absent toggles, notes,
  mark all present or absent, save with Ctrl/Cmd + S. Duplicate records per student and date
  are impossible (unique constraint + upsert), so re-saving edits the existing session
- History: all sessions with filters (date range, department, batch, student), session detail, delete
- Reports: overall / per-student / per-department / per-batch stats, most absent, most consistent,
  monthly & weekly charts, export to CSV, Excel and PDF
- Settings: profile, password, light/dark mode, database backup & restore, data export & import
- Global search (press `/`), toasts, loading skeletons, empty & error states, confirm dialogs, responsive layout

## Requirements

- Node.js 18+
- PostgreSQL 14+ (or Docker)

## Setup

### 1. Database

Using Docker (easiest):

```bash
docker compose up -d
```

Or create a database named `attendance` in your own PostgreSQL install.

### 2. Backend

```bash
cd backend
cp .env.example .env        # edit DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev --name init
npm run seed                # creates the admin + 20 sample students + sample sessions
npm run dev                 # http://localhost:4000/api
```

Default login: **admin / admin123** (change it in Settings after first login).

### 3. Frontend

```bash
cd frontend
npm install
npm run dev                 # http://localhost:5173
```

The dev server proxies `/api` to the backend, so no extra config is needed.

## Production build

```bash
cd backend  && npm run build && npm start
cd frontend && npm run build     # static files in frontend/dist
```

Serve `frontend/dist` with any static server (nginx, `serve`, Caddy) and point
`VITE_API_URL` at your backend URL if it is not on the same origin.

## API

All routes are prefixed with `/api` and require `Authorization: Bearer <token>` except login.

| Method | Path | Description |
| ------ | ---- | ----------- |
| POST | `/auth/login` | Log in, returns JWT |
| GET | `/auth/me` | Current admin |
| PATCH | `/auth/profile` | Update profile |
| POST | `/auth/change-password` | Change password |
| GET | `/students` | List (search, filters, pagination) |
| GET | `/students/facets` | Distinct departments & batches |
| GET | `/students/:id` | Profile with attendance history |
| POST | `/students` | Create (auto student ID) |
| PATCH | `/students/:id` | Update |
| DELETE | `/students/:id` | Delete |
| POST | `/students/import` | Bulk import |
| GET | `/attendance/sheet?date=` | Roster for a session date |
| POST | `/attendance` | Save/update a session |
| GET | `/attendance/sessions` | Session list with filters |
| GET | `/attendance/sessions/:date` | Session detail |
| DELETE | `/attendance/sessions/:date` | Delete a session |
| GET | `/dashboard` | Dashboard stats |
| GET | `/reports` | Report aggregations |
| GET | `/reports/backup` | Full JSON backup |
| POST | `/reports/restore` | Restore from backup |
| GET | `/search?q=` | Global student search |

## Structure

```
backend/
  prisma/schema.prisma   seed.ts
  src/controllers  routes  middleware  lib  utils
frontend/
  src/components  pages  layouts  hooks  services  types  utils
```

## Validation rules

- Phone numbers must match `+?digits` (7-15 digits) and are unique per student
- Required fields are enforced on the client (React Hook Form) and server (Zod)
- One attendance record per student per date, enforced by a database unique index
"# sams"
AUTHOR
Rediet Girma
