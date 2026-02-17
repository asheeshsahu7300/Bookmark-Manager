# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  Login Page  │      │  Main Page   │                   │
│  │              │      │              │                   │
│  │ - Google     │─────▶│ - Header     │                   │
│  │   OAuth      │      │ - Add Form   │                   │
│  │   Button     │      │ - List       │                   │
│  └──────────────┘      └──────┬───────┘                   │
│                               │                            │
│                               ▼                            │
│                    ┌─────────────────────┐                │
│                    │  Supabase Client    │                │
│                    │  (Browser)          │                │
│                    └──────────┬──────────┘                │
└───────────────────────────────┼───────────────────────────┘
                                │
                                │ HTTPS
                                │
┌───────────────────────────────┼───────────────────────────┐
│                     SUPABASE CLOUD                         │
├───────────────────────────────┼───────────────────────────┤
│                               ▼                            │
│  ┌────────────────────────────────────────────┐          │
│  │            Authentication                   │          │
│  │  ┌──────────────┐    ┌─────────────┐      │          │
│  │  │   Google     │───▶│    JWT      │      │          │
│  │  │   OAuth      │    │   Tokens    │      │          │
│  │  └──────────────┘    └─────────────┘      │          │
│  └────────────────────────────────────────────┘          │
│                               │                            │
│                               ▼                            │
│  ┌────────────────────────────────────────────┐          │
│  │         PostgreSQL Database                 │          │
│  │                                              │          │
│  │  ┌─────────────────────────────────┐       │          │
│  │  │     Bookmarks Table             │       │          │
│  │  │                                 │       │          │
│  │  │  - id (UUID)                    │       │          │
│  │  │  - user_id (UUID)               │       │          │
│  │  │  - title (TEXT)                 │       │          │
│  │  │  - url (TEXT)                   │       │          │
│  │  │  - created_at (TIMESTAMP)       │       │          │
│  │  └─────────────────────────────────┘       │          │
│  │                                              │          │
│  │  Row Level Security (RLS):                  │          │
│  │  ✓ Users see only their bookmarks          │          │
│  │  ✓ Users can only modify their data        │          │
│  └────────────────────────────────────────────┘          │
│                               │                            │
│                               ▼                            │
│  ┌────────────────────────────────────────────┐          │
│  │          Realtime Engine                    │          │
│  │                                              │          │
│  │  Broadcasts changes to all connected        │          │
│  │  clients via WebSocket                      │          │
│  └────────────────────────────────────────────┘          │
│                               │                            │
└───────────────────────────────┼───────────────────────────┘
                                │
                                │ WebSocket
                                │
┌───────────────────────────────┼───────────────────────────┐
│                     CLIENT SIDE                            │
├───────────────────────────────┼───────────────────────────┤
│                               ▼                            │
│  ┌────────────────────────────────────────────┐          │
│  │      Real-time Subscription                 │          │
│  │                                              │          │
│  │  Listens for:                               │          │
│  │  - INSERT events → Add to list              │          │
│  │  - DELETE events → Remove from list         │          │
│  │  - UPDATE events → Update in list           │          │
│  └────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Authentication Flow

```
User clicks "Continue with Google"
         │
         ▼
Next.js redirects to Google OAuth
         │
         ▼
Google authenticates user
         │
         ▼
Redirect to /api/auth/callback with code
         │
         ▼
Exchange code for session (Supabase)
         │
         ▼
Redirect to home page with JWT token
```

### 2. Add Bookmark Flow

```
User submits bookmark form
         │
         ▼
Client validates input
         │
         ▼
Supabase.insert() with user_id
         │
         ▼
PostgreSQL INSERT (RLS checks user_id)
         │
         ▼
Success → Realtime broadcasts INSERT event
         │
         ├─────────▶ Current tab updates state
         │
         └─────────▶ Other tabs receive event & update
```

### 3. Delete Bookmark Flow

```
User clicks delete button
         │
         ▼
Confirmation dialog
         │
         ▼
Supabase.delete() with id and user_id
         │
         ▼
PostgreSQL DELETE (RLS verifies ownership)
         │
         ▼
Success → Realtime broadcasts DELETE event
         │
         ├─────────▶ Current tab updates state
         │
         └─────────▶ Other tabs receive event & update
```

## Security Model

### Row Level Security (RLS)

All database operations are protected by RLS policies:

1. **SELECT Policy**: `auth.uid() = user_id`
   - Users can only see their own bookmarks

2. **INSERT Policy**: `auth.uid() = user_id`
   - Users can only create bookmarks for themselves

3. **DELETE Policy**: `auth.uid() = user_id`
   - Users can only delete their own bookmarks

### Authentication

- Google OAuth via Supabase Auth
- JWT tokens stored in HTTP-only cookies
- Automatic token refresh
- Server-side session validation

## Component Structure

```
app/
├── layout.tsx           # Root layout with global styles
├── page.tsx             # Main page (protected, server component)
├── login/
│   └── page.tsx         # Login page (client component)
├── api/
│   └── auth/
│       └── callback/
│           └── route.ts # OAuth callback handler
└── globals.css          # Tailwind styles

components/
├── Header.tsx           # Navigation with user info
├── BookmarkForm.tsx     # Add bookmark form
└── BookmarkList.tsx     # List with real-time updates

lib/
├── supabase.ts          # Supabase client utilities
└── database.types.ts    # TypeScript database types

middleware.ts            # Auth protection middleware
```

## Tech Stack Details

### Frontend
- **Next.js 14** (App Router): React framework with server components
- **React 18**: UI library
- **TypeScript**: Type safety
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library

### Backend
- **Supabase**: 
  - PostgreSQL database
  - Authentication (OAuth)
  - Realtime subscriptions
  - Row Level Security

### Deployment
- **Vercel**: Edge network, automatic deployments
- **GitHub**: Version control, CI/CD integration

## Performance Optimizations

1. **Server Components**: Reduced JavaScript bundle size
2. **Optimistic Updates**: Instant UI feedback
3. **Real-time Subscriptions**: No polling required
4. **Edge Functions**: Low-latency API routes
5. **Static Generation**: Fast page loads

## Scalability Considerations

- **Database Indexes**: On `user_id` and `created_at` columns
- **RLS Policies**: Filter at database level
- **Connection Pooling**: Supabase handles connections
- **CDN**: Vercel Edge Network for global distribution
- **Real-time**: WebSocket connections managed by Supabase

---

This architecture ensures:
✅ Security (RLS + OAuth)
✅ Real-time updates (WebSocket)
✅ Performance (Server components + edge)
✅ Scalability (Managed infrastructure)
✅ Developer experience (TypeScript + modern tooling)
