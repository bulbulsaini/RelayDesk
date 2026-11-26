# RelayDesk REST API Reference

Base URL: `http://localhost:4000/api`

All protected endpoints require header:
```http
Authorization: Bearer <jwt_token>
```

Error responses follow a consistent envelope:
```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "Title must be at least 4 characters" }]
  }
}
```

---

## Health
- `GET /health` — Verifies API and PostgreSQL connectivity.

## Authentication
- `POST /auth/register` — Body: `{ name, email, password }`. Always registers role `user`. Returns `{ user, token }` (`201`).
- `POST /auth/login` — Body: `{ email, password }`. Returns `{ user, token }` (`200`).
- `GET /auth/me` — Returns `{ user }` for the authenticated token.

## Tickets
- `GET /tickets` — Paginated list. Users see only their own tickets; Admins see all.
  - Query params: `q`, `status`, `priority`, `category`, `userId` (admin), `sortBy` (`created_at | updated_at | priority | status`), `sortOrder` (`asc | desc`), `page`, `limit`.
- `GET /tickets/stats` — Returns `{ stats: { total, byStatus, byPriority, byCategory } }`.
- `POST /tickets` — Body: `{ title, description, category, priority }`. Emits `TICKET_CREATED`.
- `GET /tickets/:id` — Returns `{ ticket }` (owner or admin).
- `PATCH /tickets/:id` — Updates ticket fields.
  - Standard users can update `title`, `description`, `category`, `priority` while status is `open` or `in_progress`.
  - Admins can also update `status` and `assignedTo`. Emits `TICKET_UPDATED`, `STATUS_CHANGED`, and `TICKET_RESOLVED` where applicable.
- `DELETE /tickets/:id` — Deletes a ticket (`open` only for owners; any status for admins).

## Comments & Ticket Activity
- `GET /tickets/:id/comments` — Chronological comment thread (owner or admin).
- `POST /tickets/:id/comments` — Body: `{ body }`. Emits `COMMENT_ADDED`.
- `GET /tickets/:id/activity` — Event timeline for a ticket (owner or admin).

## Notifications
- `GET /notifications` — Lists latest 30 notifications and `unreadCount` for current user.
- `PATCH /notifications/:id/read` — Marks one notification read.
- `PATCH /notifications/read-all` — Marks all notifications read.

## Admin Management
- `GET /users` — *(Admin)* Lists registered users and admins for assignment/filtering.
- `GET /activity` — *(Admin)* Paginated global audit log. Supports `eventType`, `page`, `limit`.
