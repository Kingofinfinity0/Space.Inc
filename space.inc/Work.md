# Work.md - Space.inc Frontend Development

## Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant SupabaseRPC
    participant EdgeFunctions
    participant Realtime

    %% System 1: Messaging
    rect rgb(230, 240, 255)
        Note over User,Realtime: System 1 - Messaging
        User->>Frontend: Send Message
        Frontend->>SupabaseRPC: send_message(p_space_id, p_content, p_idempotency_key)
        SupabaseRPC-->>Frontend: Success
        Realtime-->>Frontend: Broadcast Message (Postgres Changes)
    end

    %% System 2: Files
    rect rgb(255, 240, 230)
        Note over User,EdgeFunctions: System 2 - File Storage
        User->>Frontend: Request Upload Voucher
        Frontend->>EdgeFunctions: files-api (REQUEST_UPLOAD_VOUCHER)
        EdgeFunctions-->>Frontend: { data: { upload_url, file_id } }
        User->>Frontend: Download / View History
        Frontend->>EdgeFunctions: files-api (SIGN_URL)
        EdgeFunctions-->>Frontend: signedUrl
    end
    
    %% System 3: Meetings
    rect rgb(230, 255, 230)
        Note over User,EdgeFunctions: System 3 - Meetings
        User->>Frontend: Join Meeting
        Frontend->>EdgeFunctions: meetings-api (GET_TOKEN with meetingId)
        User->>Frontend: Leave Meeting
        Frontend->>EdgeFunctions: meetings-api (END_MEETING)
        Frontend->>User: Show Outcome Prompt
        User->>Frontend: Save Outcome
        Frontend->>SupabaseRPC: record_meeting_outcome()
    end

    %% System 4: Notifications
    rect rgb(255, 230, 255)
        Note over User,Realtime: System 4 - Notifications
        Frontend->>SupabaseRPC: Initial Unread Count Fetch
        Realtime-->>Frontend: Realtime Badges Updates (INSERT)
        User->>Frontend: Click Bell
        Frontend->>SupabaseRPC: Fetch 20 Notifications
        User->>Frontend: Click Notification
        Frontend->>SupabaseRPC: Mark as Read & Redirect
    end

    %% System 5: Analytics
    rect rgb(255, 255, 230)
        Note over User,SupabaseRPC: System 5 - Analytics
        User->>Frontend: Open Dashboard
        Frontend->>SupabaseRPC: Fetch Stats & Feeds (via multiple RPCs)
        SupabaseRPC-->>Frontend: Dashboard Data
    end
```

## Thought Process

I will tackle this task step-by-step according to the strict deployment order:
Messaging → Files → Meetings → Notifications → Analytics.

### Task List
#### System 1 — Messaging (SPA-30)
- [x] Task 1B: Create global error translation helper `friendlyError`.
- [x] Task 1A: Fix duplicate messages (use `.rpc('send_message')`).
- [x] Task 1C: Implement Message edit UI (`.rpc('edit_message')`).
- [x] Task 1D: Implement Message delete UI (`.rpc('delete_message')`).

#### System 2 — File Storage (SPA-28)
- [ ] Task 2A: Fix the upload bug `upload_url`.
- [ ] Task 2B: Secure file downloads via `SIGN_URL`.
- [ ] Task 2C: Version history Modal/Dropdown.

#### System 3 — Meetings (SPA-29)
- [ ] Task 3A: Fix `getMeetingToken` (`meeting_id` -> `meetingId`).
- [ ] Task 3B: Add meeting category selector.
- [ ] Task 3C: Implement lifecycle hooks `START_MEETING` and `END_MEETING`.
- [ ] Task 3D: Post-meeting outcome prompt.
- [ ] Task 3E: "View Recording" button.

#### System 4 — Notifications (SPA-32)
- [ ] Task 4A: Create `NotificationBell.tsx`.
- [ ] Task 4B: Implement notification dropdown.

#### System 5 — Analytics Dashboards (SPA-31)
- [ ] Task 5A: Owner dashboard.
- [ ] Task 5B: Staff dashboard.
- [ ] Task 5C: Space detail mini-stats bar.

---
## USER SECTION NOTES
- spaces.status is lowercase only ('active', 'archived').
- friendlyError() everywhere to never show raw API errors.
- Token and time efficiency is priority.
