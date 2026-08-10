---
name: healthcare-operations-method
description: Build de-identified healthcare operations improvement packs from service-flow, capacity and access, safety, and privacy evidence. Use for operational decision support that must preserve clinical authority, privacy, uncertainty, and accountable review.
---

# Healthcare operations method

## Workflow

1. Freeze the service boundary, dates, decision owner, allowed sources, privacy constraints, and prohibited actions.
2. De-identify inputs and classify statements as observation, documented claim, inference, unknown, or decision.
3. Run service-flow, capacity/access, and safety/privacy analysis independently.
4. Join only after all three reports exist; preserve conflicts, missing evidence, and affected groups.
5. Compare options by supported access, safety, workload, reversibility, and verification evidence.
6. Publish owners, clinical and administrative approvals, safe pilots, measures, rollback triggers, and unresolved uncertainty.

## Boundaries

- Do not accept protected health information, diagnose, prescribe, triage, schedule care, or make patient-specific decisions.
- Do not certify safety, privacy, or regulatory compliance. Authorized clinical, privacy, safety, and administrative owners retain those decisions.
- Use `assets/healthcare-operations-register.md` for the final pack.

## Authorship

Clean-room OpenCorvus method. It does not copy third-party Skill text or require an external tool.
