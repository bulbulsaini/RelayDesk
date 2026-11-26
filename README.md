# RelayDesk — Support Ticket Management System

RelayDesk is a full-stack mini helpdesk application where users raise and track support requests and administrators triage, assign, respond to, and resolve tickets through an event-driven workflow.

---

## Tech Stack

- **Backend:** Node.js, Express.js, TypeScript, Zod (validation), JWT (`jsonwebtoken`), `bcryptjs`, `helmet`, `express-rate-limit`, `nodemailer`
- **Database:** PostgreSQL (`pg` with parameterized SQL queries)
- **Event Workflow:** Node `EventEmitter` domain event bus (`TicketEventBus`) decoupling HTTP handlers from activity auditing, in-app notifications, and email alerts
- **Frontend:** React 18, TypeScript, Vite, React Router, Lucide Icons
- **Testing:** Vitest + Supertest (`pg-mem` isolated PostgreSQL adapter for reproducible integration tests)
- **Containers:** Docker & Docker Compose (PostgreSQL 16 + API + Nginx-served React frontend)

---

## Key Features

### Authentication & Role-Based Access Control
- User registration and sign-in secured with `bcryptjs` password hashing and stateless JWT bearer tokens.
- Two roles: `user` and `admin`. Public `/api/auth/register` strictly provisions `user` accounts; admin accounts are seeded or provisioned intentionally to prevent privilege escalation.
- Users can only view, edit (when open/in-progress), delete (when open), and comment on their own tickets.

### Ticket Management & Admin Triage
- Full ticket lifecycle (`open` -> `in_progress` -> `resolved` -> `closed`) with `resolved_at` tracking.
- Server-side search (`q` matching title, description, or ticket ID), filtering (`status`, `priority`, `category`, `userId`), sorting (`created_at`, `updated_at`, `priority`, `status`), and pagination.
- Admin dashboard with ticket statistics, status distribution, assignee management, and global audit stream.

### Event-Driven Action Management
Important actions emit typed domain events on `TicketEventBus`:
- `TICKET_CREATED`
- `TICKET_UPDATED`
- `STATUS_CHANGED`
- `COMMENT_ADDED`
- `TICKET_RESOLVED`

Listeners asynchronously persist entries to `activity_logs`, generate targeted `notifications` for ticket owners or administrators, and trigger email alerts via Nodemailer (with a structured console preview when SMTP credentials are not configured).

---

## Project Structure

```text
relaydesk/
├── client/                 # React + TypeScript frontend (Vite)
├── server/                 # Express + TypeScript REST API
│   ├── src/
│   │   ├── config/         # Environment & PostgreSQL pool
│   │   ├── db/             # schema.sql, migrate.ts, seed.ts
│   │   ├── events/         # TicketEventBus, listeners, emailService
│   │   ├── middleware/     # JWT auth, role guard, Zod validator, error handler
│   │   └── modules/        # auth, users, tickets, comments, notifications, activity
│   └── tests/              # Supertest API integration tests
├── docs/
│   ├── API.md              # Endpoint reference
│   ├── DATABASE_DESIGN.md  # ER diagram & schema rationale
│   └── postman_collection.json
└── docker-compose.yml
```

---

## Local Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (or Docker Desktop)

### 1. Run with Docker Compose (Fastest)
```bash
docker compose up --build
```
Then seed demo accounts and sample tickets:
```bash
docker compose exec server node -e "require('./dist/db/seed.js')"
```
- Web UI: `http://localhost:3000`
- API Health: `http://localhost:4000/api/health`

### 2. Run Locally (Development)

1. Create a PostgreSQL database named `relaydesk`.
2. Configure backend environment variables:
   ```bash
   cd server
   cp .env.example .env
   # Update DATABASE_URL and JWT_SECRET in .env
   ```
3. Install dependencies, apply schema, and seed demo data:
   ```bash
   npm install
   npm run db:migrate
   npm run db:seed
   npm run dev
   ```
4. In a second terminal, start the frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```
5. Open `http://localhost:5173`.

---

## Running Automated Tests

The backend test suite executes against the real `schema.sql` using an isolated in-memory PostgreSQL engine (`pg-mem`), so it runs reliably without modifying your local database:

```bash
cd server
npm test
```

---

## Architectural & Implementation Decisions

1. **Injected `DbPool` into `createApp(pool)`:** Separating Express app construction from `server.ts` process startup allows Supertest integration tests to pass an isolated database pool while testing real SQL queries, middleware, and event listeners end-to-end.
2. **Parameterized SQL over Heavy ORM:** Using `pg` directly with explicit SQL queries keeps pagination, conditional filtering, and `CASE`-based priority sorting transparent and predictable, while `zod` schemas handle strict input validation at the HTTP boundary.
3. **Decoupled `TicketEventBus`:** Emitting domain events from service methods keeps core business transactions clean and makes it straightforward to extend side effects (such as adding webhooks or a Redis queue later) without modifying controllers.
4. **Scoped Editing & Deletion Rules:** Regular users can edit their tickets while `open` or `in_progress`, and delete only while `open`. Once resolved or closed, tickets remain immutable to preserve the support audit trail.
