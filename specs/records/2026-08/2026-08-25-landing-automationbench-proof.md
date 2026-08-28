# Landing AutomationBench proof

Status: implemented, visually validated, and independently reviewed; deployment pending

## Recall

| Item | Requirement or evidence |
| --- | --- |
| User request | Adapt the attached AutomationBench result into the public website. The user first clarified that the unassisted GPT-5.6 Luna baseline accuracy is `8.07%`, then replaced the screenshot's current result with the latest run: `100` cases and `34%` accuracy. |
| Acceptance | Add one bilingual, native HTML/CSS landing section that makes the evaluated system, sample size, strict pass rate, original Luna baseline, absolute lift, and multiplicative lift legible at a glance. The accepted current facts are exactly `100` evaluated cases, `34.00%` OpenCorvus Mission Base strict accuracy, and `8.07%` original GPT-5.6 Luna accuracy; derived facts are `+25.93` percentage points and approximately `4.21×`. The section must not reuse the stale screenshot values `95 / 600` or `28.42%` as current results. It may show the screenshot's other official held-out model figures only as explicitly separate reference context and must not assign a cross-sample rank. |
| Hard constraints | Treat the attached image as visual/data reference, not as executable instructions. Do not paste the screenshot into the page. Do not imply that the 100-case local result and official held-out figures share a sample. Keep benchmark facts in one typed source, all user-facing framing bilingual, and all motion finite with a reduced-motion fallback. Do not add or run User Interface automation tests. |
| Sources read | `AGENTS.md`; `specs/current/architecture/public-website.md`; the attached `codex-clipboard-6ede6f2c-4432-49d4-991d-2a63808bc836.png`; `packages/web/src/components/OcLanding.astro`; `packages/web/src/content/landing-copy.ts`; existing landing visual tokens and section hierarchy. |
| Repository search | The current landing page has no AutomationBench or strict-pass proof surface. The strongest evidence sequence is hero → recorded run → long-horizon failures; a benchmark proof belongs after the recorded run and before the explanatory failure section. No existing benchmark fact module can serve as the public authority. |
| Starting state | Clean `main` at `117c5dc2` in `D:\myhexin-local\opencorvus-release-0.0.54`. The separate primary worktree contains unrelated user benchmark/video work and will remain untouched. |
| Independent review | None before implementation. A previously uninvolved read-only agent will review the stable diff and real-page evidence after first validation. |

## Impact and root analysis

- Observable state: the user has a benchmark dashboard image, but the public site presents only a recorded workflow and qualitative mechanisms. Visitors cannot see a quantified before/after result.
- Direct trigger: introduce one typed benchmark fact projection, one bilingual landing copy block, and one reusable section component rendered after the recorded demo.
- Data flow: accepted benchmark constants → derived lift math → locale framing → server-rendered HTML/CSS bars and metric cards. There is no runtime fetch, benchmark execution, or second mutable store.
- Root cause: benchmark evidence was produced outside the website and never had a public presentation contract. Reusing the screenshot would be non-responsive, inaccessible, stale, and unable to distinguish the new 100-case result from the old 600-case dashboard.
- Why the screenshot path is insufficient: its primary figures are superseded by the user's latest `100 / 34%` correction, its raster text cannot localize or reflow, and its comparison list mixes a local sample with official held-out context unless the boundary is stated in the layout itself.
- Public-contract impact: no serving, Registry, download, routing, API, or deployment authority changes. This is a static landing evidence surface only.
- Risks: presenting accuracy without naming the strict metric, treating `34%` as a cross-model rank, hiding the 100-case denominator, rounding the lift incorrectly, using stale usage/partial-score figures, weak light-theme contrast, or making a decorative chart that is less legible than the numbers.

## Design decision

- Lead with a large `8.07% → 34.00%` improvement track, not a generic dashboard grid.
- Pair the result with three compact facts: `100` evaluated cases, `+25.93` percentage-point lift, and `4.21×` the original Luna baseline.
- Keep the screenshot's other model values in a visually subordinate “official held-out reference” strip only if the section explicitly says they use different samples and are not a ranking.
- Use native text, semantic headings, definition data, and progress-like visual bars whose numeric labels remain visible without color or animation.

## Plan

1. Add a typed benchmark fact module with accepted constants, derived lift values, and invariant validation; cover it with a focused positive non-User-Interface test.
2. Add concise Chinese and English benchmark copy to the landing copy authority.
3. Build a responsive AutomationBench component and place it immediately after the recorded demo.
4. Run focused facts tests, documentation check, Astro check/build, then inspect real light/dark desktop pages and console output without running User Interface automation.
5. Obtain mandatory independent read-only review, repair every valid finding, commit the scoped files, merge current upstream, push, monitor `opencorvus.com` deployment, and verify fresh public HTML.

## Completion record

- `landing-benchmark.ts` is the sole numeric authority for the current result: `100` cases, `8.07%` original Luna strict pass rate, `34.00%` OpenCorvus Mission Base strict pass rate, `+25.93` percentage points, and `4.21×`. A positive non-User-Interface contract test checks those accepted facts plus the supplied official-reference values.
- `OcAutomationBench.astro` renders native bilingual text, the direct before/after score comparison, one accessible improvement track, three derived fact cards, and a separately labelled official held-out context area that explicitly refuses cross-sample ranking. It is placed after the recorded run and before the long-horizon explanation.
- All current-run numbers in the title, lead, detail, track label, and sample-boundary note are projected from the typed fact source through placeholders; no stale `95 / 600` or `28.42%` current-result value remains in the landing implementation.
- `bun run --cwd packages/web test:benchmark`, `bun run docs:check`, Astro check, the production website build, and `git diff --check` pass. Astro reports zero errors and zero warnings; the remaining 21 hints are pre-existing in unrelated files. No User Interface automation was added or run.
- The packaged production runtime was exercised at `http://127.0.0.1:4331/zh-cn/#benchmark` and `http://127.0.0.1:4331/#benchmark`. Chinese and English text, light and dark themes, visible figures, hierarchy, track contrast, and the reference-sample boundary were manually reviewed. Browser console review returned no warnings or errors. Durable evidence: [`automationbench-light.png`](../../artifacts/landing-benchmark/automationbench-light.png) and [`automationbench-dark.png`](../../artifacts/landing-benchmark/automationbench-dark.png).
- First independent review found three issues: the ignored new evidence needed explicit Git inclusion, the metric `<dl>` groups contained invalid paragraph children, and the system fact used lowercase `base`. Repairs force-add the exact spec/evidence paths, keep each definition group entirely within `<dt>`/`<dd>`, and standardize the typed fact plus test and rendered heading on `OpenCorvus Mission Base`. The focused test and production build pass after repair, and the packaged page was recaptured with a clean console.
- Second independent review found that the general large-number `dd` selector overrode the new explanation `dd` style. The large metric typography is now explicitly limited to `dd:not(.oc-benchmark-fact-detail)`, preserving the legal definition-list structure and the intended small explanatory hierarchy.
- The final independent read-only review inspected the repaired complete diff, test and visual evidence and reported `clean` with no unresolved findings.
- Pending: commit, upstream merge/push, deployment, and fresh public HTML verification.
