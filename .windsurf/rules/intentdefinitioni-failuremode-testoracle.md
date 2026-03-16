---
trigger: manual
---

# INTENT_DEFINITION.md
## Task Scope Definition (Mandatory Before Execution)

**Authority:** MANDATORY - No task may proceed without this section completed  
**Audience:** SWE-1.5 and developers  
**Purpose:** Force clarity on what is being asked before any work begins

---

## RULE: NO TASK WITHOUT INTENT DEFINITION

Every task must have a fully defined intent section BEFORE Phase 1 is declared complete.

---

# TEMPLATE: Task Intent Definition

When given a task, you MUST complete this template. All sections required.

## [TASK ID] - [Task Name]

### Problem Statement
**What problem are we solving? In one sentence.**

Example: "Users can't search for posts by keyword."

**Why this matters:** [One sentence explaining impact]

### Non-Goals (What We're NOT Doing)
- [ ] Non-goal 1 - why we're not doing it
- [ ] Non-goal 2 - why we're not doing it
- [ ] Non-goal 3 - why we're not doing it

**Example non-goals:**
- [ ] We are NOT building full-text search (too complex now)
- [ ] We are NOT caching search results (not needed yet)
- [ ] We are NOT supporting advanced filters (MVP phase)

### Success Criteria (Observable, Measurable)
1. **Criterion 1:** [Measurable outcome] - How to verify: [Method]
   - Example: "Users can search posts by title" - Verify: User types keyword, sees matching posts
   
2. **Criterion 2:** [Measurable outcome] - How to verify: [Method]

3. **Criterion 3:** [Measurable outcome] - How to verify: [Method]

**Rule:** Every criterion must be testable. No vague criteria like "it works".

### Impacted Components
List every file, module, or system that will be touched:

- **Component 1:** [Filename] - Impact: READ / WRITE / MODIFY / DELETE
- **Component 2:** [Filename] - Impact: READ / WRITE / MODIFY / DELETE
- **Component 3:** [Database table] - Impact: READ / WRITE / MODIFY / DELETE
- **Component 4:** [API endpoint] - Impact: NEW / MODIFY / DELETE

### Dependencies & Prerequisites
What must exist or be true for this to work?

- [ ] Prerequisite 1 - Status: DONE / IN PROGRESS / BLOCKED
- [ ] Prerequisite 2 - Status: DONE / IN PROGRESS / BLOCKED
- [ ] Prerequisite 3 - Status: DONE / IN PROGRESS / BLOCKED

**Rule:** If any prerequisite is BLOCKED, task cannot start until resolved.

### Constraints Specific to This Task
- Constraint 1: [What's constrained and why?]
- Constraint 2: [What's constrained and why?]
- Constraint 3: [What's constrained and why?]

Example:
- "Search must work with existing RLS (can't bypass permissions)"
- "Must be added to existing post table (no schema changes)"
- "Performance must be < 500ms (Supabase query limit)"

---

## TEMPLATE EXAMPLE: Adding Post Search

```
[TASK ID: 2025-01-08-posts-search]

PROBLEM STATEMENT:
Users cannot find posts by keyword, limiting discoverability.

WHY IT MATTERS:
Users give up searching, abandoning the feed feature.

NON-GOALS:
- [ ] We are NOT building full-text search (requires PostgreSQL extensions)
- [ ] We are NOT supporting advanced filters (MVP phase, add later)
- [ ] We are NOT caching results (volume too low, query fast enough)

SUCCESS CRITERIA:
1. User can type keyword in search box → Sees matching posts (by title/content)
   How to verify: Search for "hello" → See all posts with "hello" in title or content
   
2. Search respects RLS policies (user only sees posts they can view)
   How to verify: User A searches, sees only their visible posts, not private posts
   
3. Search returns results in < 500ms
   How to verify: Time database query, confirm < 500ms

IMPACTED COMPONENTS:
- src/components/SearchBox.tsx - WRITE (new component)
- src/hooks/usePostSearch.ts - WRITE (new hook)
- src/services/postService.ts - MODIFY (add search function)
- database: posts table - READ (no schema changes)
- Supabase API: /posts endpoint - MODIFY (add LIKE filter)

DEPENDENCIES:
- [ ] Posts table exists and has data - Status: DONE
- [ ] User authentication working - Status: DONE
- [ ] Post display component working - Status: DONE
- [ ] RLS policies on posts table - Status: DONE

CONSTRAINTS:
- Search must respect RLS (can't use service key, use anon key with RLS)
- Only search title and content (not user profile)
- Must work with existing pagination
- No schema changes to posts table
```

---

# FAILURE_MODES.md
## Adversarial Reasoning & Failure Discovery

**Authority:** MANDATORY - Failures that aren't identified = CRITICAL risk  
**Purpose:** Force SWE-1.5 to think like an attacker, find problems before shipping

---

## RULE: Assume Everything Can Fail

Every piece of code can break. Your job is to find HOW before users find out.

---

## FAILURE MODE CATEGORIES

### 1. Logical Errors
**What:** Code logic is wrong. Operation produces incorrect result.

**Examples:**
- Search returns posts in wrong order
- Filter excludes results that should match
- Pagination skips records

**How to detect:**
- Unit test the logic
- Check boundary cases (empty, one, many)
- Verify output matches expectation

**Risk level:** HIGH (user sees wrong data)

### 2. Integration Failures
**What:** This component breaks when integrated with another component.

**Examples:**
- Search works alone, breaks when integrated with pagination
- New endpoint breaks existing RLS policy
- Database change breaks old queries

**How to detect:**
- Test across components
- Test with real data
- Test with existing systems

**Risk level:** HIGH (system breaks)

### 3. State Corruption
**What:** State becomes inconsistent. System can't recover.

**Examples:**
- User logged in during search → gets logged out → search results invalid
- Database transaction fails mid-way → half-updated record
- Race condition (two simultaneous updates corrupt data)

**How to detect:**
- Test concurrency
- Test with state changes during operation
- Verify atomic operations

**Risk level:** CRITICAL (data loss)

### 4. Silent Failures
**What:** Operation fails, but code doesn't report it. User thinks it succeeded.

**Examples:**
- Search query fails → returns empty array (looks like no results)
- Database insert fails → code doesn't throw → record not saved
- API timeout → code doesn't retry → user thinks it worked

**How to detect:**
- Add logging to every operation
- Check error handling paths
- Test network failures

**Risk level:** CRITICAL (user loses data thinking it was saved)

### 5. Permission Failures
**What:** RLS policy blocks operation unexpectedly. User can't do what they should be able to do.

**Examples:**
- User can't search their own posts (RLS too restrictive)
- User can see posts they shouldn't (RLS too permissive)

**How to detect:**
- Test as different users
- Test different RLS policies
- Verify policy output

**Risk level:** CRITICAL (security or broken feature)

### 6. Performance Failures
**What:** Operation is too slow. Violates performance contract.

**Examples:**
- Search takes 5 seconds (> 500ms limit)
- Full table scan instead of indexed search

**How to detect:**
- Benchmark query
- Check execution plan
- Load test with real data size

**Risk level:** MEDIUM (user experience suffers)

---

## TEMPLATE: Failure Mode Analysis

For every feature, identify:

### Failure Mode 1: [What fails?]
**Entry point:** [Where can this happen?]  
**Root cause:** [Why does it fail?]  
**Observable symptoms:** [What does user see?]  
**Impact:**
- User facing: [What does user experience?]
- System facing: [Does it break other components?]
- Data facing: [Is data corrupted?]

**Severity:** CRITICAL / HIGH / MEDIUM / LOW

**Detection strategy:**
- [ ] Test [specific test to detect this]
- [ ] Log [what to log]
- [ ] Monitor [what to monitor]

**Recovery path:**
- [ ] Prevention: [How to prevent this from happening]
- [ ] Mitigation: [How to recover if it happens]

**Code changes needed:** YES / NO

---

## EXAMPLE: Search Failure Mode Analysis

### Failure Mode 1: Search Query Returns Empty When It Shouldn't
**Entry point:** User types keyword that matches posts, but gets 0 results  
**Root cause:** Query filters by column that doesn't exist, or uses wrong LIKE syntax  
**Observable symptoms:** User sees "No results" for keywords that definitely exist  
**Impact:**
- User: Can't find posts they created (broken feature)
- System: Pagination logic breaks (offset logic confused)
- Data: None (query only reads, doesn't corrupt)

**Severity:** HIGH

**Detection strategy:**
- [ ] Unit test: Search for known keyword, verify results
- [ ] Log: Query execution for debugging
- [ ] Monitor: Empty result % (if 0%, maybe OK; if 100%, definitely bug)

**Recovery path:**
- [ ] Prevention: Check column name, test LIKE syntax, test with real data
- [ ] Mitigation: Show error message instead of empty results (not silent failure)

**Code changes needed:** YES - test query before shipping

---

### Failure Mode 2: RLS Policy Blocks User's Own Posts
**Entry point:** User searches, doesn't see their own posts in results  
**Root cause:** RLS policy doesn't match search query, or SELECT policy too restrictive  
**Observable symptoms:** User can see own posts in list, but not in search  
**Impact:**
- User: Thinks posts are gone (scary!)
- System: Search component broken
- Data: Posts still exist, just not accessible

**Severity:** CRITICAL

**Detection strategy:**
- [ ] Test as different users
- [ ] Test RLS policy explicitly
- [ ] Compare: List view vs search view (should show same posts)

**Recovery path:**
- [ ] Prevention: Write RLS policy for search, test thoroughly
- [ ] Mitigation: Show error if user has no results but posts exist

**Code changes needed:** YES - fix RLS policy

---

### Failure Mode 3: Search Takes 5 Seconds (Violates Performance Contract)
**Entry point:** User types keyword, waits 5+ seconds for results  
**Root cause:** Query does full table scan (no index), or LIKE on large column inefficient  
**Observable symptoms:** Loading spinner spins for 5+ seconds, then results appear  
**Impact:**
- User: Terrible experience, thinks app is broken
- System: High database load, other queries slow down
- Data: None

**Severity:** MEDIUM

**Detection strategy:**
- [ ] Benchmark query with real data
- [ ] Check query execution plan (sequential scan vs index scan?)
- [ ] Monitor database CPU usage

**Recovery path:**
- [ ] Prevention: Add index on searchable columns (title, content)
- [ ] Mitigation: Add timeout (5s timeout → show error, try limiting results)

**Code changes needed:** YES - add database index

---

# TEST_ORACLE.md
## Objective Truth: What Correctness Means

**Authority:** ABSOLUTE - This defines what "working" means, independent of AI judgment  
**Purpose:** Provide objective measure of correctness. Remove ambiguity.

---

## RULE: If It Can't Be Tested, Question It

Every requirement must be testable. If something is untestable, either:
1. Make it testable, or
2. Remove it, or
3. Mark it as CRITICAL RISK

---

## WHAT IS CORRECTNESS?

Correctness means:
1. **Functional correctness:** Feature does what it claims to do
2. **State consistency:** System stays in valid state
3. **Performance:** Meets time/resource requirements
4. **Security:** Respects permissions and invariants
5. **Reliability:** Doesn't fail silently, recovers from failure

---

## TEST ORACLE TEMPLATE

### Feature: [Feature Name]

#### Functional Correctness Tests

**Test 1: [What are we testing?]**
- Setup: [What must be true before test?]
- Action: [What do we do?]
- Expected: [What should happen?]
- Pass condition: [How do we know it passed?]
- Fail condition: [How do we know it failed?]

**Test 2: [What are we testing?]**
- [Same structure]

---

## EXAMPLE: Post Search Feature - Test Oracle

### Feature: Post Search

#### Functional Correctness Tests

**Test 1: Search finds posts by exact title match**
- Setup: Database has posts with titles "Hello World", "Goodbye World"
- Action: User searches for "Hello World"
- Expected: Post "Hello World" appears in results
- Pass condition: Result list contains post with matching title
- Fail condition: Result list empty or wrong post

**Test 2: Search finds posts by partial match (LIKE)**
- Setup: Database has post with title "Hello World"
- Action: User searches for "Hello"
- Expected: Post "Hello World" appears in results
- Pass condition: Result includes post with "Hello" in title
- Fail condition: No results or non-matching posts

**Test 3: Search is case-insensitive**
- Setup: Database has post with title "Hello WORLD"
- Action: User searches for "hello world" (lowercase)
- Expected: Post still found
- Pass condition: Result includes the post
- Fail condition: Case-sensitive search fails

**Test 4: Search returns empty results properly (not silent failure)**
- Setup: Database has posts, none matching keyword
- Action: User searches for "nonexistent keyword"
- Expected: User sees "No results" message (not error, not crash)
- Pass condition: User sees helpful empty state
- Fail condition: No message shown, app appears broken

**Test 5: Search respects RLS (user sees only their visible posts)**
- Setup: User A has post, User B tries to search
- Action: User B searches for User A's post (by title)
- Expected: User B doesn't see User A's post (RLS blocks it)
- Pass condition: Result empty
- Fail condition: Result shows User A's private post

#### Performance Tests

**Test 6: Search returns results in < 500ms**
- Setup: Database has 10,000+ posts
- Action: Search for keyword
- Expected: Results in < 500ms
- Pass condition: Query duration < 500ms
- Fail condition: Query duration > 500ms

#### State Consistency Tests

**Test 7: Search results consistent with list view**
- Setup: User searches for keyword, records which posts appear
- Action: User goes to full list view, filters for same criteria manually
- Expected: Same posts appear in both views
- Pass condition: Identical result sets
- Fail condition: Different results (search broken vs list view)

#### Reliability Tests

**Test 8: Network failure is handled (no silent failure)**
- Setup: User searching, network fails mid-query
- Action: Network timeout occurs
- Expected: Error message shown to user
- Pass condition: Error message visible, can retry
- Fail condition: Silent failure, app shows empty results

#### Edge Cases

**Test 9: Search with special characters (e.g., quotes, apostrophes)**
- Setup: Post with title "O'Brien's Quote"
- Action: Search for "O'Brien's"
- Expected: Post found (special chars handled)
- Pass condition: Post in results
- Fail condition: Query error, no results

**Test 10: Search on empty database**
- Setup: No posts exist
- Action: User searches
- Expected: Empty results message, no error
- Pass condition: Helpful empty state
- Fail condition: Error message, crash, or silent failure

**Test 11: Very long search query (e.g., 1000 characters)**
- Setup: User pastes very long text into search
- Action: Search performed
- Expected: Either works or shows error message
- Pass condition: Handled gracefully (no crash)
- Fail condition: App crashes, hangs, or shows cryptic error

---

## TEST EXECUTION RULES

1. **Must all pass before shipping**
   - If any test fails: Fix code, rerun test
   - If test can't pass: Feature not ready
   
2. **If test is untestable**
   - Mark as CRITICAL
   - Either make testable or remove requirement
   
3. **Regression test after changes**
   - Every test must pass
   - No new failures allowed
   
4. **Document failures**
   - Why did it fail?
   - What was the root cause?
   - How was it fixed?

---

## THRESHOLD FOR "DONE"

Feature is done when:
- [ ] All functional correctness tests pass
- [ ] All performance tests pass
- [ ] All edge case tests pass
- [ ] All state consistency tests pass
- [ ] All reliability tests pass
- [ ] No critical untestable gaps remain
- [ ] Coverage is 100% for critical paths

If any checkbox is NO: Not done.

---

**Correctness is objective. Your tests define it. No ambiguity.**