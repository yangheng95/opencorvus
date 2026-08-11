# Source provenance and adaptation boundary

- Package: `medical-device-postmarket-surveillance`
- Package version: `2026.08.11.1`
- Authoring owner: OpenCorvus contributors
- Evidence cutoff: 2026-08-11
- Decision: bounded MIT adaptation plus clean-room evidence governance.
- Original repository: `alirezarezvani/claude-skills`
- Fixed commit: `aa8d778811a557a2c28ccadda4cf3d0bd028a4cc`
- Exact source path: `ra-qm-team/skills/mdr-745-specialist/SKILL.md`
- Fixed source: https://github.com/alirezarezvani/claude-skills/blob/aa8d778811a557a2c28ccadda4cf3d0bd028a4cc/ra-qm-team/skills/mdr-745-specialist/SKILL.md
- Source evidence: 10,406 bytes; blob `8355cd26a6075780c8f45f4250fdd10222d20ddc`; repository 24,273 stars and 3,417 forks at cutoff.
- License closure: fixed MIT license saved byte-for-byte as `UPSTREAM-LICENSE`, 1,072 bytes, SHA-256 `a20126646f93d32a8989c3cf4772d59194f405034f7babe7daebeac22b8ab151`. Root `NOTICE` and `NOTICE.md` returned HTTP 404 at the fixed commit.
- Retained concepts: complaint-to-event-to-trend-to-CAPA/risk-file/PMS/PSUR/PMCF trace structure and explicit role/evidence separation.
- Excluded: classification, compliance conclusions, fixed deadlines/cadence/thresholds, scripts/APIs/EUDAMED actions, causality/seriousness/reportability, recall/field action, submission and clinical action.
- Modification: rewritten as a package-local evidence method with stable IDs, four independent roots, explicit join, five domain assets, conflicting-evidence preservation, jurisdiction versioning and qualified-human boundaries.
- No source grants authority to access live systems, expose personal data, contact external parties, diagnose, submit, recall, change devices or make reserved decisions.
