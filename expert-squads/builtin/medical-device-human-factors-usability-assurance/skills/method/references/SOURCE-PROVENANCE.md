# Source provenance and adaptation boundary

- Package: `medical-device-human-factors-usability-assurance`
- Package version: `2026.08.11.1`
- Authoring owner: OpenCorvus contributors
- Evidence cutoff: 2026-08-11
- Decision: Bounded MIT adaptation of use specification, critical task, formative/summative separation and traceability from sven-jungmann/iec62366-usability-skill at 635077cdabfab79f595f305d9318cbf981a637ff, SKILL.md. Standard text, hard-coded risk ratings, pass/compliance conclusions, participant activity, device changes and submission behavior are excluded; evidence governance is clean-room.
- Fixed source: https://github.com/sven-jungmann/iec62366-usability-skill/blob/635077cdabfab79f595f305d9318cbf981a637ff/SKILL.md
- License closure: https://github.com/sven-jungmann/iec62366-usability-skill/blob/635077cdabfab79f595f305d9318cbf981a637ff/LICENSE; saved `UPSTREAM-LICENSE` SHA-256 `1c7e5c7f27454d81bb05561366ad8f294f1eae49f7d3a60cfa1c697da56861d6` is byte-exact, including upstream trailing spaces. Root `NOTICE` and `NOTICE.md` returned HTTP 404 at the fixed commit.
- Retained concepts: only those named in the decision above.
- Excluded: upstream tools, scripts, network calls, external writes, hard-coded thresholds or deadlines, autonomous actions, and professional conclusions unless explicitly identified otherwise.
- Modification: rewritten as a package-local OpenCorvus evidence method with independent roots, explicit join, stable-ID reconciliation, five domain assets, stop conditions and qualified-human authority boundaries.
- No source grants permission to operate a live system, access credentials, expose personal data, sign, submit, certify, diagnose, release, move funds or make a reserved decision.
