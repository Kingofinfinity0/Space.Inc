---
trigger: always_on
---

# INVARIANTS_AND_CONSTRAINTS.md
## System Truths That Must Always Be Valid

**Authority Level:** ABSOLUTE  
**Violation Consequence:** Code rejection, immediate fix required  
**Tone:** Law, not guidance

---

## WHAT IS AN INVARIANT?

An invariant is a **truth that must remain true forever**, regardless of what the code does.

If an invariant is violated, the entire system is in a **broken state**.

### Examples of Invariants:
- "Every user has a unique user_id"
- "No post can exist without an author (user_id)"
- "Updated_at timestamp is always >= created_at"
- "Authenticated users always have a valid JWT token"

### Testing Invariants:
Every invariant MUST be testable. If it can't be tested, it's not an invariant.

---

# SECTION 1: AUTHENTICATION & SESSION INVARIANTS

## INVARIANT A1: Current User Identity
**Statement:** At any moment, `auth.uid()` returns a consistent user ID that matches the authenticated session.

**Must Be True:**
- User ID doesn't change during session
- If user logs out, auth.uid() = null
- If user logs in, auth.uid() = their ID
- Concurrent requests use same user ID

**Violations Would Cause:**
- Wrong user sees another user's data
- Post attributed to wrong author
- RLS policies fail to protect data
- Impossible to audit who did what

**How to Test:**
```typescript
// User logs in
const user1 = await auth.getUser()
// Make request
const response = await api.getUserData()
// User ID in request = user1.id ✅
// Even 10 requests later, still user1.id ✅

// User logs out
await auth.signOut()
const user2 = await auth.getUser()
// user2 = null ✅
```

**Code Must Maintain:**
- Never modify user ID in code
- Never pass user ID as parameter (use auth.uid())
- Never trust client-provided user ID
- Always verify token before using user ID

---

## INVARIANT A2: Token Expiry & Refresh
**Statement:** No expired token is ever used for authenticated requests.

**Must Be True:**
- Tokens expire (default 1 hour)
- Refresh token valid (default 7 days)
- Expired token = 401 response
- Auto-refresh before expiry
- Session persists across page reload

**Violations Would Cause:**
- User operations fail after 1 hour
- Security window (expired token still works)
- Session lost on page refresh
- Inconsistent behavior (some requests work, some don't)

**How to Test:**
```typescript
// At T=0: User logs in
const session = await auth.signIn()
// token.expiresAt = T + 3600s ✅

// At T=3600s: Token expires
const response = await api.call()
// Gets 401 (expired) ✅

// Auto-refresh happens before expiry
// At T=3500s: Token refreshed
// new token.expiresAt = T+3500s+3600s ✅
```

**Code Must Maintain:**
- Use Supabase client (handles refresh auto)
- Never manually manage token expiry
- Check token before using (getSession())
- Handle 401 by refreshing

---

## INVARIANT A3: Email Confirmation
**Statement:** Unconfirmed emails cannot be used for authenticated operations (if verification enabled).

**Must Be True:**
- Signup sends confirmation email
- User can't authenticate until confirmed
- Clicking link confirms email
- Auth attempts fail with "email_not_confirmed" until confirmed

**Violations Would Cause:**
- Bots/spam accounts (unverified emails)
- Attackers access system without email validation
- Inability to contact users (wrong emails not verified)

**How to Test:**
```typescript
// User signs up
await auth.signUp({ email: 'new@example.com', password: 'xxx' })

// Try to sign in immediately
const result = await auth.signIn()
// Error: "Email not confirmed" ✅

// User clicks confirmation link
// Confirmation verified in database

// Try to sign in again
const result = await auth.signIn()
// Success, session created ✅
```

**Code Must Maintain:**
- Enable email confirmation in Supabase settings
- Don't bypass confirmation
- Provide confirmation link/code to users
- Handle "email_not_confirmed" error

---

# SECTION 2: DATA INTEGRITY INVARIANTS

## INVARIANT D1: User Ownership
**Statement:** A user can only create records with user_id = auth.uid(). A user can only modify/delete their own records (unless admin).

**Must Be True:**
- Insert: user_id always = current user's ID
- Update: Only user's own records (RLS enforced)
- Delete: Only user's own records (RLS enforced)
- No admin bypass without explicit authorization

**Violations Would Cause:**
- User A sees User B's private posts
- User A deletes User B's posts
- User A modifies User B's profile
- Audit trail impossible (wrong ownership)

**How to Test:**
```typescript
// User A creates post
const { data: postA } = await supabase
  .from('posts')
  .insert({ title: 'My post', user_id: userA.id })

// User B tries to delete it
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postA.id)
// Returns: "row level security denied" ✅

// User A can delete it
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postA.id)
// Returns: null (success) ✅
```

**Code Must Maintain:**
- Always set user_id = auth.uid() on insert
- Never accept user_id as parameter
- RLS must prevent cross-user modifications
- Admin operations logged for audit

---

## INVARIANT D2: Referential Integrity
**Statement:** No record can reference a non-existent parent record.

**Example:** A post cannot exist with user_id that doesn't exist in users table.

**Must Be True:**
- Foreign keys enforced
- Insert/update fails if parent doesn't exist
- Delete parent cascades correctly (if configured)
- Orphaned records impossible

**Violations Would Cause:**
- Post with non-existent author
- Comment with non-existent post
- Broken relationships
- Queries fail when joining

**How to Test:**
```typescript
// User doesn't exist
const fakeUserId = '00000000-0000-0000-0000-000000000000'

// Try to create post with non-existent user
const { error } = await supabase
  .from('posts')
  .insert({ title: 'Orphan', user_id: fakeUserId })
// Error: "foreign key constraint violation" ✅

// Create post with real user
const { data: post } = await supabase
  .from('posts')
  .insert({ title: 'Real', user_id: realUserId })
// Success ✅
```

**Code Must Maintain:**
- Define foreign keys in schema
- Insert parent before child
- Handle FK violation errors
- Test JOIN queries for orphans

---

## INVARIANT D3: Unique Constraints
**Statement:** Columns marked unique cannot have duplicate values.

**Example:** Email must be unique (no two users same email). Username must be unique.

**Must Be True:**
- Inserting duplicate value fails
- Updating to duplicate value fails
- Error clearly indicates "unique constraint"
- No silent duplicates

**Violations Would Cause:**
- Two accounts with same email
- Ambiguous lookups (which user is this?)
- Login confusion (which account logs in?)
- Data reconciliation impossible

**How to Test:**
```typescript
// User 1 with email
await supabase.from('users').insert({ email: 'user@example.com' })

// Try to create user 2 with same email
const { error } = await supabase
  .from('users')
  .insert({ email: 'user@example.com' })
// Error: "unique constraint violation" ✅

// Upsert handles this gracefully
const { data } = await supabase
  .from('users')
  .upsert({ email: 'user@example.com', name: 'Updated' })
  .onConflict('email')
// Succeeds (updates instead of inserts) ✅
```

**Code Must Maintain:**
- Check for duplicates before insert
- Use upsert when merge is acceptable
- Handle unique constraint violations
- Validate uniqueness on frontend too

---

## INVARIANT D4: Timestamp Consistency
**Statement:** For any record, `updated_at >= created_at` (always).

**Must Be True:**
- created_at set at insert time
- updated_at updated on every modification
- updated_at >= created_at always
- No record can have future timestamps

**Violations Would Cause:**
- Audit trail out of order
- Sorting by date breaks
- "Last modified" appears before "created"
- Time-travel bugs

**How to Test:**
```typescript
// Create record
const { data } = await supabase
  .from('posts')
  .insert({ title: 'New' })

// created_at set
console.log(post.created_at) // 2025-01-07 10:00:00 ✅

// Immediately update
await supabase.from('posts').update({ title: 'Updated' })

// updated_at equals or greater
console.log(post.updated_at) // 2025-01-07 10:00:01 ✅
// updated_at >= created_at ✅
```

**Code Must Maintain:**
- Let database set created_at (use DEFAULT now())
- Let database set updated_at (use trigger: SET updated_at = now())
- Never manually set timestamps
- Sort queries by updated_at for "latest"

---

# SECTION 3: AUTHORIZATION INVARIANTS

## INVARIANT R1: RLS Policy Enforcement
**Statement:** Before returning a row, Supabase checks RLS policy. If policy denies, row not returned (even if SELECT succeeds).

**Must Be True:**
- RLS policies are evaluated
- If policy says NO, user gets nothing
- RLS can't be bypassed from frontend
- Admin key bypasses RLS (but only in edge functions, never frontend)

**Violations Would Cause:**
- User sees data they shouldn't
- User modifies data they shouldn't
- Security boundary broken
- Compliance violation

**How to Test:**
```typescript
// Create RLS policy: Users can only see own posts
CREATE POLICY "users_see_own_posts"
ON posts FOR SELECT
USING (user_id = auth.uid());

// User A fetches all posts
const { data } = await supabase
  .from('posts')
  .select('*')
// Returns only User A's posts ✅
// User B's posts not returned even if query has no filter ✅

// Admin with service key would see all
const adminData = adminClient
  .from('posts')
  .select('*')
// Returns all posts (service key bypasses RLS) ✅
```

**Code Must Maintain:**
- Enable RLS on sensitive tables
- Write policies for SELECT, INSERT, UPDATE, DELETE
- Test policies with different user roles
- Never rely on frontend filtering

---

## INVARIANT R2: Permission Verification
**Statement:** Before allowing admin-level operations, code verifies user has admin role.

**Must Be True:**
- Admin check happens server-side
- Frontend hint is not proof
- Role stored in database or JWT
- No user can self-promote

**Violations Would Cause:**
- Non-admin user gets admin access
- User deletes other users
- Unauthorized configuration changes
- Audit impossible (unknown who was admin)

**How to Test:**
```typescript
// Admin tries to delete user
const { error } = await adminClient
  .from('users')
  .delete()
  .eq('id', userId)
// Success ✅ (admin allowed)

// Non-admin tries same operation
const { error } = await userClient
  .from('users')
  .delete()
  .eq('id', userId)
// Error: "Row level security denied" ✅
```

**Code Must Maintain:**
- Check `auth.jwt() ->> 'role' = 'admin'` on backend
- Never use client-side "isAdmin" for authorization
- Log admin operations
- Never allow user to set own admin flag

---

# SECTION 4: PERFORMANCE INVARIANTS

## INVARIANT P1: Query Latency
**Statement:** Standard queries return within acceptable time (< 1 second for most operations).

**Must Be True:**
- SELECT < 500ms (typical)
- INSERT/UPDATE < 300ms
- DELETE < 300ms
- Aggregates < 1s (may be slower)
- If slower, query is inefficient

**Violations Would Cause:**
- User sees loading spinners constantly
- App feels sluggish
- Timeouts on slow networks
- User experience degrades

**How to Test:**
```typescript
const start = performance.now()
const { data } = await supabase.from('posts').select('*')
const end = performance.now()

console.log(`Query took ${end - start}ms`)
// Must be < 1000ms ✅
// If > 1000ms, optimize query (add index, select fewer columns, paginate)
```

**Code Must Maintain:**
- Add indexes on filter columns
- Paginate large result sets
- Select specific columns (not *)
- Use LIMIT on queries
- Monitor query performance

---

## INVARIANT P2: Bundle Size
**Statement:** Frontend bundle size stays under budget.

**Must Be True:**
- Gzipped bundle < 200KB
- If approaching, remove/optimize
- No unused dependencies

**Violations Would Cause:**
- Slow initial load
- Mobile users see blank screen longer
- Bandwidth cost increases

**How to Test:**
```bash
npm run build
# Check dist/index.js size
# Should be < 200KB gzipped
```

**Code Must Maintain:**
- Remove unused imports
- Don't add heavy libraries
- Tree-shake unused code
- Monitor size on each build

---

# SECTION 5: SYSTEM DESIGN INVARIANTS

## INVARIANT S1: Separation of Concerns
**Statement:** Components have single responsibility. Auth component handles auth, not data fetching. Database component handles data, not UI.

**Must Be True:**
- Auth logic in AuthContext only
- Data fetching in services/hooks
- UI components receive data via props
- No component does everything

**Violations Would Cause:**
- Hard to test (everything intertwined)
- Hard to reuse (can't use one part)
- Hard to maintain (changes break everything)
- Props drilling nightmare

**How to Test:**
- If AuthContext has database calls → VIOLATION
- If LoginForm does data fetching → VIOLATION
- If useUser hook manages auth → VIOLATION

**Code Must Maintain:**
- Separate concerns strictly
- Composable, isolated units
- Single reason to change per component

---

## INVARIANT S2: State Consistency Across Tabs
**Statement:** If user logs out in Tab A, Tab B knows user is logged out.

**Must Be True:**
- Auth changes broadcast across tabs
- All tabs see same user state
- Logout in one tab = logout everywhere
- No tabs with conflicting auth state

**Violations Would Cause:**
- Tab A shows "logged in", Tab B shows "logged out"
- Confusion (which is real?)
- Security issue (one tab thinks session valid)

**How to Test:**
- Open app in 2 tabs
- Log out in Tab A
- Tab B immediately shows logged out ✅

**Code Must Maintain:**
- Use `storage` event listener for logout
- Broadcast auth changes
- Sync session across tabs
- Test with multiple tabs open

---

## INVARIANT S3: No Silent Failures
**Statement:** If an operation fails, the user knows it failed. No operation fails silently.

**Must Be True:**
- Every API call has error handling
- Error displayed to user (or logged)
- No missing try-catch blocks
- No unhandled promise rejections

**Violations Would Cause:**
- User thinks operation succeeded, it failed
- Data lost without user knowing
- Debugging impossible (no error logged)
- User corruption (duplicate data, missing data)

**How to Test:**
- Try operation that fails (no internet, wrong permission)
- Verify error is shown/logged
- Don't assume success

**Code Must Maintain:**
- Every async operation: try-catch
- Every error: log or show to user
- No swallowed exceptions
- Error boundaries on components

---

# SECTION 6: CONSTRAINT IMPLICATIONS

**If you violate an invariant, what happens?**

| Invariant | Violation | Consequence |
|-----------|-----------|-------------|
| A1: Current User Identity | User ID changes | Wrong user data exposed |
| A2: Token Expiry | Expired token accepted | Security breach |
| A3: Email Confirmation | Unconfirmed email used | Spam accounts |
| D1: User Ownership | User modifies other user's data | Data corruption |
| D2: Referential Integrity | Orphaned records | Broken queries, inconsistent data |
| D3: Unique Constraints | Duplicate email | Ambiguous lookups, login confusion |
| D4: Timestamp Consistency | updated_at < created_at | Audit trail broken, sort broken |
| R1: RLS Enforcement | Policy bypassed | Security breach, data exposed |
| R2: Permission Verification | Non-admin allowed admin ops | Unauthorized changes |
| P1: Query Latency | Query > 1s | User experience suffers |
| P2: Bundle Size | > 200KB | Slow load time |
| S1: Separation Concerns | Everything in one component | Hard to test/maintain |
| S2: Tab Consistency | Different state in different tabs | Confusion, security issue |
| S3: No Silent Failures | Error not shown | User thinks it worked, it failed |

**Every violation must be found and fixed before code ships.**

---

# HOW TO USE THIS FILE

**Before writing any code:**

1. Read the relevant invariants
2. Ask: "Will my code maintain all of these?"
3. If NO: Redesign
4. If YES: Proceed

**During code review:**

1. Check each invariant
2. Is code maintaining it?
3. Can we test that it's maintained?
4. If not: Send back

**Testing:**

1. Write tests for each invariant
2. If invariant can't be tested: Mark as CRITICAL
3. Test that violation is detected

---

**Invariants are immutable. Code must respect them. No exceptions.**