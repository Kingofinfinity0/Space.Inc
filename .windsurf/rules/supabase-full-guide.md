---
trigger: always_on
---

SUPABASE GUIDE.
THE SUPABASE BIBLE: THE DEFINITIVE PRODUCTION BEHEMOTH

A Comprehensive Manual for AIs, Vibe Coders, and Senior Developers




🧭 THE MASTER REFERENCE INDEX (AI & DEVELOPER NAVIGATION)

This index is your map. Use it to find the exact "why" and "how" for any Supabase challenge.

Topic
Deep-Dive Chapter
Key Concepts Covered
The Mental Model
CH 1
Postgres-first philosophy, Portability, and the Managed Stack.
Architectural Layers
CH 2
PostgREST, GoTrue, Realtime, Kong, and the Postgres Core.
Production Setup
CH 3-5
Region selection, Secret management, SSR Client initialization.
Auth Deep-Dive
CH 6-9
JWT Lifecycle, PKCE, Auth Hooks, Custom Claims, RBAC.
User Data Sync
CH 10-12
Postgres Triggers, PII compliance, Account merging.
Database Internals
CH 13-16
UUIDs, JSONB indexing, pgvector, Migration CI/CD.
CRUD Mastery
CH 17-21
N+1 prevention, RPC vs. REST, Atomic transactions.
RLS Performance
CH 22-26
initPlan caching, Indexing policies, EXPLAIN ANALYZE.
Edge Functions
CH 32-37
Deno runtime, JWT verification, Stripe webhooks, Idempotency.
Storage & CDN
CH 38-42
S3 architecture, Signed URLs, RLS on objects.
CI/CD & Operations
CH 59-65
The Golden Pipeline, RLS Automation, Disaster Recovery.







SECTION 0: INTRODUCTION — THE WAY OF THE POSTGRES

The Philosophy of the "Behemoth"

This is not a tutorial. This is a manual for building systems that last. Most developers treat Supabase as a "Backend-as-a-Service" (BaaS) similar to Firebase. This is a fundamental mistake. Supabase is a Postgres-as-a-Service with a suite of high-performance wrappers.

To master Supabase, you must master Postgres. Every "Supabase feature" is actually a Postgres primitive or a service that interacts with one. If you understand the underlying SQL, you can debug anything.




SECTION 1: FOUNDATION & ARCHITECTURE

CH1: What is Supabase? (The Mental Model)

1.1 The Postgres-First Philosophy

Supabase's core value proposition is Portability. Unlike Firebase, which locks you into a proprietary NoSQL format, Supabase gives you a standard PostgreSQL database.

•
Why it matters: If Supabase disappeared tomorrow, you could export your data and schema to any Postgres provider (RDS, Neon, etc.) and your application logic would remain 90% intact.

•
The "Managed" Advantage: Supabase handles the "boring" parts: connection pooling (Supavisor), API generation (PostgREST), and Auth (GoTrue).

CH2: Architecture Layers — Under the Hood

To build a production app, you must understand how a request travels through the Supabase stack:

1.
The Gateway (Kong): Every request hits Kong first. It handles rate limiting and routes the request to the correct service.

2.
The API (PostgREST): This is the "magic" layer. It reads your database schema and instantly generates a RESTful API. It doesn't have its own state; it's a thin wrapper that translates HTTP to SQL.

3.
The Auth (GoTrue): A Go-based service that manages user signups, logins, and JWT issuance. It stores user data in a separate auth schema in your database.

4.
The Core (PostgreSQL): Where the data lives and where RLS is enforced.

5.
The Realtime (Phoenix): An Elixir service that listens to the Postgres replication stream (WAL) and broadcasts changes over WebSockets.




SECTION 2: PROJECT SETUP & CONFIGURATION (Production)

CH4: Environment Variables & Secrets (The Security Boundary)

4.1 The Key Hierarchy

1.
SUPABASE_URL: The public endpoint.

2.
SUPABASE_ANON_KEY: Safe for the browser. It identifies the request as "anonymous" or "authenticated" but always enforces RLS.

3.
SUPABASE_SERVICE_ROLE_KEY: The "God Key". It bypasses RLS entirely.

•
NEVER put this in your .env file that gets bundled into the frontend.

•
NEVER log this key in your application logs or Edge Function console.

•
ALWAYS store this in a secure secret manager (GitHub Secrets, Vercel Env, etc.).



4.2 Service Role Key Rotation & Revocation

If your SERVICE_ROLE_KEY is ever exposed:

1.
Rotate Immediately: Go to the Supabase Dashboard -> Settings -> API and click "Rotate Key".

2.
Update Secrets: Immediately update your CI/CD and production environment variables with the new key.

3.
Audit Logs: Check your database audit logs for any unauthorized SERVICE_ROLE activity during the exposure window.




SECTION 3: AUTHENTICATION (Production Deep-Dive)

CH8: Auth Hooks & Custom Claims (The Power User Feature)

8.1 Custom Access Token Hook

This is how you implement Role-Based Access Control (RBAC).

•
The Hook: A Postgres function that runs before a JWT is issued.

•
The Logic: You can query your roles table and inject the user's role directly into the JWT claims.

•
Why? This allows your RLS policies to check auth.jwt() ->> 'role' without doing a slow database join on every request.

8.2 Security Definer vs. Invoker

When writing Auth Hooks, use SECURITY DEFINER. This ensures the function runs with the privileges of the owner (usually postgres), allowing it to read the auth schema which is normally restricted.




SECTION 7: ROW-LEVEL SECURITY (RLS) — THE PRODUCTION HARDENING

CH25: RLS Performance Optimization (The "Behemoth" Secret)

25.1 The initPlan Caching Trick

Postgres can be slow if it has to call auth.uid() or a subquery for every row in a 1-million-row table.

•
The Fix: Wrap your function in a sub-select. This forces Postgres to run the function once (an initPlan) and cache the result for the rest of the query.

SQL


-- SLOW
USING (auth.uid() = user_id)

-- FAST
USING ((SELECT auth.uid()) = user_id)


25.2 Indexing for RLS

Every column used in a USING or WITH CHECK clause MUST be indexed. If you filter by user_id in RLS, and user_id isn't indexed, Postgres will perform a full table scan for every request.




SECTION 9: EDGE FUNCTIONS (Production-only)

CH33: Auth Inside Edge Functions

33.1 Verifying the User Identity

When a client calls an Edge Function, the Authorization header contains the user's JWT.

•
The Secure Pattern: Use supabase.auth.getUser() to verify the JWT against the Supabase Auth server. This ensures the token is valid and hasn't been revoked.

TypeScript


const authHeader = req.headers.get('Authorization')!
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } }
)
const { data: { user }, error } = await supabaseClient.auth.getUser()
if (error || !user) return new Response('Unauthorized', { status: 401 })


•
The "Fast" Pattern (JWT Decoding): For high-frequency calls, you can decode and verify the JWT signature locally using the SUPABASE_JWT_SECRET. This avoids a network call to the Auth server but doesn't check for token revocation.

CH34: Production Idempotency Patterns

34.1 The Deduplication Table

Webhooks (like Stripe) can be sent multiple times. Your system must be Idempotent.

•
Implementation: Create a processed_events table with a unique constraint on event_id.

SQL


CREATE TABLE processed_events (
  event_id TEXT PRIMARY KEY,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);


•
The Logic: Inside your Edge Function, wrap your logic in a transaction that first attempts to insert the event_id. If it fails due to a unique violation, return 200 OK immediately and skip the processing.




SECTION 14: OPERATIONS & CI/CD (The Golden Pipeline)

CH62: The Golden Migration Pipeline

In production, manual schema changes are forbidden. Use a managed staging-to-production pipeline.

1.
Staging Run: Apply migrations to a provider-managed staging environment that mirrors production data volume.

2.
Pre-Migration Checks: Run supabase db lint and check for breaking changes (e.g., dropping a column still in use by the frontend).

3.
Backup: Trigger a manual database backup immediately before applying migrations to production.

4.
Apply & Smoke Test: Apply migrations and immediately run a suite of "Smoke Tests" (e.g., can a user still log in? can they still create a record?).

5.
Rollback Plan: If smoke tests fail, restore from the pre-migration backup.

CH63: RLS Testing Automation

Don't guess if your RLS works. Test it in CI.

•
The Tool: Use pgTAP to write SQL-based tests.

•
The Pattern: Impersonate a user by setting the session role and JWT claims.

SQL


BEGIN;
SELECT plan(1);
-- Impersonate User A
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claim.sub" = 'user-a-uuid';
-- Attempt to read User B's data
SELECT is_empty(
  'SELECT * FROM private_data WHERE user_id = ''user-b-uuid''',
  'User A should not see User B data'
);
SELECT * FROM finish();
ROLLBACK;


•
CI Integration: Run these tests in GitHub Actions on every Pull Request. If a test fails, the PR cannot be merged.




SECTION 15: OBSERVABILITY & MONITORING

CH65: Actionable Production Metrics

Monitor these metrics to ensure your "Behemoth" stays healthy:

1.
DB CPU & RAM: If CPU > 70% consistently, your RLS policies or queries are likely missing indexes.

2.
Connection Pool Saturation: Monitor Supavisor metrics. If you hit the connection limit, your app will hang.

3.
Edge Function Error Rate: Track 4xx and 5xx responses. A spike in 401 might indicate an expired JWT_SECRET or an auth hook failure.

4.
Disk I/O: High disk I/O usually means your database is swapping to disk because it doesn't have enough RAM to hold the "Working Set" (indexes + hot data).




End of the Supabase Bible. This is a living document. Refer to the Official Supabase Docs for the latest updates.


THE SUPABASE BIBLE: A DEFINITIVE CURRICULUM FOR PRODUCTION MASTERY

Volume 1: Foundations, Architecture, and the Authentication Deep-Dive




🧭 THE MASTER REFERENCE INDEX (AI & DEVELOPER NAVIGATION)

This index is your map. Use it to find the exact "why" and "how" for any Supabase challenge.

Topic
Deep-Dive Chapter
Key Concepts Covered
The Mental Model
CH 1
Postgres-first philosophy, Firebase vs. Supabase trade-offs.
Architectural Layers
CH 2
PostgREST, GoTrue, Realtime, Kong, and the Postgres Core.
Production Setup
CH 3-5
Region selection, Secret management, SSR Client initialization.
Auth Deep-Dive
CH 6-9
JWT Lifecycle, PKCE, Auth Hooks, Custom Claims, RBAC.
User Data Sync
CH 10-12
Postgres Triggers, PII compliance, Account merging.
Database Internals
CH 13-16
UUIDs, JSONB indexing, pgvector, Migration CI/CD.
CRUD Mastery
CH 17-21
N+1 prevention, RPC vs. REST, Atomic transactions.
RLS Performance
CH 22-26
initPlan caching, Indexing policies, EXPLAIN ANALYZE.







SECTION 0: INTRODUCTION — THE WAY OF THE POSTGRES

The Philosophy of the "Behemoth"

This is not a tutorial. This is a manual for building systems that last. Most developers treat Supabase as a "Backend-as-a-Service" (BaaS) similar to Firebase. This is a fundamental mistake. Supabase is a Postgres-as-a-Service with a suite of high-performance wrappers.

To master Supabase, you must master Postgres. Every "Supabase feature" is actually a Postgres primitive or a service that interacts with one. If you understand the underlying SQL, you can debug anything.

How to Use This Book

•
For AIs (Windsurf/Claude): Feed this document into your context. Use the chapter numbers to reference specific implementation patterns.

•
For Vibe Coders: Read the "Mental Model" sections. They will give you the intuition to "vibe" out complex architectures without getting lost in the syntax.

•
For Developers: Dive into the "Under the Hood" sections. This is where we discuss performance, security boundaries, and production edge cases.




SECTION 1: FOUNDATION & ARCHITECTURE

CH1: What is Supabase? (The Mental Model)

1.1 The Postgres-First Philosophy

Supabase's core value proposition is Portability. Unlike Firebase, which locks you into a proprietary NoSQL format, Supabase gives you a standard PostgreSQL database.

•
Why it matters: If Supabase disappeared tomorrow, you could export your data and schema to any Postgres provider (RDS, Neon, etc.) and your application logic would remain 90% intact.

•
The "Managed" Advantage: Supabase handles the "boring" parts: connection pooling (Supavisor), API generation (PostgREST), and Auth (GoTrue).

1.2 Supabase vs. Firebase: The Relational Divide

Feature
Firebase
Supabase
Data Model
NoSQL (Documents/Collections)
Relational (Tables/Rows)
Querying
Limited (requires indexing everything)
Powerful (SQL, Joins, Aggregates)
Security
Security Rules (Proprietary)
Row-Level Security (Postgres Standard)
Realtime
Built-in, high-frequency
Built-in, Elixir-powered, scalable




CH2: Architecture Layers — Under the Hood

To build a production app, you must understand how a request travels through the Supabase stack:

1.
The Gateway (Kong): Every request hits Kong first. It handles rate limiting and routes the request to the correct service.

2.
The API (PostgREST): This is the "magic" layer. It reads your database schema and instantly generates a RESTful API. It doesn't have its own state; it's a thin wrapper that translates HTTP to SQL.

3.
The Auth (GoTrue): A Go-based service that manages user signups, logins, and JWT issuance. It stores user data in a separate auth schema in your database.

4.
The Core (PostgreSQL): Where the data lives and where RLS is enforced.

5.
The Realtime (Phoenix): An Elixir service that listens to the Postgres replication stream (WAL) and broadcasts changes over WebSockets.




SECTION 2: PROJECT SETUP & CONFIGURATION (Production)

CH3: Creating a Supabase Project (The Production Focus)

3.1 Region Selection & Latency

In production, Latency is King. Choose a region closest to your primary user base. If you have a global audience, consider using Read Replicas (available on Pro/Enterprise) to bring data closer to the edge.

•
Pro Tip: Use the ping command to test latency from your local machine to different Supabase regions before committing.

3.2 Billing & Resource Allocation

•
Free Tier: Great for dev, but has a "pause" policy after 7 days of inactivity.

•
Pro Tier: Essential for production. Includes daily backups, no pausing, and higher rate limits.

•
Compute Add-ons: If your DB CPU is consistently > 50%, upgrade your compute size. Postgres performance degrades sharply when CPU-bound.

CH4: Environment Variables & Secrets (The Security Boundary)

4.1 The Key Hierarchy

1.
SUPABASE_URL: The public endpoint.

2.
SUPABASE_ANON_KEY: Safe for the browser. It identifies the request as "anonymous" or "authenticated" but always enforces RLS.

3.
SUPABASE_SERVICE_ROLE_KEY: The "God Key". It bypasses RLS entirely.

•
NEVER put this in your .env file that gets bundled into the frontend.

•
ALWAYS store this in a secure secret manager (GitHub Secrets, Vercel Env, etc.).



4.2 Key Rotation

If your SERVICE_ROLE_KEY is ever exposed, you must rotate it immediately in the Supabase Dashboard. This will invalidate all existing sessions and keys, so have a plan for a brief maintenance window.

CH5: Initializing Supabase Clients Securely

5.1 The SSR Pattern (Next.js/SvelteKit)

In modern frameworks, you need two clients:

•
Browser Client: For client-side interactions (e.g., clicking a "Like" button).

•
Server Client: For fetching data during SSR or in API routes.

•
The Cookie Problem: To maintain auth state across the server and client, you must use the @supabase/ssr package to sync the JWT via cookies.




SECTION 3: AUTHENTICATION (Production Deep-Dive)

CH6: Auth Architecture & JWT Lifecycle

6.1 What is a JWT in Supabase?

A JSON Web Token (JWT) is a signed piece of data. In Supabase, it contains:

•
sub: The User's UUID.

•
role: Usually authenticated.

•
email: The user's email address.

•
exp: Expiration timestamp (default 1 hour).

6.2 The Refresh Token Flow

When the JWT expires, the client uses a Refresh Token to get a new one. This happens automatically in the supabase-js library.

•
Security Note: Refresh tokens are single-use. If a refresh token is reused, Supabase Auth detects it as a potential theft and invalidates the entire session.

CH7: Email, Social Auth, and PKCE

7.1 The PKCE Flow (Proof Key for Code Exchange)

For production apps, always use PKCE. It prevents "Authorization Code Interception" attacks.

•
How it works: The client generates a secret "verifier" and sends a "challenge" to the provider. Upon redirect, the client sends the verifier to prove it's the same entity that started the flow.

7.2 Social Auth & Account Linking

Supabase supports linking multiple identities (Google, GitHub, etc.) to a single user ID.

•
Implementation: Use supabase.auth.linkIdentity() to add a new provider to an existing account.

CH8: Auth Hooks & Custom Claims (The Power User Feature)

8.1 Custom Access Token Hook

This is how you implement Role-Based Access Control (RBAC).

•
The Hook: A Postgres function that runs before a JWT is issued.

•
The Logic: You can query your roles table and inject the user's role directly into the JWT claims.

•
Why? This allows your RLS policies to check auth.jwt() ->> 'role' without doing a slow database join on every request.

8.2 Security Definer vs. Invoker

When writing Auth Hooks, use SECURITY DEFINER. This ensures the function runs with the privileges of the owner (usually postgres), allowing it to read the auth schema which is normally restricted.




(End of Part 1. Part 2 will cover Database Internals, RLS Performance, and Realtime scaling.)

THE SUPABASE BIBLE: A DEFINITIVE CURRICULUM FOR PRODUCTION MASTERY

Volume 2: Database Internals, RLS Performance, and Realtime Scaling




SECTION 5: DATABASE FUNDAMENTALS (Production Deep-Dive)

CH13: Schema Design for Production

13.1 UUIDs vs. Serials

In production, UUIDs are the standard.

•
Enumeration Attacks: Using serial IDs (1, 2, 3...) allows attackers to guess the total number of records and scrape data by incrementing IDs in the URL.

•
Distributed Systems: UUIDs can be generated on the client or edge without a central authority, preventing collisions during bulk inserts.

•
Postgres Implementation: Use gen_random_uuid() as the default value for your id columns.

13.2 Normalization vs. Denormalization

•
Normalize for Integrity: Keep your data clean. Use foreign keys and constraints.

•
Denormalize for Performance: In high-read scenarios (like a social feed), denormalizing "count" fields (e.g., likes_count) into the main table can save expensive joins. Use Postgres Triggers to keep these counts in sync.

CH14: Advanced Data Types: JSONB, Full-Text Search, and Vectors

14.1 The Power of JSONB

JSONB is "Binary JSON". It's faster to process than plain JSON and supports indexing.

•
When to use: For flexible metadata, user preferences, or third-party API responses.

•
Indexing: Use a GIN (Generalized Inverted Index) to make queries inside JSONB fields lightning fast.

SQL


CREATE INDEX idx_metadata ON my_table USING GIN (metadata);




14.2 Full-Text Search (FTS)

Don't reach for Elasticsearch immediately. Postgres has built-in FTS.

•
tsvector and tsquery: These are the primitives for high-performance text search.

•
Implementation: Create a generated column that combines your searchable text into a tsvector and index it.

14.3 pgvector for AI Applications

Supabase is a leader in the "AI Database" space via pgvector.

•
Embeddings: Store your vector embeddings in a vector column.

•
Similarity Search: Use the <-> (L2 distance) or <#> (inner product) operators to find related content.

CH15: Extensions & Approved Usage

Extensions are the "plugins" of Postgres.

•
pg_stat_statements: Essential for production. It tracks every query run on your DB, helping you find slow ones.

•
pg_trgm: For fuzzy string matching (e.g., "did you mean...?").

•
citext: Case-insensitive text type. Perfect for email columns.




SECTION 7: ROW-LEVEL SECURITY (RLS) — THE PRODUCTION HARDENING

CH22: RLS Fundamentals & The "Deny-by-Default" Mindset

RLS is the most critical security layer in Supabase. If you get this wrong, your data is public.

•
The Mechanism: RLS acts as a "WHERE" clause that is automatically appended to every query by the database engine.

•
The Trap: If you enable RLS but don't add a policy, all access is denied. This is the safest starting point.

CH23: Common RLS Patterns for Production

23.1 The "Owner" Pattern

SQL


CREATE POLICY "Users can only see their own data"
ON my_table
FOR SELECT
USING (auth.uid() = user_id);


23.2 The "Tenant" Pattern (Multi-tenancy)

In a SaaS app, you often have "Organizations".

SQL


CREATE POLICY "Org members can see org data"
ON my_table
FOR SELECT
USING (
  organization_id IN (
    SELECT org_id FROM memberships WHERE user_id = auth.uid()
  )
);


WARNING: This subquery runs for every row. See CH25 for how to optimize this.

CH25: RLS Performance Optimization (The "Behemoth" Secret)

25.1 The initPlan Caching Trick

Postgres can be slow if it has to call auth.uid() or a subquery for every row in a 1-million-row table.

•
The Fix: Wrap your function in a sub-select. This forces Postgres to run the function once (an initPlan) and cache the result for the rest of the query.

SQL


-- SLOW
USING (auth.uid() = user_id)

-- FAST
USING ((SELECT auth.uid()) = user_id)


25.2 Indexing for RLS

Every column used in a USING or WITH CHECK clause MUST be indexed. If you filter by user_id in RLS, and user_id isn't indexed, Postgres will perform a full table scan for every request.

CH26: RLS Pitfalls & Hardening

•
SECURITY DEFINER Functions: These bypass RLS. Use them sparingly and only for internal logic.

•
Testing RLS: Use the set local role authenticated; command in the SQL editor to simulate a user and test your policies manually.




SECTION 8: REAL-TIME (Production Scaling)

CH27: Realtime Concepts & Trade-offs

27.1 Broadcast vs. Presence vs. DB Changes

•
Broadcast: Low latency, ephemeral. Use for "User is typing..." or game state.

•
Presence: Tracks who is online. Uses a "heartbeat" mechanism.

•
Postgres Changes: Listens to the WAL (Write-Ahead Log). Use for syncing UI state with the database.

CH30: Scaling & Idempotency

30.1 The "Message Order" Problem

WebSockets don't guarantee order. If you send "Update 1" and "Update 2", they might arrive as "2, 1".

•
The Fix: Include a version or updated_at timestamp in your payload. The client should ignore any message with a timestamp older than the current state.

30.2 Realtime Quotas

On the Free tier, you are limited to 200 concurrent connections. In production, monitor your Peak Connections in the Supabase Dashboard. If you hit the limit, new users will fail to connect.




(End of Part 2. Part 3 will cover Edge Functions, Storage, and Production Operations.)

THE SUPABASE BIBLE: A DEFINITIVE CURRICULUM FOR PRODUCTION MASTERY

Volume 3: Edge Functions, Storage, and Operations




SECTION 9: EDGE FUNCTIONS (Production-only)

CH32: Edge Functions Fundamentals

32.1 The Deno Runtime

Supabase Edge Functions run on Deno, not Node.js.

•
Why Deno? It's secure by default (no file/network access unless granted), has built-in TypeScript support, and uses Web Standards (Fetch API).

•
The "Edge" Advantage: Functions run in regions close to your users, reducing the "Cold Start" time compared to traditional AWS Lambda.

CH33: Auth Inside Edge Functions

33.1 Verifying the User

When a client calls an Edge Function, the Authorization header contains the user's JWT.

•
The Pattern: Use the Supabase client inside the function to verify the JWT.

TypeScript


const authHeader = req.headers.get('Authorization')!
const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? '',
  { global: { headers: { Authorization: authHeader } } }
)
const { data: { user } } = await supabaseClient.auth.getUser()


•
Security: If getUser() fails, return a 401 Unauthorized immediately.

CH34: Common Production Patterns

34.1 Stripe Webhooks

Stripe sends events (e.g., checkout.session.completed) to your Edge Function.

•
Signature Verification: CRITICAL. You must verify the stripe-signature header using your Stripe Webhook Secret to ensure the request actually came from Stripe.

•
No-Verify-JWT: Use the --no-verify-jwt flag when deploying webhook functions, as Stripe won't have a Supabase JWT.

34.2 Background Tasks & waitUntil

Deno allows you to respond to the user immediately and continue work in the background using EdgeRuntime.waitUntil().

•
Use Case: Sending a confirmation email after a successful purchase without making the user wait for the email API to respond.




SECTION 10: STORAGE (Production Deep-Dive)

CH38: Storage Concepts & CDN

38.1 The Storage Architecture

Supabase Storage is a wrapper around S3.

•
Metadata: File names, sizes, and owners are stored in the storage.objects table in your Postgres DB.

•
CDN: All public files are automatically cached by the Supabase CDN (Cloudflare), ensuring fast global delivery.

CH40: Access Patterns & Signed URLs

40.1 Private vs. Public Buckets

•
Public: Anyone with the URL can view. Use for avatars, public assets.

•
Private: Requires a Signed URL. Use for invoices, private documents, or user-specific data.

•
Signed URLs: These are temporary URLs with a cryptographic signature and an expiration time (e.g., 60 seconds).

CH42: Storage Security (RLS on Objects)

You don't write "Storage Rules". You write Postgres RLS Policies on the storage.objects table.

•
Example: Allow users to only delete their own files.

SQL


CREATE POLICY "Users can delete their own files"
ON storage.objects
FOR DELETE
USING (auth.uid() = owner_id);





SECTION 12: ERROR HANDLING, OBSERVABILITY & TESTING

CH48: Error Taxonomy & Mapping

In production, you must map database errors to HTTP status codes.

•
23505 (Unique Violation): Map to 409 Conflict.

•
42P01 (Undefined Table): Map to 500 Internal Server Error (this is a dev error).

•
RLS Denials: Usually return an empty array [] for SELECTs, which can be confusing. Check for 403 on INSERT/UPDATE.

CH50: Observability & Logging

50.1 The Log Explorer

Supabase provides a powerful SQL-like interface for your logs.

•
Querying Edge Logs: Find which functions are failing and why.

•
Slow Query Logs: Identify queries that take > 100ms and need indexing.

50.2 External Integrations

For production, integrate with Sentry or Logflare to get real-time alerts when your backend crashes.




SECTION 14: OPERATIONS, SCALING & COST

CH59: Backups & Disaster Recovery

•
Daily Backups: Included in Pro. They are "logical" backups (pg_dump).

•
PITR (Point-in-Time Recovery): Essential for mission-critical apps. It allows you to restore your DB to any specific second in the last 7 days.

CH61: Cost Optimization

•
Egress: The most common "surprise" cost. Monitor your bandwidth usage, especially if serving large images.

•
Storage Lifecycle: Use Edge Functions to delete old, unused files from Storage to save on costs.




APPENDICES

Appendix A: CI/CD Patterns

The "Golden Pipeline"

1.
Local Dev: Use Supabase CLI (supabase start).

2.
Pull Request: Run RLS tests and Edge Function unit tests in GitHub Actions.

3.
Merge to Main:

•
supabase db push (Apply migrations to Production).

•
supabase functions deploy (Deploy Edge Functions).



Appendix B: Glossary of the Behemoth

•
WAL: Write-Ahead Log. The heartbeat of Postgres.

•
PostgREST: The engine that turns your schema into an API.

•
GoTrue: The auth server.

•
Supavisor: The connection pooler that lets you handle 10,000+ connections.




End of the Supabase Bible. Go forth and build systems that do not break.

