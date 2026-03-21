# Implementation Work Plan - Invitation System & Email Dispatch Fix

## Architecture Flow (Hardened SaaS - Direct Dispatch)

```mermaid
sequenceDiagram
    participant User as Admin User
    participant Inv as invitations-api
    participant SQL as SQL RPC
    participant Res as resend-api
    participant RE as Resend SMTP/API

    User->>Inv: POST /send_staff
    Inv->>SQL: call_rpc()
    SQL->>SQL: INSERT invite record (Status: pending)
    SQL-->>Inv: Return {token, org_id}
    Inv->>Res: POST /send (Sync Call)
    Res->>RE: POST /emails (External)
    Inv-->>User: 200 OK (Invite Processed)
```

## Phase 1: Database Logic (Status: COMPLETED)
- [x] **Fix SQL Search Path**: Updated `send_staff_invitation` and others to include `extensions`. (**FIXED 500 errors**)

## Phase 2: The Background Engine (Asynchronous Automation)
- [x] **Audit RPCs**: Confirmed `send_staff_invitation` and `send_client_invitation` return `token` and `org_id`.
- [x] **Worker Update**: Updated `background-worker` to include Resend logic (as fallback/audit).

## Phase 3: Direct Dispatch (Resend-API Sync) - COMPLETED
- [x] **Create `resend-api`**: Dedicated edge function for template rendering.
- [x] **Update `invitations-api`**: Move from Async (Worker) to Sync (Direct) dispatch (V4).
- [x] **Template Audit**: Verified `email_templates` table and keys exist.
- [x] **Vercel Analytics**: Installed `@vercel/analytics` and added to `index.tsx`.
- [x] **Vercel Routing Fix**: Added `vercel.json` for SPA rewrites.
- [x] **Join Page**: Created `src/views/JoinPage.tsx` and integrated with `Routes`.
## Phase 4: Invitations Management & Hybrid Join Flow (COMPLETED)
- [x] **Invitations Management View**: Created `InvitationsManagementView.tsx` with list, revoke, and edit functionality.
- [x] **Edit Email Identity**: Implemented "Update & Reissue" modal for pending invitations.
- [x] **Hybrid Join Flow**: Refactored `JoinPage.tsx` to handle status checks (Revoked, Expired, Accepted) and post-acceptance redirection.
- [x] **Team Sidebar Integration**: Added "Invitations" navigation item for admins.
- [x] **Mobile & Accessibility Audit**: Fixed input labels and accessibility titles in modals.

### Phase 3: Deployment & Invitation Flow (Manual Sharing) - IN PROGRESS
- [x] Vercel Analytics Integration
- [x] Vercel Routing Fix (vercel.json)
- [x] Join Page Implementation (/join)
- [x] SPA-20: Invite Link Generation Flow
  - [x] Update apiService with generate link RPCs
  - [x] Implement copy-button success state in Staff Modal
  - [x] Implement copy-button success state in Client Space creation
  - [x] Accessibility fixes (title attributes)
- [ ] **Deployment**: User to deploy functions via CLI.

---
## Founder's Research: Scalable Email Providers (Free Tier)

| Provider | Free Tier | Scaling Story | Why for Space.inc? |
| :--- | :--- | :--- | :--- |
| **Resend** | **3,000 emails/mo** | Linear pricing, modern API. | **Winner.** Native-like integration for Supabase. |
| **Postmark** | 100 emails/mo | Highest deliverability. | Too small for scaling. |
| **Amazon SES** | $0.10 / 1k | Cheapest bulk price. | High overhead for setup. Use later. |

---
## Founder's Research: Scalability Metrics
- Invitations: 100% manual sharing (Zero email cost/deliverability risk).
- Verification: JWT-based domain validation for `/join`.
- Performance: Edge-cached routing via `vercel.json`.

---
## USER SECTION NOTES
- User reported not receiving emails.
- Diagnosis: `background-worker` was using Supabase Auth (AWS SES) instead of Resend, causing "Already Registered" errors for existing users.
- **New Strategy**: Direct sync call to `resend-api` for instant feedback and bypassing Auth service limitations.

---
## DNS Verification Protocol (Resend Logic)
- Status: **Pending Verification**
- Problem: "All required records are missing"
- Resolution: User adding TXT (DKIM/SPF) and MX records to DNS Provider.

---
## TASK LIST: High Performance Implementation (FINAL)
- [x] Step 1: Update `apiService.ts` with 7 new lifecycle methods.
- [x] Step 2: Implement `InvitationsManagementView.tsx`.
- [x] Step 3: Refactor `JoinPage.tsx` for robust status handling.
- [x] Step 4: Fix accessibility lints in `InviteStaffModal.tsx`.
- [x] Step 5: Final deployment via Vercel CLI.
