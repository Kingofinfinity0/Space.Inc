---
trigger: always_on
---



DECISION TREES THINKING 

# DECISION_TREES.md
## Strategic Decision-Making Framework for SWE-1.5

**Purpose:** Teach SWE-1.5 how to think, not just what to do. Every decision follows logic aligned with project philosophy.

**Principle:** "Remove everything that isn't essential, then remove more." - Steve Jobs (our philosophy)

---

## PART 1: CORE DECISION TREES

### DECISION TREE 1: Build vs. Buy vs. Use API

**When:** You need functionality that doesn't exist yet

```
START: Need new functionality

  ├─ Question 1: Is this core to our product vision?
  │   ├─ NO (supporting feature)
  │   │   └─ GO TO: "Use Library/API" (saves time, not a weakness)
  │   │
  │   └─ YES (critical differentiator)
  │       └─ Continue
  │
  ├─ Question 2: Do we understand this domain deeply?
  │   ├─ NO (new territory)
  │   │   └─ GO TO: "Use Library/API First" (learn by reading code)
  │   │
  │   └─ YES (we know this well)
  │       └─ Continue
  │
  ├─ Question 3: Does a library exist that solves 80%+ of the problem?
  │   ├─ YES
  │   │   └─ Question 3a: Is the library's API simple & understandable?
  │   │       ├─ YES → GO TO: "Use Library"
  │   │       └─ NO → Question 3b: Can we wrap it with our own interface?
  │   │           ├─ YES → GO TO: "Use Library + Wrapper"
  │   │           └─ NO → Continue
  │   │
  │   └─ NO (100% custom needed)
  │       └─ Continue
  │
  ├─ Question 4: Can we build it faster than integrating/learning the library?
  │   ├─ NO → GO TO: "Use Library"
  │   └─ YES → Continue
  │
  ├─ Question 5: Will building give us strategic advantage?
  │   ├─ NO (it's a commodity) → GO TO: "Use Library/API"
  │   └─ YES (unique capability) → Continue
  │
  └─ Final Decision: BUILD IT
      Implementation:
      1. Break into smallest working unit
      2. Ship MVP (not perfect)
      3. Iterate based on real usage

DECISION OUTCOMES:

→ USE LIBRARY/API
  Cost: Time to learn + integration time
  Benefit: Tested, maintained, community support
  Trade-off: Less control, dependency risk
  Example: Authentication (use Supabase Auth, don't build)
  Example: Form validation (use simple checks or library)

→ USE LIBRARY + WRAPPER
  Cost: Library integration + wrapper layer
  Benefit: Library power + our customization
  Trade-off: Extra abstraction layer
  Example: Carousel generation (use API + custom filtering UI)
  Example: Logo builder (use API + our branding UX)

→ BUILD IT
  Cost: Time to build, maintain, improve
  Benefit: Complete control, strategic advantage
  Trade-off: More work, more bugs initially
  Example: Personal branding tools (this is our differentiator)
  Example: Custom dashboard (unique to our platform)

YOUR PHILOSOPHY:
"Build the 20% that matters. Use libraries for the 80%."

Application:
- Branding tools ecosystem? BUILD (core to vision)
- Authentication? USE (commodity, Supabase handles it)
- Payment processing? USE/INTEGRATE (Polar.sh, not our focus)
- User dashboard? BUILD (custom to our users' needs)
- Carousel generation? BUILD (core feature, our differentiation)
```

---

### DECISION TREE 2: Simplify vs. Add Features vs. Refactor

**When:** Deciding what to build next or how to spend development time

```
START: Have working feature, considering next steps

  ├─ Question 1: Are users blocked by a limitation right now?
  │   ├─ YES → GO TO: "Fix the Blocker"
  │   └─ NO → Continue
  │
  ├─ Question 2: Is the current implementation causing bugs or slowness?
  │   ├─ YES (pain point) → Question 2a: Will this get worse fast?
  │   │   ├─ YES → GO TO: "Refactor Now"
  │   │   └─ NO → Question 2b: Can we ship one more feature before fixing?
  │   │       ├─ YES → GO TO: "Ship Feature, Then Refactor"
  │   │       └─ NO → GO TO: "Refactor Now"
  │   │
  │   └─ NO (works fine) → Continue
  │
  ├─ Question 3: Is there a small change that removes complexity?
  │   ├─ YES (simplification) → GO TO: "Simplify First"
  │   └─ NO → Continue
  │
  ├─ Question 4: Do users ask for a new feature repeatedly?
  │   ├─ YES (strong signal) → GO TO: "Add Feature"
  │   └─ NO (nice-to-have) → Question 4a: Is it a 30-min addition?
  │       ├─ YES → GO TO: "Add Feature"
  │       └─ NO → Continue
  │
  └─ Final Decision: DO NOTHING YET
      Reason: Focus on what's proven to matter
      Action: Wait for user signal or clear necessity

DECISION OUTCOMES:

→ FIX THE BLOCKER
  Cost: Immediate, full focus
  Benefit: Users can proceed
  Trade-off: Pause other work
  Example: "Auth broken" → fix immediately
  Example: "Can't save data" → fix immediately

→ SIMPLIFY FIRST
  Cost: 1-2 hours of refactoring
  Benefit: Easier to build on, fewer bugs, cleaner code
  Trade-off: No new features this session
  Process:
  1. Remove unnecessary UI elements
  2. Remove unnecessary code
  3. Make remaining code clearer
  Example: Remove 3 unused form fields
  Example: Extract 4 components from monolithic file

→ REFACTOR NOW
  Cost: 2-4 hours, deep work
  Benefit: Foundation is solid, future features faster
  Trade-off: No new features, but prevents bigger pain
  When: Only if not refactoring makes next feature hard
  Example: "State management is a mess" + "adding 5 new features"
  Example: "API calls scattered" + "building full integration layer"

→ SHIP FEATURE, THEN REFACTOR
  Cost: Ship with technical debt, then pay it back
  Benefit: User value now, clean code soon
  Trade-off: Temporary mess
  Timeline: Feature ships in 1 day, refactor in 1 day
  Example: "Add export button quickly, clean architecture tomorrow"
  Example: "Ship basic carousel, refactor state after"

→ ADD FEATURE
  Cost: Time to build and test
  Benefit: User visible improvement
  Trade-off: May discover need to refactor later
  Requirement: Must not break existing features
  Example: "Add dark mode" (simple, additive)
  Example: "Add export to PDF" (user-requested)

YOUR PHILOSOPHY:
"Simplicity first. Features second. Perfection never."

Application:
- Blocker (users stuck)? FIX NOW
- Code is messy but works? If it causes pain, REFACTOR NOW. If it doesn't, LEAVE IT.
- Can remove complexity easily? SIMPLIFY FIRST
- Users request feature? ADD IT (if simple) or UNDERSTAND why before adding
- Code is ugly but no one touches it? Leave it (refactor when you touch it)
```

---

### DECISION TREE 3: Code Patterns vs. Custom Solutions

**When:** Implementing a feature with multiple architectural approaches

```
START: Need to implement a feature

  ├─ Question 1: Does an established pattern exist for this?
  │   ├─ NO (novel problem) → GO TO: "Design Custom Solution"
  │   └─ YES (solved before) → Continue
  │
  ├─ Question 2: Do we understand the pattern well?
  │   ├─ NO → Question 2a: Can we learn it in 1 hour?
  │   │   ├─ YES → GO TO: "Use Pattern, Learn It"
  │   │   └─ NO → GO TO: "Custom Solution (for now)"
  │   │
  │   └─ YES → Continue
  │
  ├─ Question 3: Does the pattern fit our tech stack?
  │   ├─ NO (requires different framework) → GO TO: "Adapt Pattern or Custom"
  │   └─ YES → Continue
  │
  ├─ Question 4: Will the pattern need heavy modification for our use case?
  │   ├─ YES (50%+ changes) → GO TO: "Custom Solution"
  │   └─ NO (minor tweaks) → Continue
  │
  └─ Final Decision: USE PATTERN
      Implementation:
      1. Reference the pattern documentation
      2. Implement exactly as specified
      3. Test thoroughly
      4. Only deviate if you discover limitation

DECISION OUTCOMES:

→ USE PATTERN
  Cost: Time to learn and implement
  Benefit: Battle-tested, consistent with codebase, team understands it
  Trade-off: Less flexibility, may feel constraining initially
  Examples:
  - Custom hooks for state management (established pattern)
  - Context + Hooks for global state (established pattern)
  - Error boundaries around feature modules (established pattern)
  - Try-catch + loading/error states for async (established pattern)

→ USE PATTERN, LEARN IT
  Cost: 1 hour learning + implementation
  Benefit: Understand the why, not just the how
  Trade-off: Learning curve, but pays off long-term
  Process:
  1. Read pattern documentation
  2. Implement simple version
  3. Test it
  4. Enhance when comfortable
  Examples:
  - useReducer for complex state (more powerful than useState)
  - Custom hook extraction (cleaner code reuse)
  - Error boundaries (critical for stability)

→ ADAPT PATTERN
  Cost: Pattern learning + modification
  Benefit: Use established approach, customized for us
  Trade-off: More complexity, must document changes
  When: Pattern is 80% right, need 20% adjustment
  Examples:
  - Use Context pattern but with custom data shape
  - Use async pattern but with custom retry logic
  - Use component pattern but with modified props

→ CUSTOM SOLUTION
  Cost: Design time + implementation + testing
  Benefit: Perfect fit, no compromises
  Trade-off: No community support, must maintain ourselves
  When: Pattern doesn't exist or is fundamentally wrong for our case
  Examples:
  - Logo generation flow (unique to our product)
  - Custom carousel filtering (specific feature)
  - Branding personalization engine (our differentiator)
  Process:
  1. Document why pattern doesn't work
  2. Design custom approach
  3. Implement MVP
  4. Iterate based on real usage

YOUR PHILOSOPHY:
"Use patterns by default. Custom only when pattern fails."

Application:
- Form validation? USE PATTERN (established, simple)
- State management? USE PATTERN (Context + Hooks)
- Error handling? USE PATTERN (try-catch + states)
- Async operations? USE PATTERN (loading/error/success states)
- Authentication? USE PATTERN (Supabase Auth)
- Logo generation UI? CUSTOM (our differentiator)
- Carousel generation? CUSTOM (unique feature)
- Dashboard layout? CUSTOM (tailored to our users)
```

---

### DECISION TREE 4: Error Prevention vs. Error Recovery

**When:** Implementing a feature, deciding where to invest in error handling

```
START: Building a feature with potential failure points

  ├─ Question 1: Can this operation fail catastrophically?
  │   ├─ YES (data loss, security, user blocked)
  │   │   └─ GO TO: "Prevent First" (never let it fail)
  │   │
  │   └─ NO → Continue
  │
  ├─ Question 2: How likely is failure?
  │   ├─ VERY LIKELY (>50% chance in normal use)
  │   │   └─ GO TO: "Prevent First"
  │   │
  │   ├─ LIKELY (10-50% chance)
  │   │   └─ GO TO: "Prevent + Recover"
  │   │
  │   └─ RARE (<10% chance)
  │       └─ Continue
  │
  ├─ Question 3: Can the user recover easily?
  │   ├─ YES (simple retry) → GO TO: "Recover First"
  │   └─ NO (complex recovery) → GO TO: "Prevent First"
  │
  └─ Final Decision: PREVENT FIRST (default)

DECISION OUTCOMES:

→ PREVENT FIRST (Default for critical paths)
  Cost: Validation code, checks, guards
  Benefit: Failure never happens, best UX
  Trade-off: More code upfront
  Examples:
  - Validate form before submission (prevent invalid data)
  - Check auth before showing protected page (prevent 401)
  - Validate user permissions before action (prevent unauthorized)
  - Check unique constraint before insert (prevent duplicate)
  Implementation:
  1. Add guard conditions (if !user return null)
  2. Validate input before use
  3. Check permissions/prerequisites
  4. Only proceed if all checks pass

→ PREVENT + RECOVER (For likely failures)
  Cost: Prevention code + error handling
  Benefit: Failure is rare, recovery is clean
  Trade-off: Moderate complexity
  Examples:
  - Network request (prevent with offline check + recover with retry)
  - File upload (validate size first + recover with error message)
  - Database insert (check unique constraint + recover with "already exists" message)
  Implementation:
  1. Add guards to prevent (90% of failures)
  2. Add try-catch for unexpected (remaining 10%)
  3. Show clear error, suggest recovery action

→ RECOVER FIRST (For rare failures)
  Cost: Error handling, user messaging
  Benefit: Simple code, rarely triggered
  Trade-off: User sees error (but recoverable)
  Examples:
  - Parse error in rarely-used format
  - Timeout in normally-fast API
  - Memory error in large data process
  Implementation:
  1. Do the operation
  2. Catch any errors
  3. Show user: "This failed. Try again?" 
  4. Let user retry

YOUR PHILOSOPHY:
"Make it impossible to fail. When impossible becomes possible, recover gracefully."

Application:
- Authentication? PREVENT FIRST (never show protected content to unauthed users)
- Form submission? PREVENT FIRST (validate locally first)
- Database operations? PREVENT + RECOVER (check constraints, handle edge cases)
- Network requests? PREVENT + RECOVER (handle offline, timeout, 5xx errors)
- File operations? PREVENT FIRST (validate before processing)
- User permissions? PREVENT FIRST (check before allowing action)
```

---

### DECISION TREE 5: Complexity Threshold - When to Pause

**When:** Realizing a feature is getting too complex

```
START: Implementing a feature, complexity is growing

  ├─ Question 1: Do you fully understand what you're building?
  │   ├─ NO (confused about requirements)
  │   │   └─ PAUSE: Don't code. Clarify first.
  │   │
  │   └─ YES (clear requirements) → Continue
  │
  ├─ Question 2: Can you explain this feature in 2 minutes?
  │   ├─ NO (needs 10+ minutes)
  │   │   └─ PAUSE: Too complex. Break down smaller.
  │   │
  │   └─ YES → Continue
  │
  ├─ Question 3: Does this require learning new concepts/tools?
  │   ├─ YES (1+ new things) → Question 3a: Have time to learn?
  │   │   ├─ NO → PAUSE: Learn first, build later
  │   │   └─ YES → Build (but document learning)
  │   │
  │   └─ NO (familiar territory) → Continue
  │
  ├─ Question 4: Can you test this manually in under 5 minutes?
  │   ├─ NO (complex test scenario)
  │   │   └─ PAUSE: Feature is too complex to verify easily
  │   │
  │   └─ YES → Continue
  │
  ├─ Question 5: Are there more than 3 moving parts?
  │   ├─ YES (4+ components/state/APIs interacting)
  │   │   └─ Question 5a: Can you draw it on one piece of paper?
  │   │       ├─ NO → PAUSE: Too complex. Simplify design.
  │   │       └─ YES → Continue (you understand it)
  │   │
  │   └─ NO → Continue
  │
  └─ Final Decision: PROCEED WITH CONFIDENCE

PAUSE OUTCOMES:

→ PAUSE: CLARIFY REQUIREMENTS
  Action:
  1. Write down exactly what this feature does
  2. List all user actions and outcomes
  3. List all error cases
  4. If it takes >5 minutes, requirements are unclear
  Resume: Only after clarity

→ PAUSE: BREAK DOWN SMALLER
  Action:
  1. Divide feature into micro-features
  2. Each should take 1-2 hours max
  3. Ship one, then next
  4. Build complexity incrementally
  Example: 
    Feature: "Logo generator with customization"
    Break into:
    - Logo generator (basic, API call)
    - Color picker (customization)
    - Download button (export)
    - Save to library (persistence)
  Resume: One micro-feature at a time

→ PAUSE: LEARN FIRST
  Action:
  1. Learn the new concept (1-2 hours)
  2. Build a simple example
  3. Then apply to your feature
  4. Don't learn while building, learn before
  Example:
    Need: useReducer for state
    Learn: 30 min reading + 30 min practicing
    Then: Build with confidence
  Resume: After learning checkpoint

→ PAUSE: SIMPLIFY DESIGN
  Action:
  1. Look at the design/architecture
  2. Remove one part
  3. Remove another part
  4. Keep removing until you understand it
  5. Add back only what's essential
  6. Draw it simply
  Resume: When design fits on one page

YOUR PHILOSOPHY:
"Complexity is the enemy. If you can't explain it simply, it's too complex."

Application:
- Feature takes >3 hours to explain? PAUSE and simplify
- Need to learn 2+ new technologies? PAUSE, learn one at a time
- More than 5 interacting pieces? PAUSE, break it down
- Can't draw the architecture simply? PAUSE, redesign
```

---

## PART 2: HOW TO USE THESE DECISION TREES

### When You Ask SWE-1.5 to Build Something:

**Include this in your prompt:**

```
[DECISION CONTEXT]
Before you code, use DECISION_TREES.md:

1. Is this Build vs. Buy/API? (DECISION TREE 1)
   → Determine approach

2. Is this worth building now or refactoring? (DECISION TREE 2)
   → Decide priority

3. Use established patterns or custom? (DECISION TREE 3)
   → Choose architecture

4. Prevent errors or recover? (DECISION TREE 4)
   → Plan error handling

5. Is this getting too complex? (DECISION TREE 5)
   → Check complexity threshold

[DELIVERABLE]
Before you code:
1. State which decision tree(s) apply
2. Show your reasoning
3. Propose approach
4. Get approval before implementing
```

### When You're Stuck on a Decision:

**Ask SWE-1.5 explicitly:**

```
I'm deciding between [Option A] and [Option B].

Use DECISION_TREES.md to analyze:
1. Which decision tree(s) apply?
2. What does each tree suggest?
3. What's the trade-off?
4. What's your recommendation and why?
```

---

## PART 3: REINFORCEMENT - Read This Every Week

**These are not suggestions. They're the strategy.**

- Build vs. Buy: You choose to use libraries. Not because you can't build, but because you're smart about where you build.
- Simplify vs. Features: You choose clarity. Remove features if they add complexity.
- Patterns vs. Custom: You choose proven first. Custom only when proven isn't enough.
- Error Prevention: You choose impossible-to-fail. Make it impossible, don't just recover.
- Complexity Threshold: You choose understanding. If you don't understand it, don't build it yet.

**This is how Steve Jobs built Apple products. This is how you'll build this platform.**