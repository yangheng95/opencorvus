# Current-version product experience evidence

Owner: [Recall, analysis and acceptance](../../records/2026-10/2026-10-04-product-experience.md).
Version 0.1.23 development `/ui/`, isolated Windows runtime/project, paired
user-authorized OpenAI credentials/catalog. No release/version change.
Screenshots are actual manual interactions, visually inspected; no UI automated
tests or screenshot comparison gates.

## Product evidence

| Area | Before | After |
| --- | --- | --- |
| Desktop geometry | `01-home-before.jpg` | `09-home-900-after.jpg`, `12-conversation-1120-after.jpg`, `27-home-1440.jpg` |
| Empty one-list | `02-one-list-before.jpg` | `22-one-list-after.jpg` |
| Mission search | `06-mission-search-before.jpg` | `10-mission-search-after.jpg` |
| Settings navigation | `07-settings-navigation-before.jpg`, `16-settings-new-chat-before.jpg` | `11-settings-mission-navigation-after.jpg`, `17-settings-new-chat-after.jpg` |
| Provider metadata/colon IDs | `provider-after-old-edit.json` | `provider-after-fixed-edit.json`, `13-provider-edit-after.jpg` |
| Discovery ownership | Delayed catalog, canceled/reopened form | `14-discovery-new-form-after.jpg`, `15-discovered-provider-after.jpg`, `provider-discovered-fixed.json` |
| File reveal/draft | `21-file-reveal-before.jpg`, intermediate `23-file-reveal-after.jpg` | `25-file-draft-preserved.jpg` |
| Mission dispatch replay | Consumed draft prevents same accepted request replay | Real HTTP/SQLite contract: first/replay 200, exact typed conflicts; owner record |
| Draft footer clipping | `26-mission-board-1120.jpg`, `28-mission-board-1440.jpg` | `42-mission-draft-actions-1440-after.jpg`, `43-mission-draft-actions-1120-after.jpg`, `44-mission-draft-actions-zh-after.jpg` |
| Channel scope/status | `30-channel-no-project-before.jpg` | `31-channel-no-project-after.jpg`, `35-channel-status-after.jpg`, `36-channel-unavailable-after.jpg`, `channel-status-facts.json` |
| Resource/form readability | Shared first-load path/issue scope reviewed | `33-skill-resource-after.jpg`, `34-provider-accessibility-after.jpg`, `37-mcp-resource-after.jpg`, `41-scheduled-form-after.jpg` |
| Real Code Chat/archive | Original visible answer and archive count 1 | `32-real-code-chat.jpg`, `39-archive-chat.jpg`, `manual-chat-work.json`; restore count 0 |

`26-home-1120.jpg` and `26-mission-board-1120.jpg` are 1120×720.
Viewport control was bound to another owned tab. Actual dimensions were checked
before saving `27-home-1440.jpg`/`28-mission-board-1440.jpg` (1440×900).
`28` is the draft-footer clipping baseline before its wrap repair.
`29-settings-mcp-empty.jpg` records lazy module failure from rebuilding dist
under this review's own frozen service, not a missing-directory product bug.
The owned service was restarted and original acceptance rerun.
`30-channel-no-project-before.jpg` is the separate reproduced Channel save defect.

## Real model execution

| Checker | Outcome | Exact Sol streaming requests | Evidence |
| --- | --- | --- | --- |
| Task control | Passed ingress/cancel/physical restart | 45 | `task-control-01.result.json`, `.preflight.json`, `.checkpoint.json` |
| Duplex original | Failed checker; Tasks/Mission completed | 70 | `mission-duplex-01.result.json`, `.failures.json`, `.reconciliation-review.json` |
| Duplex repaired | Passed original positive collaboration/terminal/artifact requirements | 53 | `mission-duplex-02.result.json`, `.reconciliation-review.json`, `.artifact.json` |
| Eight chunks original | Failed new checker decision projection; Task completed | 18 | `reader-real-01.result.json` |
| Eight chunks repaired | Passed production reader/bytes/schema/decision | 22 | `reader-real-02.result.json`, `.review.json`, `.task-evidence.json` |
| Eight chunks final direct order | Passed final observer code and production retry | 21 | `reader-real-03.result.json`, `.review.json`, `.task-evidence.json` |
| Manual dispatch 01 | Atomic/replay qualified; teardown interrupted a physical child without Task terminal | 13 | `mission-dispatch-real-01.result.json`, `.review.json` |
| Manual dispatch 02 | Checker inactivity from confusing standby owner with execution | 11 | `mission-dispatch-real-02.result.json`, `.review.json` |
| Manual dispatch final | Atomic consumption, exact replay/new draft, real arithmetic/Artifact/Mission completion and settled execution | 11 | `mission-dispatch-real-03.result.json`, `.review.json` |

Actual requests use `gpt-6.1-sol`, `stream=true`, observed HTTP transport and
accounting. First failures remain retained. Duplex second run did not invoke
`read_agent_message`; separate fresh real Task proves four completed shell
occurrences, eight unique input/output selectors, model-chosen 8×3750 limits,
604 canonical UTF-8 bytes, 38 actual outgoing schema observations and the
accepted Completion Decision. `24-real-mission-artifact.jpg` shows the original
document@1 rendered and visually reviewed in the app, not a recreated summary.
Final reader code adds actual send-before timestamps: eight unique fields,
8×1000 model-chosen limits, 650 exact UTF-8 bytes, prior schema observation
6030ms before Tool start. Twenty HTTP 200 and one HTTP 503 followed by successful
production retry; there is no historical zero-error gate. The second run's
`reader-real-02.order-review.json` is explicitly causal inference, while the
third run provides direct time observations. All six checker rounds total 229
real requests. The three manual-dispatch checker rounds add 35 for a total of
264; manual UI conversation requests are separate. Final dispatch uses the
existing active-execution projection, allows legitimate standby ownership,
and preserves later drafts at the original accepted Message replay boundary.
Its naturally created child set is empty; duplex independently proves children.

Observer hashes describe request-value provenance/identity; variable source
hashes are not functional acceptance gates. Known credentials were redacted by
the existing observer. No auth/model directory or raw credentials are included.
Checker credential cleanup passed; manual-view copies are cleaned separately
and recorded by the owner.

## Limits

Focused tests prove service/error/persistence contracts; they are not visual
or real-model acceptance. Browser acceptance uses desktop development mode.
Native windows/menus, installer publication, other Providers, and third-party
MCP/Channel integrations were not exercised or claimed. Slow resource loading
ownership is source-reviewed; manual fast local page checks validate final
integration without claiming a throttled race experiment.
