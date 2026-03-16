---
trigger: always_on
---

# decisions/DECISION_LOG.md
## Permanent Record of All Significant Decisions

**Purpose:** Create unchangeable history of why we made each choice  
**Audience:** Future developers, future you, AI learning system  
**Rule:** Every significant action has a decision log entry. No exceptions.

---

## HOW THIS WORKS

1. When a significant decision is made, create an entry below
2. Never delete or modify entries (append only)
3. Reference the decision ID in code comments
4. When you need to reverse a decision, create a new entry explaining why
5. This becomes your institutional memory

---

## ENTRY TEMPLATE

```
---

## DECISION ID: YYYY-MM-DD-HHmm-[task-identifier]

**Date:** YYYY-MM-DD HH:mm UTC  
**Status:** APPROVED / REJECTED / PENDING / SUPERSEDED  
**Supersedes:** [Previous decision ID, if replacing]

### Context
[What was the situation? What problem were we solving?]

### Problem Statement
[What decision did we need to make?]

### Options Considered
1. **Option A: [Option name]**
   - Pros: [Benefits]
   - Cons: [Drawbacks]
   - Effort: [Time/complexity estimate]
   - Risk: [What could go wrong?]
   - Precedent: [Have we done this before? How?]

2. **Option B: [Option name]**
   - Pros: [Benefits]
   - Cons: [Drawbacks]
   - Effort: [Time/complexity estimate]
   - Risk: [What could go wrong?]
   - Precedent: [Have we done this before? How?]

3. **Option C: [Option name]**
   - [Same structure]

### Decision: [Which option did we choose?]

### Rationale
[Why did we choose this option? What convinced us?]

### Trade-offs Accepted
- [Trade-off 1]: [What we're giving up] for [what we're gaining]
- [Trade-off 2]: [What we're giving up] for [what we're gaining]

### Downstream Implications
**What changes because of this decision?**
- Component/file affected: [filename] - Impact: [read/write/modify/delete/depends-on]
- Component/file affected: [filename] - Impact: [read/write/modify/delete/depends-on]

**What becomes harder?**
- [Harder thing 1 because of this decision]
- [Harder thing 2 because of this decision]

**What becomes easier?**
- [Easier thing 1 because of this decision]
- [Easier thing 2 because of this decision]

### Reversibility
- Can this be undone? YES / NO / WITH EFFORT
- If needed, what's the undo path?

### Related Decisions
- [Linked decision 1] - [Why related]
- [Linked decision 2] - [Why related]

### References
- [Link to code/PR that implements this]
- [Link to test that validates this]
- [Link to documentation that explains this]

### Approval
- Approved by: [Person/team]
- Date approved: YYYY-MM-DD
- Approval method: [Code review / Technical meeting / Decision consensus]

### Comments/Notes
[Anything else to remember about this decision?]

```

---

## EXAMPLE: Decision to Use ILIKE for Case-Insensitive Search

```
---

## DECISION ID: 2025-01-08-1015-post-search-case-insensitive

**Date:** 2025-01-08 10:15 UTC  
**Status:** APPROVED  
**Supersedes:** None

### Context
Building post search feature. Need to decide how to handle case sensitivity.
User types "hello" should find posts with "Hello", "HELLO", etc.

### Problem Statement
Should post search be case-sensitive or case-insensitive?

### Options Considered

1. **Option A: Case-sensitive LIKE**
   - Pros: Simple, fast, standard SQL
   - Cons: User types "hello", doesn't find "Hello" (confusing)
   - Effort: 10 minutes
   - Risk: User frustration (feature seems broken)
   - Precedent: Legacy system used this, users complained

2. **Option B: Case-insensitive ILIKE (PostgreSQL-specific)**
   - Pros: User-friendly (finds "hello", "Hello", "HELLO")
   - Cons: PostgreSQL-specific (less portable), slightly slower
   - Effort: 10 minutes
   - Risk: Ties us to PostgreSQL (acceptable, we're using PostgreSQL anyway)
   - Precedent: Modern search engines do this

3. **Option C: Lowercase everything before searching**
   - Pros: Database-agnostic, any database supports LOWER()
   - Cons: Extra processing, stored column modification
   - Effort: 30 minutes
   - Risk: More complex, harder to maintain
   - Precedent: Some systems do this, but more overhead

### Decision: Option B - Use PostgreSQL ILIKE for case-insensitive search

### Rationale
Case-insensitive search is what users expect from modern search. ILIKE is PostgreSQL's built-in solution. We're already using PostgreSQL, so no additional dependency. Simple, fast, user-friendly.

### Trade-offs Accepted
- Tie to PostgreSQL: Can't easily migrate to other database, but PostgreSQL is our chosen database, so acceptable
- Slight performance cost: ILIKE slower than LIKE, but negligible for our query volume

### Downstream Implications
**What changes because of this decision:**
- src/services/postService.ts - Uses ILIKE instead of LIKE
- tests/postService.test.ts - Tests case-insensitive search
- Documentation/SEARCH.md - Documents case-insensitive behavior

**What becomes harder:**
- Migrating to non-PostgreSQL database (would need to refactor search)

**What becomes easier:**
- User experience (search works as expected)
- Implementation (built-in PostgreSQL feature, no custom logic)

### Reversibility
- Can this be undone? YES WITH EFFORT
- Undo path: Replace ILIKE with LOWER() + LIKE approach (30 min refactor)

### Related Decisions
- Decision 2025-01-08-1000-post-search-feature: Decided to build search feature
- Decision 2025-01-07-1430-database-choice: Chose PostgreSQL as database

### References
- PR: #123 (Post search feature implementation)
- Test: tests/postService.test.ts (search test cases)
- PostgreSQL docs: https://www.postgresql.org/docs/current/functions-matching.html

### Approval
- Approved by: Engineering team
- Date approved: 2025-01-08
- Approval method: Code review (PR #123)

### Comments/Notes
ILIKE is the right choice for user-friendly search. No complaints expected.
Document the case-insensitive behavior in API docs.

```

---

## EXAMPLE: Reversing a Decision

```
---

## DECISION ID: 2025-01-10-1430-search-performance-optimization

**Date:** 2025-01-10 14:30 UTC  
**Status:** APPROVED  
**Supersedes:** 2025-01-08-1015-post-search-case-insensitive

### Context
User testing revealed search takes 2 seconds for 10k+ posts. Unacceptable.
Performance budget is < 500ms.
ILIKE without index is slow.

### Problem Statement
Previous decision to use ILIKE is causing performance issues. We need case-insensitive search that's fast.

### Options Considered

1. **Option A: Keep ILIKE, add index (GIN index with trigram)**
   - Pros: Keep ILIKE functionality, adds index for speed
   - Cons: PostgreSQL-specific, trigram index uses disk space
   - Effort: 1 hour
   - Risk: Low, proven technique
   - Precedent: Standard PostgreSQL optimization

2. **Option B: Switch to LOWER() + LIKE + index (database-agnostic)**
   - Pros: Any database can do this, faster than trigram
   - Cons: Requires denormalization (store LOWER(title))
   - Effort: 4 hours
   - Risk: More complex, maintenance overhead
   - Precedent: Legacy system used this successfully

3. **Option C: Full-text search (PostgreSQL tsvector)**
   - Pros: Best performance and features for search
   - Cons: Complex to set up, learning curve
   - Effort: 8 hours
   - Risk: Overkill for current volume?
   - Precedent: Used in some legacy systems

### Decision: Option A - Keep ILIKE, add trigram index

### Rationale
ILIKE with trigram index is sweet spot:
- Keeps case-insensitive search we decided on
- Adds performance (< 200ms on 10k posts in benchmarks)
- Minimal complexity (one index, no code changes)
- PostgreSQL-standard technique

### Trade-offs Accepted
- Index space: GIN index uses ~100MB disk (acceptable)
- PostgreSQL lock on index creation: ~30s (acceptable during maintenance window)
- Still tied to PostgreSQL: Already accepted in previous decision

### Downstream Implications
**What changes:**
- Database schema: Add GIN index on posts(title, content)
- No code changes needed
- Deployment: Run migration to create index

**What becomes easier:**
- Search performance (now meets budget)

**What becomes harder:**
- Nothing, just adds maintenance of index

### Reversibility
- Can this be undone? YES WITH EASE
- Undo path: Drop the index (< 1 minute)

### Related Decisions
- Decision 2025-01-08-1015-post-search-case-insensitive: Previous decision on case-insensitive search
- This decision keeps that decision, just adds index for performance

### References
- PR: #145 (Performance optimization)
- Benchmarks: tests/performance/search.perf.ts (< 200ms verified)
- Migration: migrations/01_add_search_index.sql

### Approval
- Approved by: Performance review team
- Date approved: 2025-01-10
- Approval method: Performance test results + technical review

### Comments/Notes
Perfect example of "make it work, then make it fast".
ILIKE worked correctly but was slow. Index fixes it without changing behavior.

```

---

## ALL DECISIONS (Chronological)

[Entries will be added below as decisions are made. Keep most recent at top for quick reference.]

---

## HOW TO FIND DECISIONS

**By ID:** Search for `DECISION ID: YYYY-MM-DD`  
**By Topic:** Search for relevant keywords (e.g., "search", "performance", "RLS")  
**By Status:** Search for `Status: APPROVED` or `SUPERSEDED`  
**Timeline:** Read from bottom-to-top for chronological history

---

## USING DECISIONS IN CODE

**In code comments, reference the decision:**

```typescript
// See DECISION ID: 2025-01-08-1015-post-search-case-insensitive
// We use ILIKE for case-insensitive search instead of LIKE
const query = supabase
  .from('posts')
  .select('*')
  .ilike('title', `%${searchTerm}%`)
```

**In code reviews, reference the decision:**

```
"This uses ILIKE instead of LIKE per DECISION ID: 2025-01-08-1015-post-search-case-insensitive"
```

**When changing approach, create new decision:**

```
"This supersedes DECISION ID: 2025-01-08-1015-post-search-case-insensitive
because performance testing revealed ILIKE was too slow."
```

---

## WHY THIS MATTERS

This log becomes:
1. **Reference:** "Why did we do it this way?" → Check the decision
2. **Teaching:** "How did they solve this before?" → Check the decision
3. **Audit trail:** "Who approved this?" → Check the decision
4. **Reversibility:** "Can we undo this?" → Check the decision
5. **Context:** "What was the situation?" → Check the decision

**In 6 months, you won't remember why you chose ILIKE. This log remembers.**

---

**Every significant decision gets logged. No action without a logged decision.**