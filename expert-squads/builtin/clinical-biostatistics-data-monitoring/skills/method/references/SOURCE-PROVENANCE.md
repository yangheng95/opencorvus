# Source provenance and adaptation boundary

- Package: `clinical-biostatistics-data-monitoring`
- Package version: `2026.08.11.1`
- Authoring owner: OpenCorvus contributors
- Evidence cutoff: 2026-08-11
- Decision: bounded MIT adaptation of five clinical-biostatistics Skills plus clean-room evidence and authority governance.
- Original repository: `GPTomics/bioSkills`
- Fixed commit: `076137114dda666202a17d2f6b9a7215cc00c888`
- Exact paths: `clinical-biostatistics/cdisc-data-handling/SKILL.md` (29,287 bytes), `trial-reporting/SKILL.md` (37,769), `missing-data-sensitivity/SKILL.md` (33,517), `multiplicity-graphical/SKILL.md` (25,007), and `adaptive-designs/SKILL.md` (30,698).
- Fixed root: https://github.com/GPTomics/bioSkills/tree/076137114dda666202a17d2f6b9a7215cc00c888/clinical-biostatistics
- Source maturity: 1,157 stars and 195 forks at cutoff.
- License closure: fixed MIT license saved byte-for-byte as `UPSTREAM-LICENSE`, 1,065 bytes, SHA-256 `b6438355ac356d6b2dad8a3a0fafa76d5b8d371ee5fb457d97811132899b986f`. Root `NOTICE` and `NOTICE.md` returned HTTP 404.
- Retained: estimand/SAP/population discipline, CDISC derivation trace, prespecified model/missing/multiplicity/sensitivity structure and blinded independent-monitoring evidence.
- Excluded: code/tools/package versions, hard-coded alpha/p-value/hazard-ratio/sample-size/toxicity/noninferiority/stopping values, automated model choice, unblinding and stop/continue/adapt recommendations.
- Modification: rewritten as one package-local evidence method with stable IDs, role separation, four roots, explicit join, five assets, conflict preservation and qualified review boundaries.
- No source grants authority to access live data, expose participants, unblind, sign, submit, certify or make clinical/regulatory/DMC decisions.
