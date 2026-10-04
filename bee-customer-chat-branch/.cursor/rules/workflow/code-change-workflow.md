---
description: "No code changes unless explicitly told. Check first, then suggest or ask to change. Before features: phased plan in docs/plans and user approval."
alwaysApply: true
---

# Code Change Workflow

## CRITICAL – No Code Changes Unless Explicitly Told

**STRICTLY ENFORCED:**

- **Do NOT change, edit, or apply code** unless the user **explicitly** tells you to change, apply, or implement (e.g. “change it”, “apply”, “implement”, “do it”, “fix it”, “update the code”).
- **Check first**: When asked to review, validate, or check something, **only check**. Report what you find. Do not change code.
- **Then suggest or ask**: After checking, you may **suggest** changes or **ask** “Should I apply this change?” or “Do you want me to update the code?” Do not apply changes until the user says yes.
- **Do not assume**: If the user says “check the registration message” or “validate the flow”, do not edit files. Check and report; only change if they explicitly say to change or apply.

When in doubt: **check and suggest; do not change unless explicitly told.**

---

Before applying new code or large changes, follow the workflow below.

## Before implementing

1. **Implementation details**: Explain what will change, why, and how.
2. **Phased plan**: Break into phases (Phase 1, Phase 2, …). Each phase should be a complete, testable unit. Define what each phase includes (files, components, features) and dependencies.
3. **Plan in docs**: Create a plan file in `docs/plans/` (e.g. `docs/plans/[feature-name]-implementation-plan.md`) with overview, objectives, phases, and estimates.
4. **Wait for approval**: Do NOT implement until the user explicitly approves (e.g. “do Phase 1”, “proceed with Phase 2 and 3”).
5. **Examples**: When useful, show code snippets or examples of what will be implemented.
6. **Clarify**: Ask if anything is unclear.

## When implementing

- Implement only the phases the user approved.
- After a phase, summarize what was done and wait for approval before the next phase.
- Update the plan in `docs/plans/` to mark completed phases.
- If the user says “do Phase X”, do that phase and any prerequisite phases not yet done.

This keeps changes incremental and documented.
