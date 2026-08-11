# Patent Landscape and Prior Art

This clean-room package runs three evidence-only branches in parallel: invention-feature decomposition, reproducible patent search and family/bibliography normalization, and prior-art passage/landscape analysis. `patent-landscape-prior-art-owner` joins them while preserving query coverage, conflicts, gaps, and reviewer decisions.

Use it for a controlled technical evidence pack. It never claims exhaustiveness and does not decide novelty, non-obviousness, patentability, validity, enforceability, infringement, freedom to operate (FTO), claim construction, design-around strategy, or legal status. It does not draft claims, file applications, contact patent offices, or ingest confidential disclosure without explicit authorization. Licensed patent counsel or agent, a professional searcher, a technical subject-matter expert, and records/privacy reviewers retain those decisions.

The sole package Skill is `patent-landscape-prior-art/shared/method`. It is clean-room authored from public patent-office navigation and search-method sources. Rejected upstream candidates and no-copy boundaries are documented under `skills/method/references/`.
