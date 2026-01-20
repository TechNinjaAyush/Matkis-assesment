# Matkis Leaderboard (Redis + Postgres + Go + React)

## Problem statement
Build a **leaderboard** that can support **10,000 → 1,000,000 users**, with:
- Fast leaderboard reads (top users, paginated)
- Fast username/prefix search
- Frequent rating updates (“live” feel)
- Durable storage for long-term correctness

This repo contains:
- **Backend**: Go + Gin + Redis + Postgres
- **Frontend**: React (JSX) dashboard that calls all backend APIs

---

## Tech stack
- **Go + Gin**: HTTP API server
- **Redis**: in-memory leaderboard + prefix search indexes (fast reads/writes)
- **Postgres**: durable source of truth for user rating history / persistence
- **React (Vite)**: dashboard UI for all APIs

---

## High-level architecture

### Data model (conceptual)
Each user has:
- `username`
- `rating`

### Storage responsibilities
- **Postgres**: durable table (named `leadboard` in this project) stores `username`, `rating`, etc.
- **Redis**: optimized read/query structures:
  - **Sorted Set** `leaderboard`
    - Member: `username`
    - Score: `rating`
  - **Prefix Sets** `user_prefix:<prefix>`
    - Members: matching `username` strings
    - Used to implement prefix search quickly

### Why Redis + Postgres (tradeoff)
- **Redis** gives:
  - Very fast leaderboard reads/writes (sorted set operations are \(O(\log N)\))
  - Easy pagination for top users
  - Great for “live” rating updates
- **Postgres** gives:
  - Durability and recovery (Redis is typically treated as cache/derived index)
  - Ability to rebuild Redis indexes from the source of truth

**Tradeoff**: data can be **eventually consistent** (Redis updates appear immediately; Postgres updates may lag slightly via background workers).

---

## Backend overview

### Entry point
Backend server is started from:
- `backend/cmd/server/main.go`

It:
- Connects to Postgres and Redis
- Starts background DB workers
- Exposes HTTP routes under `/api/*`

### Environment variables
Backend expects:
- **`POSTGRES_URL`**: Postgres DSN
- **`REDIS_URL`**: Redis URL (e.g. `redis://localhost:6379/0`)
- **`PORT`**: optional, defaults to `8080` (in the newer server main)
- **`FRONTEND_URL`**: only required if you use the CORS-enabled server main (some variants in repo)

---

## API documentation

### Health
- **GET** `/health`
- Response: `{ "status": "ok" }`

### Bootstrap Redis from Postgres
Used to populate Redis indexes for fast reads/search.

- **POST** `/api/users`
- What it does:
  - Reads users from Postgres table `leadboard` in batches
  - Writes to Redis:
    - `ZADD leaderboard <rating> <username>`
    - `SADD user_prefix:<prefix> <username>` for every prefix of the username (stored in lowercase)
- Response: `{ "message": "Redis bootstrap completed" }`

### Fetch leaderboard page
- **GET** `/api/leadboard?page=1&limit=20`
- Backend implementation:
  - `ZREVRANGE leaderboard start end WITHSCORES` (highest ratings first)
  - For each user, rank is computed as described below
- Response (array):
  - `[{ "username": "alice", "rating": 1200, "rank": 42 }, ...]`

### Search users by username prefix
- **GET** `/api/username?username=al`
- Backend implementation:
  - Looks up `SMEMBERS user_prefix:<prefix>`
  - Then fetches rating from `ZSCORE leaderboard <username>`
  - Then computes rank (see below)
- Response (array):
  - `[{ "username": "alice", "rating": 1200, "rank": 42 }, ...]`

### Run simulation (multi-user rating updates)
- **POST** `/api/simulate`
- What it does:
  - Picks 500 random users from the Redis sorted set
  - Assigns each a random new rating (0..4999)
  - Writes changes to Redis using a pipeline (`ZADD leaderboard ...`)
  - Enqueues updates into an in-memory buffered channel
  - Background workers periodically flush batched updates into Postgres (`UPDATE leadboard SET rating=? WHERE username=?`)
- Response:
  - `{ "message": "multi-user simulation completed", "updates": 500 }`

---

## Rank calculation

### Current implementation
Rank is computed using Redis `ZCOUNT`:
\[
\text{rank} = \#\{\text{users with rating} > r\} + 1
\]

Concretely, for a user rating `r`, the backend does:
- `ZCOUNT leaderboard (r +inf`  (strictly greater than `r`)
- `rank = higherCount + 1`

### Tradeoffs
- **Pros**: simple and deterministic with “dense ranking” for identical scores.
- **Cons**:
  - For a page of 20 users, it does 20 extra Redis calls (still fine).
  - For very large pages or heavy traffic, you may prefer:
    - `ZREVRANK` for \(O(\log N)\) rank lookup (but ties behave differently unless you define tie-break rules)
    - Store a secondary tie-breaker (e.g., timestamp) if needed

---

## Simulation design

### Goal
Create “live” rating movement without blocking the API on Postgres writes.

### How it works
1. Update Redis immediately (fast)
2. Send update events into `UpdateQueue` (buffered channel)
3. Background worker goroutines:
   - Batch updates (up to 1000) or flush every 1 second
   - Execute Postgres updates inside a transaction

### Tradeoffs
- **Pros**:
  - Simulation endpoint is fast (mostly Redis work)
  - DB writes are amortized/batched
- **Cons**:
  - Postgres is eventually consistent with Redis
  - If the process crashes, queued updates may be lost (Redis will still be updated)
    - Mitigation: persist update events (Redis stream/Kafka) or periodically reconcile from Redis → Postgres

---

## Frontend (dashboard)

Location: `frontend/`

UI features:
- Bootstrap users button (`POST /api/users`)
- Paginated leaderboard (`GET /api/leadboard`)
- Username/prefix search (`GET /api/username`)
- Simulation button (`POST /api/simulate`)

Dev proxy is configured in Vite so the frontend can call `/api/*` without CORS issues.

---

## Running locally

### 1) Backend
From repo root:

```bash
export POSTGRES_URL="postgres://USER:PASS@HOST:5432/DB?sslmode=disable"
export REDIS_URL="redis://localhost:6379/0"

go run ./backend/cmd/server

Backend runs on `http://localhost:8080`.





### 2) Frontend
In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL (usually `http://localhost:5173`).

---

## Building a backend binary

From repo root:

```bash
go build -ldflags="-s -w" -o server ./backend/cmd/server
./server
```

---

## Scaling notes (10k → 1M users)

### What scales well
- Redis sorted set operations scale well for leaderboard reads/writes.
- Pagination via `ZREVRANGE` is efficient for “top N / page N” style reads.
- Prefix search using sets is fast at query time.

### What becomes heavy at 1M
- **Prefix sets storage cost**: storing every prefix for every username increases memory usage.
  - Mitigations:
    - Limit prefix indexing length (e.g., first 3–5 chars)
    - Use Redisearch / external search engine
    - Use trie-like structures or n-gram indexes depending on requirements
- **Rank calculation using `ZCOUNT` per row** adds extra Redis calls.
  - Mitigation: switch rank lookup to `ZREVRANK` with a tie-break strategy.
- **Write durability**: simulation updates queue in memory.
  - Mitigation: persistent queue or periodic reconciliation.

---

## Known limitations / improvements
- The table name is `leadboard` (spelling) in SQL and APIs are `/api/leadboard` — keep consistent or rename across code + DB migration.
- Consider removing debug `fmt.Printf` logs in hot paths.
- Add authentication/rate limiting if this becomes public-facing.


### 🌍 Deployed URLs
- **Backend**: [Render](https://matkis-assesment-2.onrender.com)
- **Frontend**: [Netlify](https://starlit-kelpie-53985a.netlify.app)
- **Video** : [video](https://drive.google.com/file/d/1qYyFohfwe6YjOELLnkeVatndBTOr2s2s/view?usp=drive_link)


