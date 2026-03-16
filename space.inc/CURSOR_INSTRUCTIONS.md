# Nexus Client Portal - Integration Guide for Cursor

This document serves as the master instruction list for integrating the Nexus Client Portal with backend services.

## Tech Stack Overview
- **Frontend**: React (Vite), TailwindCSS, Lucide React
- **Backend/DB**: Supabase (PostgreSQL, Auth, Realtime, Storage)
- **Video Calls**: Daily.co
- **Payments**: Polar.sh

---

## Phase 1: Supabase Setup (Database & Auth)

### 1. Database Initialization
**Action**: Run the contents of `supabase_schema.sql` in the Supabase SQL Editor.
**Outcome**: This will create all necessary tables (`spaces`, `profiles`, `meetings`, `tasks`, `messages`, `files`) and set up Row Level Security (RLS) policies.

### 2. Authentication Integration
**Action**: Install Supabase client: `npm install @supabase/supabase-js`
**Action**: Create `lib/supabaseClient.ts` to initialize the client using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

**Task - Staff Auth**:
- Implement "Sign Up" for Organization Owners (creates a new Organization).
- Implement "Sign In" for Staff.
- **Invite Logic**: In `StaffView`, the "Generate Link" button should call a Supabase Edge Function (`invite-staff`) that:
  1. Creates a record in the `invitations` table.
  2. Returns a URL like `app.nexus.com/join?token={token}`.
  3. When the user visits this link, they sign up and are automatically added to the `profiles` table with the correct `role` and `organization_id`.

**Task - Client Auth**:
- Clients should likely use "Magic Links".
- When a `space` is created, optionally trigger an email to the client email address with a login link.

### 3. Data Fetching Replacement
**Action**: Go through `App.tsx` and replace `MOCK_DATA` states with `useEffect` hooks fetching from Supabase.

| Mock State | Supabase Table | Query Logic |
|Ref|Ref|Ref|
| `clients` | `spaces` | `select(*).eq('organization_id', user.org_id)` |
| `messages` | `messages` | `select(*).eq('space_id', activeSpaceId)` |
| `meetings` | `meetings` | `select(*).eq('organization_id', user.org_id)` |
| `tasks` | `tasks` | `select(*).eq('assignee_id', user.id)` |
| `files` | `files` | `select(*).or('is_global.eq.true', 'space_id.eq.activeSpaceId')` |

---

## Phase 2: Realtime Communication

### 1. Chat (WhatsApp Style)
**Action**: In `InboxView` (inside `App.tsx`), implement Supabase Realtime subscriptions.
- **Channel**: `room:space_id`
- **Event**: `INSERT` on `messages` table.
- **Logic**: When a new message arrives, push it to the `messages` state array instantly.

### 2. Notifications
**Action**: Create a global listener for the `notifications` table.
- Display a toast/badge when a client uploads a file or sends a message.

---

## Phase 3: Meeting Hub (Daily.co)

### 1. Room Creation
**Action**: Create a Supabase Edge Function `create-meeting-room`.
- This function should call the Daily.co REST API (`https://api.daily.co/v1/rooms`) using your Daily API Key.
- It returns the `url` (e.g., `https://your-domain.daily.co/room-name`).
- Save this URL in the `meetings` table in Supabase.

### 2. Embedding Video
**Action**: Install `npm install @daily-co/daily-js`.
**Action**: In `GlobalMeetingsView`, update the `joinRoom` function.
- Create a call object: `const call = DailyIframe.createFrame({ ...options })`.
- Join the room: `call.join({ url: meeting.daily_room_url })`.

---

## Phase 4: Files & Storage

### 1. Storage Bucket
**Action**: Create a bucket named `nexus-assets` in Supabase Storage.
**Policy**: Allow authenticated users to upload; allow public (or signed URL) read access.

### 2. Global vs Specific Logic
**Action**: Update the "Upload" modal in `GlobalFilesView`.
- **Specific**: Upload file -> Get URL -> Insert row into `files` table with `space_id = selectedSpaceId`.
- **Global**: Upload file -> Get URL -> Insert row into `files` table with `is_global = true` (and `space_id` NULL).

---

## Phase 5: Payments (Polar.sh)

### 1. Subscription Check
**Action**: Create a Database Webhook or Edge Function.
- When a user logs in, check their subscription status via Polar.sh API or a synced table.
- If `status !== 'active'`, redirect them to a "Billing/Upgrade" page.
- **Lockout**: Disable "Create Space" button in `App.tsx` if the user has reached their plan limit.

---

## Phase 6: Settings & Exports

### 1. Export Data
**Action**: In `SettingsView`, the "Download" button should trigger a JSON dump of all tables related to that `organization_id`.

### 2. Delete Account
**Action**: This is a destructive action.
- Ensure it uses a Postgres Function `delete_organization_data(org_id)` to cascade delete all clients, messages, and files to prevent orphaned data.
