# Work.md

## Sequence Diagram

```mermaid
sequenceDiagram
    participant Frontend as Frontend (inviteService.ts)
    participant EdgeFunction as Supabase Edge Function (invitations-api)
    participant Supabase as Supabase Database

    Note over Frontend, EdgeFunction: Update Endpoint URL to correctly point to invitations-api

    alt Resolve Space Token
        Frontend->>EdgeFunction: POST { action: 'resolve_space_token', token }
        EdgeFunction->>Supabase: Verify token
        Supabase-->>EdgeFunction: Token data
        EdgeFunction-->>Frontend: Token details (space_id, name, etc.)
    else Accept Space Invite
        Frontend->>EdgeFunction: POST { action: 'accept_space_invite', token } (Auth required)
        EdgeFunction->>Supabase: Create membership
        Supabase-->>EdgeFunction: Success/Failure
        EdgeFunction-->>Frontend: Success Response
    else Validate Email Invite
        Frontend->>EdgeFunction: POST { action: 'validate', token }
        EdgeFunction->>Supabase: Check invite status
        Supabase-->>EdgeFunction: Invite data
        EdgeFunction-->>Frontend: Validation Result
    else Accept Email Invite
        Frontend->>EdgeFunction: POST { action: 'accept', token } (Auth required)
        EdgeFunction->>Supabase: Update invite & roles
        Supabase-->>EdgeFunction: Success/Failure
        EdgeFunction-->>Frontend: Success Response
    else Send Client Invite
        Frontend->>EdgeFunction: POST { action: 'send_client', email, space_id } (Auth required)
        EdgeFunction->>Supabase: Create and Send Invite
        Supabase-->>EdgeFunction: Success
        EdgeFunction-->>Frontend: Invite Details
    else Send Staff Invite
        Frontend->>EdgeFunction: POST { action: 'send_staff', email, role, space_assignments } (Auth required)
        EdgeFunction->>Supabase: Create and Send Invite
        Supabase-->>EdgeFunction: Success
        EdgeFunction-->>Frontend: Invite Details
    else Get Space Invite Link
        Frontend->>EdgeFunction: POST { action: 'get_space_invite_link', space_id } (Auth required)
        EdgeFunction->>Supabase: Fetch current link
        Supabase-->>EdgeFunction: Link data
        EdgeFunction-->>Frontend: Link details
    else Regenerate Space Link
        Frontend->>EdgeFunction: POST { action: 'regenerate_space_link', ...params } (Auth required)
        EdgeFunction->>Supabase: Update/Replace link
        Supabase-->>EdgeFunction: New link data
        EdgeFunction-->>Frontend: New link details
    end
```

## Thought Process

### 1. Fix Endpoint URL Redundancy
I will start by fixing the redundancy in the invitation endpoint URL in `inviteService.ts`. The current implementation results in a double `/functions/v1/functions/v1` path.

**Task List:**
- [x] Locate all fetch calls in `src/services/inviteService.ts`.
- [x] Correct the URL template literals to use `${EDGE_FUNCTION_BASE_URL}/invitations-api`.

### 2. Verify and Update Request Payloads
I will ensure all invitation-related payloads contain the necessary information as requested. I'll check if any field is missing or named incorrectly based on the user's request for "invitation data and information".

**Task List:**
- [x] Review `resolveSpaceToken` payload.
- [x] Review `acceptSpaceInvite` payload.
- [x] Review `validateEmailInvite` payload.
- [x] Review `acceptEmailInvite` payload.
- [x] Review `sendClientInvite` payload.
- [x] Review `sendStaffInvite` payload.
- [x] Review `getSpaceInviteLink` payload.
- [x] Review `regenerateSpaceLink` payload.

### 3. Verification
I will verify the changes by checking if there are any other hardcoded URLs or incorrect payloads in related components.

**Task List:**
- [x] Search for `invitations-api` in the entire project.
- [x] Check `src/components/views/InviteStaffModal.tsx` for payload consistency.
- [x] Check `src/components/views/SpaceDetailView.tsx` for payload consistency.

## USER SECTION NOTES
- `inviteService.ts` needs to send `space_id` (not `spaceId`) in the request body for the regenerate action.
    - Status: Confirmed. The current implementation uses `space_id: spaceId` in the request body for `regenerate_space_link`, `send_client`, and `get_space_invite_link`.

### 4. Deploy to Vercel
I will deploy the current application code to Vercel manually since the GitHub integration seems to have failed to trigger a build.

**Sequence Diagram:**
```mermaid
sequenceDiagram
    participant Local as Local Machine (Antigravity)
    participant VercelCLI as Vercel CLI
    participant VercelCloud as Vercel Cloud
    
    Local->>VercelCLI: vercel link (Check if project is linked)
    Local->>VercelCLI: vercel pull (Pull production environment variables)
    Local->>VercelCLI: vercel deploy --prod (Push to Production)
    VercelCloud-->>Local: Deployment Success & URL
```

**Task List:**
- [ ] Check if Vercel CLI is installed.
- [ ] Verify project linkage to Vercel.
- [ ] Execute `vercel deploy --prod` to push current local changes to production.
- [ ] Provide the deployment URL to the user.
