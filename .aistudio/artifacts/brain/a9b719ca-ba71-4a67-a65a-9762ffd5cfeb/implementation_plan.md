# IndiFunded — Production Performance & Supabase Egress Optimization Plan

A targeted optimization architecture that cuts unnecessary Supabase egress and upstream market-data load for 1,000+ concurrent users while preserving IndiFunded's exact visual design, trading rules, payout logic, and authentication flows.

---

## User Review & Critical Decisions

> [!IMPORTANT] All four architectural decisions below were confirmed during planning review and shape this implementation without changing visible UI, branding, or business rules.

- **Confirmed Decision 1 — SSE Live Stream + Polling Fallback**: Deliver live NSE/BSE quote updates and incremental bar updates over a centralized Server-Sent Events stream with automatic reconnection and adaptive HTTP polling fallback when SSE is unavailable or backgrounded.
- **Confirmed Decision 2 — Optional Redis Shared Cache (`REDIS_URL`)**: Introduce an adapter-backed cache and pub/sub layer that uses Redis automatically when configured via environment variables on multi-instance Render deployments, and runs zero-cost in-memory singleflight caching when `REDIS_URL` is absent.
- **Confirmed Decision 3 — PostgREST JSONB Filtering + Additive SQL Indexes**: Push per-user, per-account, and per-status filters plus pagination directly down to Supabase PostgREST queries instead of downloading entire collections, paired with an additive `CREATE INDEX IF NOT EXISTS` SQL migration for fast indexed lookups.
- **Confirmed Decision 4 — Smart Idle/Active Polling + Incremental Chart Ticks**: Load full candle history once per symbol/timeframe, apply incremental live bar updates via SSE + client tick subscribers, coalesce dashboard fetches, and slow or pause background state refreshes when idle or when no open positions exist.

---

## 1. Codebase Audit Summary & Core Value

### Key Bottlenecks Uncovered in Audit

1. **Full-Collection Supabase Egress on Every Poll**: The document-store layer currently downloads every row across all users for collections such as accounts, orders, positions, trades, transactions, and payouts, then filters by user or account in application memory. During dashboard and terminal sessions polling every 5 to 6 seconds, each active trader triggers full-collection transfers from Supabase.
2. **Repeated Auth & Public Read Round-Trips**: Every protected API poll performs an external user verification request plus a role lookup against Supabase, while public endpoints (`/settings`, plans, blogs, stories, certificates) fetch uncached data on every visit—including an explicit cache-busting timestamp on site settings and a startup Firestore connection ping.
3. **Unnecessary Write Amplification During Reads**: Dashboard and state endpoints run batch risk evaluation passes inline on read polls even when accounts have no open positions, causing extra reads and writes.
4. **Redundant Full-History Chart & Quote Polling**: Market feeds are already server-proxied (a strong foundation), yet each client widget independently polls quotes every 2.5 to 6 seconds and downloads full 360–400 bar candle datasets every 5 seconds—including second charts in multi-chart mode.
5. **Single-Node Cache & Missing Public Rate Limits**: Market caches and sync subscribers live solely in local process memory without optional shared cache support across Render instances or rate limiting on public market/proxy endpoints.

### Primary Value Delivered

- Dramatically lowers Supabase bandwidth and row-read consumption by replacing collection-wide downloads with scoped, indexed, paginated queries and multi-tier caching.
- Eliminates redundant 5-second full-chart downloads and fragmented widget quote polling by unifying client market widgets around a shared SSE push hub.
- Prepares the Render Node backend for 1,000+ concurrent users with singleflight coalescing, timeouts, public rate limiting, and optional multi-instance Redis coordination—without breaking existing APIs or adding mandatory paid infrastructure.

---

## 2. User Experience & Visual Design Preservation

> [!NOTE] Zero visual redesign: existing colors, typography, layout structure, dark/light themes, trading workflows, challenge rules, and payout calculations remain untouched.

### Key User Flows (Optimized Under the Hood)

1. **Public Browsing & Ticker Experience**:
   - Visitors load the landing experience immediately from cached public site settings and plan bundles; live NSE/BSE marquee tickers connect to a single shared browser market stream instead of launching overlapping per-widget HTTP pollers.
2. **Trader Dashboard & Account Views**:
   - Dashboard panels load quickly from coalesced user endpoints; background refreshes adapt smoothly (pausing when the tab is hidden or idle, refreshing promptly on tab focus or trade actions, and avoiding 6-second polling on static badges like certificates).
3. **Live Trading Terminal & Charts**:
   - Initial symbol/timeframe selection loads normalized historical bars cleanly into the single Lightweight Charts instance (preserving EMA20, volume histogram, prev-close line, hover OHLC readout, and micro-tick feel during confirmed live market hours).
   - Live market ticks stream incrementally and update only the active bar and quote readouts in memory without re-downloading all 400 candles every 5 seconds.
   - Timeframe or symbol switches hit local/server short-term history cache when warm, preventing flickering or duplicate chart mounts.
4. **Resilient Degradation & Market Status Accuracy**:
   - Data continues updating seamlessly if a single market provider throttles or if SSE disconnects (reconnecting cleanly with backoff or falling back to adaptive polling), while never falsely showing `LIVE` status outside confirmed market hours.

---

## 3. Key Product Decisions & Trade-Offs

- **Decision 1 — Query Pushdown via Additive JSONB Filters vs. Schema Rewrite**
  - *Chosen Approach*: Keep the existing JSONB document schema intact, add query-level JSONB filters (`user_id`, `account_id`, `user_email`, `status`, `slug`), server-side pagination/limits, and additive expression indexes in a safe SQL migration.
  - *Why*: Achieves major egress and latency reductions immediately without risking production data loss or rewriting dozens of trading/payout handlers.
  - *Alternatives Considered*: Breaking every collection into rigid relational tables would require invasive migrations and risk breaking live trading state consistency.

- **Decision 2 — Centralized Market SSE Hub + Shared Snapshot Cache vs. Dedicated WebSocket Infrastructure**
  - *Chosen Approach*: Stream consolidated quote and active-bar deltas over HTTP/2-friendly Server-Sent Events with client-side hook multiplexing and polling fallback, backed by a pluggable memory-or-Redis cache adapter.
  - *Why*: Matches existing Nitro/Node Render hosting cleanly (avoiding proxy upgrade complexity), coalesces all client tabs/widgets, and lets horizontal Render scaling opt into Redis via one environment variable.
  - *Alternatives Considered*: Running a separate WebSocket daemon or making Redis mandatory upfront would increase operational complexity and hosting cost unnecessarily.

- **Decision 3 — Short-TTL Auth Verification Caching + Cached Public Reads**
  - *Chosen Approach*: Cache verified bearer token user-role resolution briefly in memory (with instant invalidation on sign-out/password/role change) and serve non-sensitive public configuration with strict cache validation + ETags, while never sharing user-private endpoints (`/me/*`, KYC, balances, trades) in any shared cache.
  - *Why*: Removes thousands of redundant auth and settings queries under load while keeping strict user data isolation intact.

- **Decision 4 — Adaptive State Refresh Cadence**
  - *Chosen Approach*: Keep instant refresh after any order/position/risk action, fast polling when open positions or pending orders exist, and slower/focus-driven refreshes when a trader has no active positions or is idle.
  - *Why*: Eliminates idle polling egress without affecting active order fills or live P&L tracking.

---

## 4. Technical Architecture & Data Strategy

### System Data & Market Flow

```
Market Providers (NSE / BSE / TradingView / Yahoo)
   │  (singleflight deduplication, circuit breakers, strict timeouts)
   ▼
Render Backend — Centralized Market & API Hub
   ├─► Shared Cache Adapter (Optional Redis via REDIS_URL ◄──► Local LRU/TTL Memory)
   │      • Public settings/plans/blogs cache (invalidated on admin write / pubsub)
   │      • Shared quote snapshots & timeframe-scoped candle history cache
   │      • Lightweight token verification & IP rate-limit buckets
   ├─► SSE Live Broadcast Stream (/api/market/stream + /api/sync/stream)
   │      • Pushes changed quotes & active candle bar ticks only (1s–2s live, slow closed)
   │      • Clean client abort cleanup + automatic polling fallback
   └─► Scoped Supabase Store Layer
          • JSONB path filters (user_id, account_id, status) + bounded limits/pagination
          • Conditional risk evaluation (only when open positions or unsettled risk exist)
          ▼
     Supabase PostgreSQL (docs + user_roles + additive JSONB expression indexes)
          │
          ▼
Connected Website Users (Browser Clients)
   • Single shared market subscription manager coalescing header/widget/terminal consumers
   • Incremental Lightweight Charts updates + capped in-memory bar retention
   • Privacy-isolated /me/* state with idle/visibility-aware polling & debounced search
```

### Data Model, Caching & Scalability Strategy

- **Scoped & Paginated Supabase Access**:
  - Extend the backend store interface with indexed equality/OR filters (`where`) and range/limit controls so every trader endpoint fetches only that trader's records (and bounded recent orders/trades/transactions by default) rather than scanning entire collections.
  - Replace explicit `select('*')` checks with minimal column projections where only existence or metadata is checked, and avoid returning full rows on mutations when only confirmation is needed.
  - Deliver an additive migration creating B-tree expression indexes on `public.docs` (`collection`, `data->>'user_id'`, `data->>'account_id'`, `data->>'user_email'`, `data->>'slug'`, `data->>'status'`) using `CREATE INDEX IF NOT EXISTS`.

- **Centralized Market Hub & Incremental Charting**:
  - Add an SSE streaming endpoint subscribed by a single shared client market store, multiplexing symbol lists across components so Hero tickers, Overview cards, and Terminal watchlists trigger zero duplicate network requests.
  - Load candle history once on symbol/timeframe selection, apply live quote ticks incrementally to the trailing bar in Lightweight Charts, cap retained bars per series in browser memory, and preserve instant fallback to adaptive HTTP polling if SSE fails.
  - Store market snapshots strictly in server/shared cache (never writing transient tick prices to Supabase).

- **Backend Reliability & Security Safeguards**:
  - **Strict Secret Isolation**: Keep Supabase secret keys, optional Redis credentials, and upstream API configs strictly in server environment variables; never expose secrets in browser code or logs.
  - **User Isolation & RLS Preservation**: Keep Supabase Row Level Security intact, enforce server-side ownership checks on every `/me/*` endpoint, and strictly separate public shared cache keys from per-user private state.
  - **Protective Controls**: Apply request timeouts on outbound provider and Supabase calls, sliding-window rate limiting on public market/proxy/lead endpoints, in-flight request deduplication (singleflight), and input validation on symbols, timeframes, and pagination parameters.
