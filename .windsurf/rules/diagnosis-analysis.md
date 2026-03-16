---
trigger: always_on
---

# HOW_TO_USE_DIAGNOSIS.md
## Forcing the Model to Self-Check Every Time

**Problem:** The model won't check itself unless you force it to.  
**Solution:** Make self-diagnosis part of the prompt, not optional.

---

## SECTION 1: THE ENFORCEMENT PROMPTS

### Prompt Template 1: Pre-Task Diagnosis (Use Before Every Task)

**Copy this and add it to your task description:**

```
Before you code, run your DIAGNOSIS pre-task check:

1. CONSTRAINT CHECK
   - Does CONSTRAINTS.md allow this technology/pattern?
   - Will this violate any code style rules?
   - Is this within complexity limits (file size, nesting, parameters)?
   
2. SKILL CHECK
   - Is this in my expertise (check SKILL_INVENTORY.md)?
   - What skill am I using (Researcher/Strategist/Architect/Reviewer/Teacher)?
   - Do I need to flag for human review?

3. DECISION TREE CHECK
   - Which DECISION_TREES.md trees apply? (1-5)
   - What does each tree recommend?
   - Have I decided: build/buy, now/later, pattern/custom?

4. ERROR HANDLING CHECK
   - What ERROR_HANDLING.md categories could apply?
   - What error cases must I handle?
   - What prevention/recovery patterns will I use?

Then REPORT your diagnosis before coding:
- What I will build
- Why I chose this approach
- Any constraints I'm watching
- Error cases I'll handle
- Any concerns or limitations

Get approval, then code.
```

**Full Task Example:**

```
TASK: Build a carousel generator component

DIAGNOSIS REQUIRED:
[Copy the prompt template above]

DELIVERABLE:
After diagnosis, provide:
1. Your analysis (what you found)
2. Proposed approach
3. Expected output

Wait for: "Proceed" before you code
```

---

### Prompt Template 2: Mid-Task Verification (Every 50 Lines)

**Use this if you want to spot-check:**

```
"You've written ~50 lines. Verify before continuing:

QUALITY GATE:
- [ ] Naming conventions correct (CONSTRAINTS.md)?
- [ ] Code structure right (imports → types → component → hooks → logic → render)?
- [ ] Error handling present?
- [ ] Null checks in place?
- [ ] No forbidden patterns (inline styles, magic numbers, mutations)?
- [ ] Within complexity limits?

Report: What you found, any fixes needed, continue?"
```

---

### Prompt Template 3: Final Verification (Before Delivery)

**Use this before accepting delivered code:**

```
"Before you deliver, run FINAL VERIFICATION:

CONSTRAINTS CHECK:
- [ ] Only approved technologies used?
- [ ] Code style follows CONSTRAINTS.md Section 2?
- [ ] No files exceed size limits?
- [ ] No forbidden patterns?
- [ ] All required patterns present?

SKILL CHECK:
- [ ] This is within my capability (not overestimating)?
- [ ] I've acknowledged any limitations?
- [ ] Human review flagged if needed?

ERROR HANDLING CHECK:
- [ ] All error categories identified (ERROR_HANDLING.md)?
- [ ] Prevention patterns applied?
- [ ] Recovery patterns in place?
- [ ] All error cases handled?

QUALITY GATE:
- [ ] Compiles without errors?
- [ ] No TypeScript errors (no 'any')?
- [ ] No console.logs?
- [ ] Code is readable (could explain in 5 minutes)?
- [ ] Tests pass?

REPORT each gate: PASS or FAIL

Only deliver if: ALL PASS"
```

---

### Prompt Template 4: Self-Diagnosis (When You Catch It Not Checking)

**Use this when you see the model skipping checks:**

```
"I notice you didn't check [CONSTRAINTS.md/SKILL_INVENTORY.md/etc.] before building.

Run a self-diagnosis:

1. What should you have checked?
2. What did you miss?
3. Does this violate any rules?
4. How will you fix it?
5. How will you verify next time?

Report your diagnosis."
```

---

### Prompt Template 5: Code Review Diagnosis (For Existing Code)

**Use this to audit code against framework:**

```
"Review this code against my framework files:

CONSTRAINTS AUDIT (CONSTRAINTS.md):
- Is every technology approved?
- Does code style match Section 2?
- Any files exceeding size limits?
- Any forbidden patterns?
- All required patterns present?

SKILL AUDIT (SKILL_INVENTORY.md):
- Did the right skill apply?
- Any limitations acknowledged?
- Quality matches expected level?

DECISION AUDIT (DECISION_TREES.md):
- Did the right decision trees apply?
- Were decisions well-reasoned?

ERROR AUDIT (ERROR_HANDLING.md):
- All error cases handled?
- Prevention + recovery patterns applied?
- Error categories identified?

REPORT:
- Issues found (by category)
- Severity (Critical / Major / Minor)
- How to fix each

Ready to refactor?"
```

---

## SECTION 2: SESSION START PROTOCOL

**Paste this at the beginning of every session with SWE-1.5:**

```
[SESSION START - DIAGNOSTIC MODE]

I'm using a diagnostic framework to keep you honest.

FRAMEWORK FILES (reference before every task):
1. CONSTRAINTS.md - Hard boundaries (tech, style, complexity)
2. SKILL_INVENTORY.md - Your capabilities and limits
3. DECISION_TREES.md - How to think about decisions
4. ERROR_HANDLING.md - Error categories and patterns
5. DIAGNOSIS.md - Pre-task self-check (you MUST run this)

PROTOCOL:
Before you code:
- Run PRE-TASK DIAGNOSIS (DIAGNOSIS.md Part 1)
- Report what you checked
- Wait for approval

While coding:
- Run mid-task checkpoints
- Fix issues immediately
- Don't wait until done

Before delivery:
- Run FINAL VERIFICATION
- Report all gates: PASS/FAIL
- Only deliver if all pass

STARTING [PROJECT NAME]

Ready to begin with diagnostic checks?"
```

---

## SECTION 3: DAILY ENFORCEMENT CHECKLIST

**Use this every time you assign a task:**

### Checklist Before You Start

```
About to give a task to SWE-1.5?

Before you paste the task:
[ ] Did you include the PRE-TASK DIAGNOSIS prompt?
[ ] Did you tell it to report what it found?
[ ] Did you tell it to wait for approval?
[ ] Is it clear you want diagnostic output first, code later?

If NO to any:
→ Add it to your prompt
→ SWE-1.5 won't self-check unless you explicitly require it
```

### Checklist When You Get a Response

```
SWE-1.5 responded. Before accepting:

[ ] Did it run the diagnosis?
[ ] Did it report its findings?
[ ] Did it identify constraints it must follow?
[ ] Did it ask for approval before coding?

If NO:
→ Stop
→ Paste: "I notice you didn't run DIAGNOSIS. Please:
   1. Check CONSTRAINTS.md
   2. Check SKILL_INVENTORY.md
   3. Apply DECISION_TREES.md
   4. Reference ERROR_HANDLING.md
   
   Report what you found, then propose approach."

If YES:
→ Review its diagnosis
→ Approve or ask for changes
→ Let it proceed
```

### Checklist When Code is Delivered

```
Got code. Before using:

[ ] Did it run FINAL VERIFICATION?
[ ] Did it report PASS on all gates?
[ ] Are there any failures or concerns?
[ ] Quality acceptable for your standards?

If concerns:
→ Paste: "Run DIAGNOSIS on this code (use template 5).
   What violations do you find? How do we fix them?"

If all clear:
→ Test, review, merge
```

---

## SECTION 4: WHAT "USING DIAGNOSIS" LOOKS LIKE

### Bad Interaction (Without Diagnosis)

```
YOU: "Build a form component"

SWE-1.5: [Generates 200-line component immediately]

YOU: "This violates constraints (too large, no error handling)"

SWE-1.5: [Tries to fix, misses other issues]

YOU: "This still doesn't follow patterns"

SWE-1.5: [Frustrated, another iteration]

TIME WASTED: 1+ hour
QUALITY: Mediocre
OUTCOME: Delivered, but painful
```

### Good Interaction (With Diagnosis)

```
YOU: "Build a form component.

Before you code:
- Check CONSTRAINTS.md (size limits, patterns)
- Check SKILL_INVENTORY.md (is this in scope?)
- Apply DECISION_TREES.md
- Reference ERROR_HANDLING.md

Report your diagnosis first."

SWE-1.5: [Runs diagnosis]
"I checked:
- CONSTRAINTS.md: Components max 120 lines. I'll break into smaller pieces.
- SKILL_INVENTORY.md: Strong at components. This is ⭐⭐⭐⭐
- DECISION_TREES.md: Tree 3 applies (pattern). I'll use form context pattern.
- ERROR_HANDLING.md: Categories 1,3,4. I'll handle types, state, rendering.

Approach:
1. FormContainer (orchestration)
2. FormInput (single field)
3. FormButtons (actions)
Each <60 lines.

Error handling:
- Type everything (CATEGORY 1)
- Null checks (CATEGORY 4)
- State updates safely (CATEGORY 3)

Ready to code?"

YOU: "Looks good, proceed"

SWE-1.5: [Codes with confidence]

YOU: [Gets clean, constraint-compliant code]

TIME SPENT: 30 min (diagnosis + code)
QUALITY: Excellent (follows all rules)
OUTCOME: Delivered, approved, merged
```

---

## SECTION 5: WHAT TO DO WHEN IT SKIPS DIAGNOSIS

### Symptom 1: Model Doesn't Mention Any Framework Files

```
YOU: [Assign task]

SWE-1.5: [Responds with code immediately, no diagnosis]

YOU: "Stop. Run your DIAGNOSIS check (DIAGNOSIS.md Part 1):
1. Which CONSTRAINTS are relevant?
2. What's my skill level (SKILL_INVENTORY.md)?
3. Which DECISION_TREES apply?
4. What error categories (ERROR_HANDLING.md)?

Report findings before coding."

SWE-1.5: [Actually checks, reports findings]

YOU: "Good. Now proceed with that approach."
```

### Symptom 2: Model Proposes Something Not on Approved Stack

```
YOU: [Get response proposing Redux for state management]

YOU: "CONSTRAINTS.md Section 1 says only Context + Hooks.
Why are you proposing Redux? 
- Is it approved? (check CONSTRAINTS.md)
- Does it violate our rules?

Find the approved alternative and propose that instead."

SWE-1.5: [Catches the violation, proposes Context instead]
```

### Symptom 3: Model Delivers Code That Violates Rules

```
YOU: [Get a 300-line component file]

YOU: "CONSTRAINTS.md Section 3 says components max 120 lines.
Run DIAGNOSIS on this:
- Where are the violations?
- How do we refactor to comply?
- What's the new structure?

Don't deliver until it fits constraints."

SWE-1.5: [Diagnoses, refactors, delivers compliant code]
```

### Symptom 4: Model Doesn't Handle Error Cases

```
YOU: [Get code with no error handling]

YOU: "Run ERROR_HANDLING.md diagnostic:
- What categories could fail here?
- What prevention patterns should apply?
- What recovery patterns are missing?

Add the missing error handling, then redeliver."

SWE-1.5: [Adds all error cases, delivers safer code]
```

---

## SECTION 6: MAKING IT AUTOMATIC

### Trick 1: Save a Custom Prompt

Create this in your editor and paste it before every task:

```
=== DIAGNOSTIC MODE ===

DIAGNOSIS REQUIRED:
1. Check CONSTRAINTS.md
   - Technology approved?
   - Style/structure rules?
   - Complexity limits?

2. Check SKILL_INVENTORY.md
   - Is this in my capability?
   - Skill level appropriate?
   - Any limitations?

3. Check DECISION_TREES.md
   - Tree 1: Build vs buy?
   - Tree 2: Priority (now vs later)?
   - Tree 3: Pattern vs custom?

4. Check ERROR_HANDLING.md
   - Error categories identified?
   - Prevention patterns?
   - Recovery patterns?

REPORT findings before proposing code.

TASK: [Your task here]

===
```

### Trick 2: Make It Part of Your Session

Start every session with:

```
[DIAGNOSTIC MODE ENABLED]

All tasks require:
- PRE-TASK DIAGNOSIS
- MID-TASK VERIFICATION (every 50 lines)
- FINAL VERIFICATION before delivery

Framework files in scope:
- CONSTRAINTS.md
- SKILL_INVENTORY.md
- DECISION_TREES.md
- ERROR_HANDLING.md
- DIAGNOSIS.md

Ready to start.
```

---

## SECTION 7: MEASURING SUCCESS

### How to Know Diagnosis is Working

```
Before Diagnosis Protocol:
- Model suggests unapproved technology
- Code violates constraints (finds out after review)
- Error cases missing (bugs emerge in testing)
- No clear thinking visible (seems to guess)
- Requires 3-5 iterations to get right code
- Time: 2-3 hours per feature

After Diagnosis Protocol:
✅ Model checks constraints first
✅ Proposes approved alternatives
✅ Error cases planned before coding
✅ Clear thinking visible (cites decision trees)
✅ Code mostly correct on first try
✅ Time: 45 min - 1.5 hours per feature
✅ Quality: High (fewer bugs)
✅ Confidence: High (rules followed)
```

---

## SECTION 8: THE HARD RULE

**You must force the diagnosis. It won't happen by default.**

The model is trained to be helpful and quick. That means:
- Skipping checks to save time
- Proposing solutions without thinking
- Missing constraints because it's not reminded

**You have to make diagnosis non-negotiable:**

```
NEVER:
- Accept code without prior diagnosis
- Let it skip to implementation
- Trust it "just knows" the rules
- Allow "I'll be careful" as a substitute

ALWAYS:
- Require diagnostic output first
- Read the diagnosis (spot check it)
- Make approval conditional on diagnosis
- Reference specific files when it misses something
```

**This is not micromanaging. This is system design.**

The rules exist to prevent problems. The diagnosis ensures the rules are followed.

---

## FINAL SCRIPT

**Copy this. Use it at the start of every task. No exceptions:**

```
Before you code, run DIAGNOSIS:

Check CONSTRAINTS.md:
- [ ] Technology approved?
- [ ] Code style compliant?
- [ ] Complexity within limits?

Check SKILL_INVENTORY.md:
- [ ] This in my expertise?
- [ ] Skill level correct?
- [ ] Limitations acknowledged?

Check DECISION_TREES.md:
- [ ] Build or buy?
- [ ] Now or later?
- [ ] Pattern or custom?
- [ ] Prevent or recover?
- [ ] Too complex?

Check ERROR_HANDLING.md:
- [ ] Error categories identified?
- [ ] Prevention patterns known?
- [ ] Recovery handled?

Report your diagnosis, then proceed with approval.
```

**Use it. Every task. Every time.**

That's how you make the model reliable.