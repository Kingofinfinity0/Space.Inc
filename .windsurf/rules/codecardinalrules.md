---
trigger: glob
---
# ENGINEERING NON-NEGOTIABLES
## Code Integrity Protocol (Industry Standard)

You are operating at production-grade engineering standards. This means you do not commit the cardinal sins of software engineering. You build like a senior engineer who has accountability for system stability.

---

## THE SIX CARDINAL SINS (Absolutely Forbidden)

### SIN 1 – Modify Core Files Without Dependency Mapping
**What this means:** Before touching a core file (authentication, database, API layer, state management), you must trace every file that imports or depends on it.

**You must NOT:**
- Add parameters to core functions without checking all callers
- Change return types without updating dependent code
- Remove exports from utilities without verification
- Alter core logic without understanding downstream impact

**Before modifying a core file, ask:** What else imports this? Will my change break it?

---

### SIN 2 – Add Imports Without Verification
**What this means:** Every import you add must be verified for compatibility and necessity.

**You must NOT:**
- Import a package without confirming it's already installed
- Add conflicting versions of the same package
- Import something that's already being used elsewhere (use existing imports)
- Create circular dependencies (A imports B, B imports A)

**Before adding an import, verify:** Is this package in package.json? Will it conflict? Is it already available elsewhere in the codebase?

---

### SIN 3 – Break Existing Functionality for New Features
**What this means:** New code must integrate without breaking old code. Period.

**You must NOT:**
- Refactor a function that's used in 5 places and only update 3 of them
- Change how a component renders without checking all its parents
- Modify shared state structure and assume all consumers will adapt
- Add a new required parameter to an existing function

**Before modifying existing code, ensure:** All places that use this will still work. Run mental traces through the codebase.

---

### SIN 4 – Edit Without Understanding Current Behavior
**What this means:** You must fully understand what existing code does before you touch it.

**You must NOT:**
- Modify code you don't fully comprehend
- Delete lines thinking they're unused without verification
- Change logic because you think it's "wrong" without context
- Refactor before understanding why it was written that way

**Before editing any file, ask:** Why does this code exist? What breaks if I change it?

---

### SIN 5 – Skip Error Handling and Edge Cases
**What this means:** Production code handles errors. It doesn't assume happy paths.

**You must NOT:**
- Write code that crashes on empty data
- Add API calls without error boundaries
- Modify state without null checks
- Create logic that fails on unexpected input types

**Before finalizing code, check:** What happens if this input is null? Empty? Wrong type? Network fails?

---

### SIN 6 – Introduce Regressions Without Recognition
**What this means:** If your change breaks something that worked before, you catch it immediately during PHASE 3 (VERIFY).

**You must NOT:**
- Ship code that runs but produces wrong output
- Modify one feature and break another silently
- Change behavior without testing the full flow
- Leave deprecated code paths broken

**After every modification, verify:** Did I break something that worked before? Test the entire affected flow.

---

## THE VERIFICATION CHECKLIST (Before Claiming Success)

After each file modification, you must verify all of these:

- [ ] **No import errors** – All imports exist and are compatible
- [ ] **No broken function calls** – All existing calls to modified functions still work
- [ ] **No circular dependencies** – Nothing imports itself indirectly
- [ ] **No missing dependencies** – All used packages are in package.json
- [ ] **No signature changes** – If you changed function parameters, all callers updated
- [ ] **No state mutations** – State changes don't break other components
- [ ] **No broken exports** – If you removed an export, nothing else imports it
- [ ] **Error handling present** – Edge cases and failures handled
- [ ] **No silent failures** – Code either works or throws clear errors
- [ ] **Backward compatible** – New code doesn't break old functionality

---

## THE ENFORCEMENT RULE

If you encounter an error after modification:

**You have failed SIN recognition.** Return to Phase 1 (ARCHITECT) and trace the dependency chain properly before rebuilding.

Do not iterate blindly. Do not patch errors. Redesign the approach with full visibility of what breaks and why.

This is how senior engineers work. This is industry standard.
