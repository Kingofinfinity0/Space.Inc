# Multi-Tenant Invitation Backend Architecture — Ground Truth Report

This document defines the backend contract for the invitation and share link systems in Space.inc. The frontend must align with these RPC signatures, error codes, and architectural patterns.

---

## 1. Core Architectural Concepts

The system distinguishes between two separate ways to join a space:

### A) Targeted Invitations (The `invitations` table)
- **Use Case**: Inviting a specific person by email.
- **URL Pattern**: `/invite/:token`
- **Link Lifetime**: Single-use. Accepting the invite consumes it.
- **Data Flow**: `create_invitation` -> Frontend shows Link -> Client clicks Link -> `accept_invitation`.

### B) Space Share Links (The `space_share_links` table)
- **Use Case**: A persistent "Join Link" for the space (e.g., in a welcome doc).
- **URL Pattern**: `/join/:token`
- **Link Lifetime**: Multi-use. Can be rotated (invalidates old token) or disabled.
- **Data Flow**: `create_space` (returns initial token) or `rotate_share_link` -> Frontend shows Link -> Client clicks Link -> `join_via_share_link`.

---

## 2. Membership Synchronization (Dual-Table Strategy)

To maintain compatibility with both the invitation system and the legacy platform components, every membership action synchronizes two tables:
1.  **`space_members`**: The invitation-system-native table. Distinguishes `member_type` ('staff' | 'client') and uses a modern `member_role` enum.
2.  **`space_memberships`**: The legacy platform table. Used by tasks, messages, and files.

**Authorization Helper**: Always use `has_space_role(user_id, space_id, roles_array)` in RLS policies. It handles the mapping between the two systems automatically.

---

## 3. RPC Reference (The API Contract)

### Targeted Invitations

| RPC Name | Arguments | Returns | Access |
| :--- | :--- | :--- | :--- |
| `create_invitation` | `p_space_id`, `p_email`, `p_member_type`, `p_role` | `{invitation_id, raw_token, expires_at}` | Owner/Admin |
| `get_invitation_by_token` | `p_raw_token` | `{space_id, space_name, email, member_type, role, status, expires_at}` | Public |
| `accept_invitation` | `p_raw_token` | `{space_id, member_id}` | Authenticated |
| `revoke_invitation` | `p_invitation_id` | `void` | Owner/Admin |
| `regenerate_invitation` | `p_invitation_id` | `{invitation_id, raw_token, expires_at}` | Owner/Admin |
| `list_space_invitations` | `p_space_id`, `p_status` (optional) | `TABLE(...)` | Owner/Admin/Manager |

### Space Share Links

| RPC Name | Arguments | Returns | Access |
| :--- | :--- | :--- | :--- |
| `get_share_link` | `p_space_id` | `TABLE(...)` (Metadata only) | Owner/Admin |
| `get_share_link_by_token` | `p_raw_token` | `{space_id, space_name, default_member_type, default_role, allowed_email_domain, status}` | Public |
| `join_via_share_link` | `p_raw_token` | `{space_id, member_id}` | Authenticated |
| `rotate_share_link` | `p_space_id` | `{raw_token, expires_at}` | Owner/Admin |
| `update_share_link_config` | `p_space_id`, `p_default_member_type`?, `p_default_role`?, `p_allowed_email_domain`?, `p_max_uses`?, `p_expires_at`? | `void` | Owner/Admin |
| `disable_share_link` | `p_space_id` | `void` | Owner/Admin |
| `enable_share_link` | `p_space_id` | `void` | Owner/Admin |

---

## 4. Error Codes & Handling

Backend raises exceptions with specific `ERRCODE` patterns. The frontend should switch on the message string or SQL state if possible.

| Error Message | HTTP Equivalent | Frontend UX Action |
| :--- | :--- | :--- |
| `NOT_AUTHENTICATED` | 401 | Redirect to Login (preserve return path). |
| `NOT_AUTHORIZED` | 403 | Show "Access Denied" or redirect to Dashboard. |
| `INVITE_NOT_FOUND` | 404 | Show "Invalid Link" message. |
| `INVITE_EXPIRED` | 410 | Show "Expired" message. |
| `INVITE_REVOKED` | 410 | Show "Revoked" message. |
| `INVITE_ALREADY_ACCEPTED` | 409 | Redirect to Space Dashboard. |
| `EMAIL_MISMATCH` | 403 | Show "Wrong Account" (Expected vs Actual). |
| `ALREADY_MEMBER` | 409 | Redirect to Space Dashboard. |
| `SHARE_LINK_EXHAUSTED` | 410 | Show "Limit Reached" message. |
| `EMAIL_DOMAIN_NOT_ALLOWED`| 403 | Show "Corporate Email Required" message. |

---

## 5. Security Model

1.  **Token Hashing**: Raw tokens are never stored. The DB only holds SHA-256 hashes.
2.  **Opaque URLs**: Public retrieval RPCs (`get_invitation_by_token`, `get_share_link_by_token`) return only safe metadata.
3.  **Strict Definership**: All mutations are `SECURITY DEFINER` and re-verify the `auth.uid()` against internal permission logic (`has_space_role`).
4.  **Audit Trail**: Every state transition (created, viewed, accepted, rotated, revoked) is logged in `invitation_events & activity_logs`.

---

## 6. Frontend Integration Tasks

- **URL Handling**: Replace any legacy `/join?token=...` or `/invite/:space_id/:token` with canonical `/invite/:token` (targeted) and `/join/:token` (share).
- **Token Management**: The `raw_token` is returned **EXACTLY ONCE** by `create_invitation` or `rotate_share_link`. The frontend must display it in a copy-once UI and never persist it to `localStorage`.
- **Membership List**: Use `list_space_invitations` to populate the "Pending" tab in the member management view.
