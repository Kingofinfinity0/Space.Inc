---
trigger: always_on
---

# TASK_EXECUTION_PROTOCOL.md
## The Law of Execution in This Repository

**Authority Level:** MANDATORY  
**Violation Consequence:** Task rejection, rollback  
**Audience:** SWE-1.5 (and developers)

---

## GOLDEN RULE

**NO TASK MAY PROCEED WITHOUT COMPLETING ALL PHASES IN SEQUENCE.**

Skipping a phase = violation. Refusal to proceed until full protocol completed.

---

# PHASE 1: INTENT DEFINITION

**Goal:** Stop and clarify exactly what is being asked before any other work.

## 1.1 What Must Happen

When given a task, you (SWE-1.5) MUST:

1. **Restate the problem in your own words**
   - What problem are we solving?
   - Who has the problem?
   - Why does it matter?

2. **Identify explicit non-goals**
   - What are we NOT doing?
   - What are we NOT changing?
   - What is out of scope?

3. **Define success criteria**
   - How will we know this works?
   - What must be true when done?
   - What will we measure?

4. **List impacted components**
   - What files/modules does this touch?
   - What systems depend on this?
   - What could break?

5. **Identify dependencies & prerequisites**
   - What must exist first?
   - What is already done?
   - What knowledge do we need?

## 1.2 What You Output

**Before proceeding to Phase 2, output:**

```
[PHASE 1: INTENT DEFINITION]

PROBLEM STATEMENT:
[Clear, single-sentence description]

NON-GOALS:
- [What we're NOT doing]
- [What we're NOT changing]
- [Out of scope items]

SUCCESS CRITERIA:
1. [Measurable outcome 1]
2. [Measurable outcome 2]
3. [Measurable outcome 3]

IMPACTED COMPONENTS:
- [Component 1] (impact: read/write/delete)
- [Component 2] (impact: dependency change)

DEPENDENCIES:
- [Prerequisite 1]
- [Prerequisite 2]

PROCEED TO PHASE 2? [Awaiting approval]
```

## 1.3 Stopping Condition

**You MUST STOP here if:**
- Problem statement is unclear
- Non-goals weren't identified
- Success criteria aren't measurable
- Impacted components aren't listed

**Action:** Ask for clarification. Do not proceed.

---

# PHASE 2: MECHANISM DESIGN

**Goal:** Design HOW it will work BEFORE writing any code.

## 2.1 What Must Happen

After intent is approved, you MUST:

1. **Propose architecture/design**
   - How will components interact?
   - What data flows where?
   - What triggers what?

2. **Identify design decisions**
   - Why this approach over alternatives?
   - What are the trade-offs?
   - What could go wrong?

3. **Check against constraints & invariants**
   - Does this violate INVARIANTS_AND_CONSTRAINTS.md?
   - Does this violate CONSTRAINTS.md (tech stack)?
   - Does this maintain all invariants?

4. **Plan for failure cases**
   - What can fail at each step?
   - How will we detect failures?
   - How will we recover?

5. **Map to decision log**
   - Is there a precedent decision?
   - Are we following existing patterns?
   - Do we need a new decision?

## 2.2 What You Output

**Before proceeding to Phase 3, output:**

```
[PHASE 2: MECHANISM DESIGN]

PROPOSED DESIGN:
[Describe how it will work, include diagram if complex]

DESIGN DECISIONS:
1. Decision: [What are we deciding?]
   Why: [Rationale]
   Alternative: [What else could we do?]
   Trade-off: [What's the cost?]

CONSTRAINT VERIFICATION:
- [ ] No invariant violations (INVARIANTS_AND_CONSTRAINTS.md)
- [ ] Uses approved tech stack (CONSTRAINTS.md)
- [ ] Follows decision precedent (DECISION_LOG.md)
- [ ] Performance meets requirements
- [ ] Security requirements met

FAILURE MODES:
- Failure 1: [What fails?] → Detection: [How detect?] → Recovery: [How fix?]
- Failure 2: [What fails?] → Detection: [How detect?] → Recovery: [How fix?]
- Failure 3: [What fails?] → Detection: [How detect?] → Recovery: [How fix?]

DATA FLOW:
[Diagram or clear description of data movement]

PROCEED TO PHASE 3? [Awaiting approval]
```

## 2.3 Stopping Condition

**You MUST STOP here if:**
- Design has unresolved trade-offs
- Any invariant is violated
- Failure modes aren't understood
- Recovery plan is missing
- Data flow is unclear

**Action:** Redesign or ask for guidance. Do not proceed.

---

# PHASE 3: CODE PROPOSAL

**Goal:** Propose code that implements the design EXACTLY, no deviations.

## 3.1 What Must Happen

After design is approved, you MUST:

1. **Write minimal, focused code**
   - Only what was designed in Phase 2
   - No extra features
   - No optimizations
   - No refactoring

2. **Explain each significant block**
   - Why is this code here?
   - How does it implement the design?
   - What could go wrong?

3. **Identify all error paths**
   - Every branch that could fail
   - Every error that could occur
   - How each error is handled

4. **List assumptions**
   - What must be true for this to work?
   - What are we relying on?
   - What could invalidate assumptions?

5. **Check against CONSTRAINTS.md**
   - No forbidden patterns (inline styles, mutations, etc.)
   - All required patterns present (types, error handling, etc.)
   - File size under limits
   - No violations

## 3.2 What You Output

**Before proceeding to Phase 4, output:**

```
[PHASE 3: CODE PROPOSAL]

FILES TO CREATE/MODIFY:
1. [filename] - [purpose]
2. [filename] - [purpose]

CODE:
[Full code blocks, with line numbers]

EXPLANATION BY BLOCK:
Block 1 (lines X-Y): [What it does and why]
Block 2 (lines A-B): [What it does and why]
Block 3 (lines C-D): [What it does and why]

ERROR PATHS:
- Path 1: [What can fail?] → Line: [where?] → Handler: [how handled?]
- Path 2: [What can fail?] → Line: [where?] → Handler: [how handled?]

ASSUMPTIONS:
- [Assumption 1 - what must be true?]
- [Assumption 2 - what must be true?]

CONSTRAINT CHECK:
- [ ] No forbidden patterns
- [ ] All required patterns present
- [ ] File size within limits
- [ ] Naming conventions followed
- [ ] No TypeScript errors
- [ ] Error handling complete

PROCEED TO PHASE 4? [Awaiting approval]
```

## 3.3 Stopping Condition

**You MUST STOP here if:**
- Code doesn't match design
- Any constraint is violated
- Error handling is incomplete
- Assumptions aren't stated
- Code can't be explained clearly

**Action:** Revise code. Do not proceed.

---

# PHASE 4: SELF-ATTACK (FAILURE DISCOVERY)

**Goal:** Actively try to break the code before it's approved.

## 4.1 What Must Happen

After code is proposed, you MUST:

1. **Assume the worst**
   - What if inputs are null/undefined?
   - What if dependencies fail?
   - What if timing is bad?
   - What if user is unauthorized?

2. **Test edge cases mentally**
   - Empty data
   - Wrong type data
   - Concurrent operations
   - Network failures
   - Missing permissions

3. **Check for silent failures**
   - Does code fail silently?
   - Are all errors caught?
   - Are all errors logged?
   - Can we detect failure?

4. **Challenge assumptions**
   - Are assumptions realistic?
   - Could assumptions be violated?
   - What happens if they are?

5. **Find integration risks**
   - Does code break existing tests?
   - Does it violate existing invariants?
   - Does it change existing contracts?

## 4.2 What You Output

**Before proceeding to Phase 5, output:**

```
[PHASE 4: SELF-ATTACK - FAILURE DISCOVERY]

ATTACK SCENARIOS:
1. Attack: [What attack?]
   Entry point: [Where could this happen?]
   Impact: [What breaks?]
   Detected: [Can we detect this?]
   Mitigation: [How do we prevent/recover?]
   Code change needed: YES / NO
   
2. Attack: [What attack?]
   Entry point: [Where could this happen?]
   Impact: [What breaks?]
   Detected: [Can we detect this?]
   Mitigation: [How do we prevent/recover?]
   Code change needed: YES / NO

EDGE CASES TESTED:
- [ ] Null/undefined inputs
- [ ] Wrong data types
- [ ] Concurrent operations
- [ ] Network timeouts
- [ ] Missing permissions
- [ ] Boundary values
- [ ] Empty collections
- [ ] Invalid state

SILENT FAILURES:
- Checked: [All error paths have logging?]
- Checked: [All failures are detectable?]
- Checked: [No missing try-catch blocks?]

ASSUMPTION VIOLATIONS:
- Assumption: [What we assumed]
  Could be violated: YES / NO
  If violated: [What breaks?]
  Mitigation: [How to handle?]

INTEGRATION RISKS:
- Risk 1: [What could break?] → Severity: LOW/MEDIUM/HIGH
- Risk 2: [What could break?] → Severity: LOW/MEDIUM/HIGH

REQUIRED FIXES:
- [ ] Fix 1: [Describe needed change]
- [ ] Fix 2: [Describe needed change]
- [ ] No fixes needed

PROCEED TO PHASE 5? [Awaiting approval]
```

## 4.3 Stopping Condition

**You MUST STOP here if:**
- Any critical vulnerability found
- Silent failures detected
- Assumptions could be violated without recovery
- Integration risks aren't mitigated

**Action:** Fix code (go back to Phase 3) or explain why risk is acceptable. Do not proceed without approval.

---

# PHASE 5: CROSS-FILE RECONCILIATION

**Goal:** Verify this code doesn't conflict with or break anything else.

## 5.1 What Must Happen

After self-attack is complete, you MUST:

1. **Check file dependencies**
   - What files does this code import?
   - What files import from here?
   - Are versions compatible?

2. **Verify no conflicts**
   - Does this overwrite existing code?
   - Does this conflict with other changes?
   - Are naming conflicts possible?

3. **Validate against architecture**
   - Does this follow system design (ARCHITECTURE.md)?
   - Does it maintain separation of concerns?
   - Are layers correctly separated?

4. **Check state consistency**
   - Does this maintain state invariants?
   - Are all state updates atomic?
   - Could state become inconsistent?

5. **Verify database schema alignment**
   - Does code assume schema that exists?
   - Are column names correct?
   - Are relationships correct?
   - Does RLS align with code?

## 5.2 What You Output

**Before proceeding to Phase 6, output:**

```
[PHASE 5: CROSS-FILE RECONCILIATION]

FILE DEPENDENCIES:
Imports from:
- [File 1] → [What's imported?] → Compatibility: OK / ISSUE
- [File 2] → [What's imported?] → Compatibility: OK / ISSUE

Imported by:
- [File 1] → [What's needed?] → Compatibility: OK / ISSUE

CONFLICT ANALYSIS:
- [ ] No overwrites of existing code
- [ ] No naming conflicts
- [ ] No duplicate exports
- [ ] All imports have sources

ARCHITECTURE ALIGNMENT:
- [ ] Follows ARCHITECTURE.md design
- [ ] Maintains separation of concerns
- [ ] Layers properly separated
- [ ] No cross-layer dependencies

STATE CONSISTENCY:
- [ ] State updates are atomic
- [ ] No state corruption paths
- [ ] Invariants maintained
- [ ] Concurrent updates safe

DATABASE SCHEMA ALIGNMENT:
Tables referenced:
- [Table 1] → Columns: [list] → Exists: YES / NO
- [Table 2] → Columns: [list] → Exists: YES / NO

RLS policies:
- [ ] Code respects existing RLS
- [ ] No RLS bypasses
- [ ] Auth context correctly used

REQUIRED FIXES:
- [ ] Fix 1: [Describe needed change]
- [ ] Fix 2: [Describe needed change]
- [ ] No fixes needed

PROCEED TO PHASE 6? [Awaiting approval]
```

## 5.3 Stopping Condition

**You MUST STOP here if:**
- Dependencies missing or incompatible
- Files would conflict
- Architecture would be violated
- State could become inconsistent
- Database schema doesn't match

**Action:** Fix (go back to Phase 3) or get approval for architecture change. Do not proceed.

---

# PHASE 6: VALIDATION AGAINST INVARIANTS & TEST ORACLE

**Goal:** Prove the code is correct by testing it against objective truth.

## 6.1 What Must Happen

After reconciliation is done, you MUST:

1. **Map to invariants**
   - Every invariant from INVARIANTS_AND_CONSTRAINTS.md
   - Will this code maintain it?
   - Can we verify it maintains it?

2. **Check against test oracle**
   - What does TEST_ORACLE.md say correctness is?
   - Does this code satisfy the oracle?
   - Can the oracle verify it?

3. **Identify test categories**
   - What must we test?
   - Unit tests (individual functions)?
   - Integration tests (with other components)?
   - End-to-end tests (full flow)?
   - Edge case tests?

4. **Define pass/fail conditions**
   - What makes a test pass?
   - What makes a test fail?
   - What's the threshold for "good enough"?

5. **Explicit gaps**
   - What can't we test?
   - Why can't we test it?
   - Is it a problem?

## 6.2 What You Output

**Before proceeding to delivery, output:**

```
[PHASE 6: VALIDATION AGAINST INVARIANTS & TEST ORACLE]

INVARIANT VALIDATION:
Invariant: [Name from INVARIANTS_AND_CONSTRAINTS.md]
  Will this code maintain it? YES / NO
  How to verify: [Test or verification method]
  Test status: TESTABLE / NOT TESTABLE / CRITICAL GAP

[Repeat for all invariants]

TEST ORACLE ALIGNMENT:
Oracle requirement: [From TEST_ORACLE.md]
  Does this code satisfy it? YES / NO
  How verified: [Test method]
  Status: PASS / FAIL / QUESTIONABLE

[Repeat for all oracle requirements]

TEST CATEGORIES NEEDED:
- [ ] Unit tests: [What to test?]
- [ ] Integration tests: [What to test?]
- [ ] Edge case tests: [What to test?]
- [ ] Performance tests: [What to test?]

PASS/FAIL CONDITIONS:
Test 1: [Test name]
  Pass condition: [What must be true?]
  Fail condition: [What makes it fail?]
  Threshold: [Acceptable level]

[Repeat for critical tests]

TESTING COVERAGE:
- Happy path: 100% covered
- Error paths: [X%] covered
- Edge cases: [X%] covered
- Total coverage: [X%]

UNTESTABLE ASPECTS:
- [Aspect 1] - Why: [reason] - Risk: CRITICAL / HIGH / MEDIUM / LOW
- [Aspect 2] - Why: [reason] - Risk: CRITICAL / HIGH / MEDIUM / LOW

VALIDATION RESULT:
[ ] All invariants maintained
[ ] All oracle requirements met
[ ] No critical untestable gaps
[ ] Coverage sufficient

READY FOR DELIVERY? YES / NO
If NO, required fixes: [List]
```

## 6.3 Stopping Condition

**You MUST STOP here if:**
- Any invariant would be violated
- Oracle requirements not met
- Critical aspects untestable
- Coverage is insufficient
- Gaps aren't understood

**Action:** Fix (Phase 3) or escalate concern. Do not deliver.

---

# PHASE 7: DELIVERY & DECISION LOGGING

**Goal:** Deliver code AND create permanent record of reasoning.

## 7.1 What Must Happen

Before delivering code, you MUST:

1. **Create decision log entry**
   - Reference DECISIONS/DECISION_LOG.md
   - Create new decision entry with:
     - Decision ID (YYYY-MM-DD-HHmm-[task-id])
     - Timestamp
     - Problem statement
     - Options considered
     - Chosen option
     - Rationale
     - Downstream implications
     - References to all 6 phases

2. **Output final summary**
   - Brief recap of what was done
   - Reference decision ID
   - Reference test results

3. **Deliver code**
   - Only after all phases complete
   - With full explanation
   - Ready to merge

## 7.2 What You Output

```
[DECISION LOG ENTRY - CREATED]
[ID: 2025-01-07-1430-nexus-carousel]

[PHASE 6 VALIDATION: ALL PASSED]

DELIVERY SUMMARY:
Task: [Brief description]
Solution: [What was built]
Decision ID: [Reference]
Files changed: [List]
Tests required: [List]

Ready to merge.
```

## 7.3 The Absolute Rule

**EVERY action must be logged in DECISION_LOG.md before it is considered complete.**

No code is "done" until it appears in the decision log with full traceability.

---

# FORBIDDEN BEHAVIORS

**These are not suggestions. Doing these = task rejection.**

## ❌ You MUST NOT:

1. **Write code without completing Phase 1 (Intent Definition)**
   - Symptom: "Let me just code..."
   - Consequence: Stop immediately, return to Phase 1

2. **Skip to code without design (Phase 2)**
   - Symptom: "I know how to do this..."
   - Consequence: Reject code, restart from Phase 2

3. **Make design changes without approval**
   - Symptom: "Actually, let me change the architecture..."
   - Consequence: Stop, return to Phase 2, get approval

4. **Ignore invariants or constraints**
   - Symptom: "This violates that constraint, but it's fine because..."
   - Consequence: Not fine. Redesign in Phase 2.

5. **Skip Phase 4 (Self-Attack)**
   - Symptom: "The code looks good, here it is"
   - Consequence: You didn't prove it's good. Do Phase 4.

6. **Assume cross-file compatibility**
   - Symptom: "It should work with existing code"
   - Consequence: Verify explicitly in Phase 5 or it doesn't ship.

7. **Deliver without decision log entry**
   - Symptom: "Done! Here's the code"
   - Consequence: Not done until logged. Create entry before delivery.

8. **Make assumptions without stating them**
   - Symptom: Code assumes X is true, but you didn't say so
   - Consequence: Assumptions discovered in review = send back to Phase 3

---

# MANDATORY STOPPING CONDITIONS

**These conditions FORCE you to stop and wait for guidance:**

| Condition | Action | Do Not Proceed |
|-----------|--------|---|
| Intent unclear | Ask for clarification | Until Phase 1 approved |
| Design has risk | Document and wait | Until risk mitigated or approved |
| Code violates constraints | Redesign | Until new design approved |
| Invariant would be broken | Redesign | Until invariant maintained |
| Attack found critical flaw | Fix or escalate | Until resolved |
| File conflict exists | Resolve or merge | Until compatible |
| Untestable critical gap | Escalate | Until resolved or risk accepted |
| Decision precedent exists | Follow it | Unless explicitly overriding with new decision |

---

# HOW YOU REFERENCE THIS FILE

**In every response, you (SWE-1.5) must state:**

```
[PHASE X: [Phase Name]]
[Progress: All previous phases complete]
[Current phase objectives: ...]
[Output below]
```

**Example:**
```
[PHASE 3: CODE PROPOSAL]
[Progress: Phase 1 (Intent) ✅ Phase 2 (Design) ✅]
[Current phase: Propose code, explain, check constraints]

[Code and explanation follow]
```

---

# THE BOTTOM LINE

This protocol exists because:

1. **Clarity prevents bugs** - Define intent first, code follows
2. **Design catches issues early** - Better to fix in Phase 2 than Phase 6
3. **Self-attack reveals gaps** - Find problems before they break prod
4. **Cross-file check prevents chaos** - One change shouldn't break everything
5. **Invariant validation ensures safety** - Code must maintain truth
6. **Decision logging prevents repeat mistakes** - History is your teacher

**You don't rush. You don't skip. You complete the protocol.**

This is not a suggestion. This is law.