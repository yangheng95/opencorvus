---
name: research-report
description: Produce a multi-source research report — comparison matrix, capability survey, market analysis, recommendation document — backed by `websearch` (and `webfetch` only after `websearch` returns a concrete URL). Activate when the deliverable is a markdown report rather than running software, and the work is fundamentally synthesising prose from external sources rather than writing code. Signals — the brief asks for 报告 / 调研 / 对比 / 分析 / 综述 / 功能矩阵 / 评估 / 建议 / report / comparison / matrix / analysis / survey / recommendation; or compares named third-party products / platforms / vendors; or asks for a structured insight + recommendation document. Do NOT activate for code tasks, even when the code happens to consume third-party APIs.
auto_detect:
  task_signals:
    request_text_any:
      - 报告
      - 调研
      - 对比
      - 综述
      - 功能矩阵
      - 评估
      - 建议
      - report
      - comparison
      - matrix
      - survey
      - recommendation
priority: 55
required_tools:
  - websearch
  - webfetch
---

# Research Report Skill

You produce a **multi-source research report** as a single markdown file. The report is the deliverable — there is no code to compile, no UI to render, no test suite to satisfy beyond "the file exists with the required sections and the claims trace back to real sources".

## Tool boundary — do NOT pick the wrong one

- `websearch` — open-ended multi-source synthesis. THIS is your primary tool. Use it for product comparisons, capability matrices, ecosystem surveys, anything where the answer requires aggregating information from sources you cannot enumerate up-front.
- `webfetch` — pull the full content of a specific URL. ONLY call after `websearch` has returned a concrete URL whose deeper content you actually need. Never invent URLs.
- `external_code_search` — narrow programming questions about a specific library / SDK / API. NOT for product / vendor / competitor research, even when the subject is third-party software. If you find yourself reaching for it on a research task, you are about to call the wrong tool.

If the brief is research-shaped (the activation signals above) and you call `external_code_search`, you have misread the task. Stop, switch to `websearch`.

## Process

1. **Read the brief verbatim.** Identify (a) the subjects to compare or analyse, (b) the dimensions or sections the report must cover, (c) the audience and the expected output shape (matrix, narrative, mixed). The brief is the contract — do not silently broaden or narrow scope.

2. **Plan the search queries.** One query per subject + at least one cross-cutting / industry-overview query. For an N-way comparison, plan AT LEAST `N + 1` distinct `websearch` calls. Vary the angle (official capability, third-party review, user feedback, recent news) so you are not just reading one source's framing N times.

3. **Search.** Run the planned `websearch` calls. Read the snippets. Note which result URLs are worth fetching in full vs. which give you enough from the snippet alone. Cite the source URL inline next to each non-trivial claim — vendor name, version, date, or specific capability assertion.

4. **Webfetch ONLY when needed.** If a `websearch` result is highly relevant but the snippet is too short for what you need (e.g. a feature matrix, a pricing page, a deep technical doc), call `webfetch` on that exact URL. Do not webfetch every search result reflexively.

5. **Synthesise and write the report.** Produce a single markdown file at the path the Task request specifies (typically `report.md` under the Task directory). The report should contain whatever sections the brief calls for; a comparison-shaped brief typically wants:
   - **概述 / Overview** — one paragraph framing what is being compared and why.
   - **功能矩阵 / Capability Matrix** — a markdown table with subjects as columns and dimensions as rows, with concise per-cell entries and a citation footnote where a claim is non-obvious.
   - **关键洞察 / Key Insights** — bulleted observations that emerge from the matrix, each insight backed by one or more matrix cells.
   - **建议 / Recommendations** — actionable, prioritised, scoped to the audience the brief named (product team, engineering, leadership, …).
   - **参考 / References** — the canonical URL list, deduplicated.
     Adapt the section names + ordering to the brief's language. If the brief explicitly enumerates sections, follow that enumeration verbatim.

6. **Self-check before reporting done.** Re-read the report yourself. Every non-obvious claim should have a citation; every section the brief asked for should exist; the recommendations should be concrete enough to act on. Do not pad with filler if a section has nothing real to say — say so explicitly and move on.

## What success looks like

- A single markdown file at the declared path (e.g. `report.md`).
- The brief's required sections all present.
- Every non-trivial factual claim cites a source URL discovered via `websearch` / `webfetch`.
- The matrix (if applicable) is filled in completely — no "TBD" cells; if a value cannot be found, the cell explicitly says so and gives the closest indirect signal.
- Recommendations are prioritised, scoped, and reference the matrix rows they are drawn from.

## What success is NOT

- Generic vendor brochures rephrased into Chinese / English. The whole point of a research report is the synthesis — comparing, contrasting, and recommending — not paraphrasing one source.
- Inventing URLs, version numbers, or capability claims. If `websearch` returns nothing useful for a claim, say so in the report — do not fabricate.
- A `.tsx` / `.ts` file. The deliverable is markdown.
- Multiple files, build outputs, or a test suite. There is no software to test; the acceptance evidence is the report itself.
