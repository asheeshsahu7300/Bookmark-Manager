# Bookmark Manager

A real-time bookmark manager built with Next.js 14, Supabase, and Google OAuth. Save, delete, and sync bookmarks instantly across multiple browser tabs and devices.

## Features

- **Google OAuth** sign-in via Supabase Auth
- **Real-time sync** across tabs and devices
- **3-layer sync architecture** — BroadcastChannel + Supabase Realtime + visibility refetch
- **Server-side API routes** for reliable CRUD operations
- **Row Level Security** — each user only sees their own bookmarks
- **Connection status indicator** — live green dot when Realtime is connected

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Database:** Supabase (PostgreSQL)
- **Auth:** Supabase Auth with Google OAuth
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Language:** TypeScript

## Project Structure

```
├── app/
│   ├── api/
│   │   ├── auth/callback/route.ts    # OAuth callback handler
│   │   └── bookmarks/route.ts        # Server-side CRUD API (GET/POST/DELETE)
│   ├── login/page.tsx                 # Google sign-in page
│   ├── page.tsx                       # Main page (server component, auth check)
│   ├── layout.tsx                     # Root layout
│   └── globals.css                    # Tailwind base styles
├── components/
│   ├── BookmarkManager.tsx            # State owner, sync orchestrator
│   ├── BookmarkList.tsx               # Pure display component
│   ├── BookmarkForm.tsx               # Add bookmark form
│   └── Header.tsx                     # App header with sign-out
├── lib/
│   ├── supabase.ts                    # Singleton browser client
│   └── database.types.ts             # TypeScript types for Supabase
├── middleware.ts                       # Session refresh + route protection
├── supabase-setup.sql                 # Database schema + RLS + Realtime setup
└── package.json
```

## Architecture

### Sync System (3 Layers)

The app uses a layered sync strategy to ensure bookmarks stay consistent everywhere:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: BroadcastChannel (instant, same browser)          │
│  ─ After add/delete succeeds on server, broadcasts to all   │
│    other open tabs via native browser API. No server needed. │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Supabase Realtime (cross-device)                  │
│  ─ Postgres changes stream via WebSocket. Handles sync      │
│    between different browsers/devices. Deduplicates against  │
│    Layer 1 using bookmark IDs.                               │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: Visibility Refetch (safety net)                   │
│  ─ When a tab becomes visible, refetches all bookmarks      │
│    from the API. Catches anything Layer 1 & 2 missed.       │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User Action → API Route (server) → Supabase DB
                 ↓ response
         Update local state
                 ↓
    BroadcastChannel → Other tabs (instant)
                 ↓
    Supabase Realtime → Other devices (eventual)
```

All CRUD operations go through server-side API routes (`/api/bookmarks`), not direct client-to-Supabase calls. This ensures the auth session is always fresh and RLS policies are evaluated correctly.

### Component Roles

| Component | Role |
|---|---|
| `BookmarkManager` | Owns all bookmark state. Manages all 3 sync layers. Handles add/delete via API. Passes data down as props. |
| `BookmarkList` | Pure display. Receives `bookmarks[]`, `connectionStatus`, `onDelete`. Zero data fetching. |
| `BookmarkForm` | Controlled form. Calls `onAddBookmark` prop. Shows submitting state. |
| `Header` | Sign-out button. Displays user email. |

## Setup

### Prerequisites

- Node.js 18+
- A Supabase project
- Google OAuth credentials configured in Supabase

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Run the SQL setup

Execute `supabase-setup.sql` in your Supabase SQL Editor. This creates the table, indexes, RLS policies, enables Realtime, and sets `REPLICA IDENTITY FULL`.

### 4. Configure Google OAuth

In your Supabase Dashboard → Authentication → Providers → Google:
- Add your Google Client ID and Secret
- Set redirect URL to `https://your-domain.com/api/auth/callback`

### 5. Run the app

```bash
npm run dev
```

---

## Problems Faced & Solutions

This project encountered 6 significant bugs during development. Each one taught a lesson about Supabase, React, and real-time architecture.

---

### Problem 1: Split State Between Components

**Symptom:** Adding a bookmark didn't update the list. Deleting didn't reflect immediately.

**Root Cause:** `BookmarkManager` handled the insert logic but `BookmarkList` owned the `bookmarks[]` state and the Supabase subscription. There was no way for the parent to tell the child "I just added something."

**Fix:** Lifted all state into `BookmarkManager`. `BookmarkList` became a pure display component receiving `bookmarks`, `isLoading`, `connectionStatus`, and `onDelete` as props. Single source of truth.

---

### Problem 2: Multiple Supabase Client Instances

**Symptom:** Realtime events sometimes didn't fire. Multiple WebSocket connections in DevTools.

**Root Cause:** Every call to `createClientComponentClient()` created a new Supabase instance with its own WebSocket connection. Components were each creating their own.

**Fix:** Made `createBrowserClient()` a singleton in `lib/supabase.ts`:

```typescript
let browserClient = null
export const createBrowserClient = () => {
  if (!browserClient) {
    browserClient = createClientComponentClient()
  }
  return browserClient
}
```

---

### Problem 3: WebSocket Closed Before Connection Established

**Symptom:** Console error: `WebSocket is closed before the connection is established`

**Root Cause:** React 18 Strict Mode (enabled by default in Next.js 14 dev mode) mounts → unmounts → remounts every component. The first mount's cleanup called `supabase.removeChannel()` immediately, killing the WebSocket before it finished the handshake. The second mount then tried to create a channel with the same name, conflicting with the one still being torn down.

**Fix (3 parts):**

1. **Unique channel names per mount** — A `mountCounter` ensures each mount gets a unique channel name (`bookmarks-rt-userId-1`, `bookmarks-rt-userId-2`), preventing name collisions.

2. **Deferred cleanup** — `setTimeout(() => supabase.removeChannel(ch), 100)` gives the WebSocket time to close gracefully before the channel is removed.

3. **`cancelled` flag** — Every realtime callback checks `if (cancelled) return` so ghost events from the first mount's channel don't update state.

---

### Problem 4: Cross-Tab Sync Not Working

**Symptom:** Adding a bookmark in Tab A didn't appear in Tab B.

**Root Cause:** Supabase Realtime with RLS-filtered subscriptions (`filter: user_id=eq.${userId}`) is unreliable for cross-tab delivery, especially with auth token timing issues. The client-side auth session could be stale in one tab.

**Fix:** Added `BroadcastChannel` API as the primary cross-tab sync mechanism. After every successful add/delete, the tab broadcasts the change to all other tabs in the same browser instantly — no server roundtrip needed:

```typescript
broadcastRef.current.postMessage({ type: 'INSERT', bookmark: data })
broadcastRef.current.postMessage({ type: 'DELETE', id })
```

Also added visibility-based refetch as a fallback: when you switch to a tab, it refetches everything from the DB to catch anything both BroadcastChannel and Realtime missed.

---

### Problem 5: Deleted Bookmarks Reappearing on Refresh

**Symptom:** Delete a bookmark → it disappears → refresh the page → it's back.

**Root Cause (multi-part):**

1. **Optimistic temp IDs:** The add handler created a bookmark with `id: crypto.randomUUID()` (a temp ID not in the DB). If the user deleted that card before the DB insert returned the real ID, the delete call sent `.delete().eq('id', 'temp-uuid')` which matched 0 rows. Supabase returned no error for deleting 0 rows.

2. **Race condition duplicates:** The Supabase Realtime INSERT event sometimes arrived before the `.insert().select()` response. This created two copies of the same bookmark in state (one from Realtime, one from the API response). Delete removed both from UI, but only one existed in DB.

3. **`.delete().select()` silently failing:** An attempt to verify deletion using `.delete().select()` (RETURNING clause) was blocked by certain Supabase/RLS configurations, causing the delete to not execute at all.

**Fix:** Eliminated all optimistic updates. Switched to **DB-first architecture** — all operations go through server-side API routes, and state only updates after the server confirms success. No more temp IDs, no more race conditions.

---

### Problem 6: Delete Not Actually Reaching the Database

**Symptom:** Delete appeared to succeed (no errors), but the bookmark persisted in DB.

**Root Cause (2 parts):**

1. **Stale client-side auth session:** The client-side Supabase client's auth token was expired. When the RLS policy evaluated `auth.uid() = user_id`, `auth.uid()` returned `null`, so the `USING` clause matched 0 rows. The delete "succeeded" with 0 affected rows and no error.

2. **Middleware not covering API routes:** The middleware matcher was `['/', '/login']` — it never ran for `/api/bookmarks`, so session cookies were never refreshed for API calls. The route handler got a stale session.

**Fix:**

1. **Server-side API route** (`/api/bookmarks/route.ts`): All CRUD operations now use `createRouteHandlerClient` which creates a fresh server-side Supabase client with the latest session from cookies. The delete endpoint uses `{ count: 'exact' }` and returns `404` if 0 rows were affected — failures are no longer silent.

2. **Expanded middleware matcher** to `['/', '/login', '/api/:path*']` so API routes get session cookie refresh. API routes are not redirected to `/login` — they return `401 Unauthorized` as JSON instead.

---

### Bonus: Supabase Realtime Silently Drops DELETE Events

**Symptom:** Realtime INSERT events worked across tabs but DELETE events never arrived.

**Root Cause:** By default, PostgreSQL uses `REPLICA IDENTITY DEFAULT` which only sends the primary key (`id`) in the WAL for DELETE operations. The Realtime subscription had `filter: user_id=eq.${userId}`, but the DELETE payload had no `user_id` field — so Supabase couldn't match the filter and silently dropped every DELETE event.

**Fix:** Added to `supabase-setup.sql`:

```sql
ALTER TABLE bookmarks REPLICA IDENTITY FULL;
```

This tells PostgreSQL to include all columns in the WAL for DELETE operations, so the `user_id` filter can match.

---

## Key Lessons Learned

| # | Lesson |
|---|---|
| 1 | Supabase `.delete()` returns **no error** when 0 rows are affected. Always verify with `{ count: 'exact' }` or `.select()`. |
| 2 | Client-side Supabase auth tokens can silently expire, causing RLS to evaluate `auth.uid()` as `null`. Use server-side route handlers for critical operations. |
| 3 | `REPLICA IDENTITY FULL` is required for Realtime DELETE events when using filtered subscriptions. |
| 4 | React 18 Strict Mode double-mounts break WebSocket subscriptions. Use unique channel names, deferred cleanup, and cancellation flags. |
| 5 | Optimistic updates with temp IDs create edge cases that are extremely hard to debug. DB-first is simpler and more reliable. |
| 6 | Next.js middleware matcher must include API routes for session cookies to be refreshed on API calls. |
| 7 | `BroadcastChannel` is the most reliable way to sync across tabs in the same browser — no server dependency, instant delivery. |

## License

MIT