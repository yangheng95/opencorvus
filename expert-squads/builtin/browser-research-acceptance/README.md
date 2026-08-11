# Browser Research & Acceptance

This package turns a browser-dependent question or acceptance target into one bounded workflow. The planner defines observable criteria first. The evidence observer and interaction auditor then work independently against the same plan. The acceptance reviewer is the explicit join and may decide only from evidence produced by both branches.

The method in `skills/browser-evidence-acceptance` adapts browser-observation and safety ideas from Tencent BrowserSkill at the pinned MIT-licensed revision recorded in the Skill references. It does not embed BrowserSkill, require its CLI, or claim that a static page inspection is an end-to-end browser result.

## Binding workflow

`browser-evidence-acceptance` is the only workflow. The scheduler states its four-node dependency graph before dispatch. The evidence observer and interaction auditor are parallel siblings; the reviewer starts only after both reach terminal success.

## Evidence contract

The plan names every criterion, expected visible outcome, page boundary, permissible interaction, evidence type, and stopping condition. Browser workers use the real page available to their runtime and preserve the observed URL, time, visible state, source locator, and screenshot locator where applicable. The reviewer reports each criterion as pass, fail, blocked, or unverified and never upgrades missing evidence into a pass.

Authentication challenges, one-time codes, payments, destructive actions, and permission expansion stay with the user. Existing user tabs are read-only unless the user explicitly authorizes interaction.
