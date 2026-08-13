---
name: browser-evidence-acceptance
description: Plan and execute bounded real-browser research and UI acceptance with current page evidence, safe interaction boundaries, and independent parallel observation and criterion-checking workers. Use when rendered state, navigation, or visible interaction behavior must be verified rather than inferred from code or fixtures.
---

# Browser Evidence Acceptance

Turn a browser-dependent request into observable criteria, collect evidence on the real page, and stop as soon as the declared goal is proved or a user-owned blocker is reached.

## Define the observation contract

1. State one observable goal.
2. Bound the target pages, initial state, viewport or locale constraints, allowed mutations, and authenticated-state assumptions.
3. Write criterion rows with the expected visible outcome and required evidence type.
4. Split content and visual observation from interaction scenarios so those branches can run independently.
5. Define terminal success, failure, blocked, and unverified conditions before browsing.

## Observe before acting

- Start from the shortest safe path to the target state.
- Inspect semantic page state first. Capture screenshots when composition, rendering, or a state transition matters, or when semantic observation is insufficient.
- Record the current URL, timestamp, visible state, and evidence locator for each claim.
- Re-observe after navigation or a material state change. Treat old element references as expired.
- Keep user-owned tabs read-only unless interaction is explicitly authorized.

## Exercise interactions safely

- Execute only scenarios declared in the plan.
- Record initial state, action, visible transition, result, and evidence locator.
- Pause for login, CAPTCHA, one-time passwords, payment, destructive actions, permission expansion, or sensitive-data access.
- Do not brute-force challenges, harvest secrets, or broaden access to finish a criterion.
- Stop immediately when the observable goal is satisfied.

## Judge independent evidence

Each worker decides only its allocated criteria from evidence it personally observed. The Orchestrator compares both complete outputs. A pass requires evidence from the declared page and state; disagreement, stale evidence, and coverage gaps remain explicit.

## Provenance

This method adapts bounded observation, session safety, semantic-first inspection, reference invalidation after navigation, and human-controlled challenge handling from Tencent BrowserSkill. It does not embed BrowserSkill or require its `bsk` command protocol. Read `references/upstream.md` when auditing the adaptation and `references/upstream-license.txt` for the upstream license text.
