# Lotus Pharmacies CRM & Chat System

## Overview

Full-stack SaaS CRM and real-time chat platform for pharmacy staff. Built as a pnpm workspace monorepo with a React + Vite frontend and an Express + Socket.io backend.

## Architecture

```
artifacts/
  api-server/    — Express 5 + Socket.io backend (port 8080)
  lotus-crm/     — React + Vite frontend (port 23414, preview at /)
lib/
  db/            — Drizzle ORM schema + migrations (PostgreSQL)
  api-spec/      — OpenAPI spec + Orval codegen config
  api-client-react/ — Generated React Query hooks + custom fetch
  api-zod/       — Generated Zod schemas
```

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24, **TypeScript**: 5.9
- **Backend**: Express 5, Socket.io, JWT auth (jsonwebtoken + bcryptjs)
- **Database**: PostgreSQL + Drizzle ORM
- **API contract**: OpenAPI 3.1 → Orval codegen (React Query hooks + Zod schemas)
- **Frontend**: React 19, Vite 7, Tailwind CSS, Radix UI, Wouter routing, TanStack Query, Recharts
- **Theme**: Green palette (#2E7D32 primary), light/dark mode via next-themes

## Routing

The global reverse proxy (port 80) routes:
- `/api/*` → API server at port 8080
- `/*` → Lotus CRM frontend at port 23414

## Auth

- JWT tokens stored in `localStorage` as `lotus_token`
- `AuthProvider` in `src/lib/auth.tsx` exposes `{ user, isLoading, login, logout }`
- `login(token)` updates state + localStorage + auth getter atomically
- Role-based: admin and agent roles; Settings page is admin-only

## Default Credentials

| Role  | Email                          | Password   |
|-------|--------------------------------|------------|
| Admin | layla@lotuspharmacies.com      | admin123   |
| Admin | omar@lotuspharmacies.com       | admin123   |
| Agent | sara@lotuspharmacies.com       | agent123   |
| Agent | youssef@lotuspharmacies.com    | agent123   |
| Agent | hana@lotuspharmacies.com       | agent123   |
| Agent | kareem@lotuspharmacies.com     | agent123   |

Passwords seeded using PostgreSQL `pgcrypto` `crypt()` with blowfish (compatible with `bcryptjs.compare()`).

## Seeded Data

- 6 users (2 admins, 4 agents)
- 22 customers with tags, branch info, prescription notes
- 22 conversations (open/pending/resolved)
- 44 messages (customer + agent turns)
- 6 tags: VIP, New, Complaint, Prescription, Follow-up, Urgent
- 8 quick replies

## Pages

| Route        | Access     | Description                                  |
|--------------|------------|----------------------------------------------|
| `/login`     | Public     | JWT login form                               |
| `/dashboard` | Auth       | Summary stats: open chats, customers, agents |
| `/chat`      | Auth       | Real-time conversation list + message panel  |
| `/customers` | Auth       | Customer CRM table with search + create      |
| `/reports`   | Auth       | Analytics charts + CSV export                |
| `/settings`  | Admin only | User/tag/quick-reply management              |

## Key Files

- `artifacts/api-server/src/app.ts` — Express app, CORS, routes at `/api`
- `artifacts/api-server/src/index.ts` — HTTP server + Socket.io setup
- `artifacts/api-server/src/routes/` — auth, users, customers, conversations, messages, tags, quick-replies, analytics
- `artifacts/api-server/src/middlewares/auth.ts` — JWT middleware
- `lib/db/src/schema/index.ts` — Drizzle table definitions
- `lib/api-spec/openapi.yaml` — OpenAPI contract
- `artifacts/lotus-crm/src/App.tsx` — Router + providers setup
- `artifacts/lotus-crm/src/lib/auth.tsx` — AuthProvider + useAuth hook
- `artifacts/lotus-crm/src/components/layout.tsx` — AppLayout with sidebar

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API client from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes

## Socket.io Events

- `join_conversation` / `leave_conversation` — room management
- `typing` — broadcast typing indicator
- `message_status` — update message delivery status
- `new_message` — emitted by server on new message
