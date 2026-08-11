# Transfusion Medicine Blood Component Assurance

Evidence continuity for patient, order, specimen, blood component, compatibility, issue, transfusion, reaction and blood-bank quality records without component-selection or clinical authority.

Use for source-bound transfusion and blood-component evidence reconciliation before qualified review.

The scheduler dispatches 4 independent professional evidence branches, then one explicit join preserves conflicts and produces a qualified-review pack. Every scheduler and worker projects only `transfusion-medicine-blood-component-assurance/shared/method`.

- Do not select, allocate, crossmatch, release, issue, return, discard or transfuse blood components.
- Do not diagnose or classify a transfusion reaction, determine causality/reportability, advise treatment, or communicate with a donor or patient.
- Qualified transfusion medicine physicians, blood-bank technologists, nursing/clinical owners, quality and regulatory staff retain every decision.

Source, license, adaptation and clean-room boundaries are saved under `skills/method/references/`. The five reusable domain assets under `skills/method/assets/` are evidence structures, not completed decisions.
