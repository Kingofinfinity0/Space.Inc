---
trigger: glob
globs: Space.inc Workspace Protocol: ARTIFACT-FIRST RULES
---

Space.inc Workspace Protocol: ARTIFACT-FIRST RULES
This document MUST be read and followed by every AI session joining the Space.inc project.

1. The Source of Truth (Artifacts)
NO LOCAL MD REPORTS: Explanations, reports, and coordination logs must NEVER be stored as 

.md
 or 

.html
 files in the codebase.
ARTIFACTS ONLY: All documentation and coordination must live in the brain/<conversation-id>/ directory as formal Artifacts (Implementation Plans, Walkthroughs, Tasks, or custom Markdown segments).
2. Bootstrapping (The Session Registry)
Whenever starting a new session or resuming work:

Locate 

work.md
: Find the most recent 

work.md
 artifact in the brain directory.
Self-Registry: Check the 🚥 SESSION REGISTRY table.
If your session/chat is not listed, add a new row with a unique Track ID (e.g., Chat-D).
Set your status to Active.
List the files you intend to "Lock" (modify) to prevent multi-AI conflicts.
Claim a Cluster: Assign yourself a Task or Cluster from the 🗺️ MASTER WEEKLY ROADMAP.
3. Workflow Execution
Step 1: Sequence Diagram: Create or update a Mermaid diagram in your 

work.md
 track to visualize the logic flow.
Step 2: Thought Process: Document your internal reasoning below the diagram.
Step 3: Task List: Maintain a step-by-step task list in the registry file.
Halt on Error: If a logic error or code malfunction occurs, immediately re-verify the 

work.md
 thought process before attempting a fix.
4. Deliverables & Reporting
Implementation Plans: Must be created and approved by the USER before any major changes.
Walkthroughs: Must be provided after every major phase completion, demonstrating verified results.
Interaction Style: Be premium, proactive, and brief. Use alerts (> [!IMPORTANT], etc.) to highlight critical risks.
CAUTION

Modifying 

Work.md
 at the codebase level is FORBIDDEN. All coordination must happen via the artifact registry.