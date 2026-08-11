# Source provenance and clean-room boundary

- Package: `radiation-therapy-physics-quality-assurance`
- Package version: `2026.08.11.1`
- Authoring owner: OpenCorvus contributors
- Evidence cutoff: 2026-08-11
- Decision: clean-room authorship. No candidate text, code, table, formula, threshold, clinical rule or workflow is copied.
- Rejected repository: `CaseMark/skills`
- Fixed commit: `e69795285fb559231b67bd3731c91c640c924a64`
- Rejected exact path: `skills/med/managing-radiation-therapy-planning/SKILL.md`
- Fixed source: https://github.com/CaseMark/skills/blob/e69795285fb559231b67bd3731c91c640c924a64/skills/med/managing-radiation-therapy-planning/SKILL.md
- Candidate maturity at cutoff: 33 stars, 12 forks; file 10,084 bytes; blob `aa23b9b371291ac712ef5b109d31d142e244e0a7`.
- Candidate license: Apache-2.0 at the fixed commit. Root `NOTICE` and `NOTICE.md` returned HTTP 404.
- Rejection reason: the candidate manages clinical treatment planning and embeds prescription/fractionation, target margin, organ-at-risk constraint, treatment-gap and reirradiation behaviour. It does not provide a bounded equipment/TPS/dosimetry QA evidence method and would create unsafe clinical defaults.
- Local method boundary: evidence identity, acceptance/commissioning separation, calibration traceability, source-bound comparison, patient-specific QA trace, change/event chronology, independent audit and qualified review only.
- Excluded: clinical planning, prescription, treatment operation, hard-coded tolerance or clinical values, device/software change, event classification/reporting, external action and return-to-service.
- No source grants authority to expose patient data, operate equipment, treat, sign, submit, certify, release or make a professional decision.
