# Archived Goal owners and retained Task links

Single-agent manual desktop verification on native development `/ui` pages at
38379, 38380 and 38381. The user's 18571 page, process and database were outside
the scope. No UI automation tests were added or run.

## Findings and delivered behavior

Archiving a completed Task kept its data but broke its canonical `taskID` link.
The exact global identity query still excluded archives. Fixing that query
exposed a second cause: the frontend cleared a loaded Task when it was outside
the ordinary active list. The exact query now reads retained identity, ordinary
lists keep active visibility, and list refresh no longer owns selected identity.
Explicit committed archive/delete retains the existing matching-Task cleanup.

The final real page opened the same archived Task, read its history and delivered
Python file, restored it, explicitly archived it again, reopened the same link,
and restored it again. Its completed state, 30 transcript messages, 139 events
and turn artifacts stayed exact. Restoring did not execute the Task.

Existing paused/completed Work Goals were actually archived, read and restored:
36,322 tokens/one accepted turn stayed paused; 148,493 tokens/three accepted turns
stayed complete. The paused owner received one normal `owner_archived` revision;
the completed Goal's entire projection stayed exact. Read-only budgets, guide
return, original evidence, English/Chinese controls and restored input focus were
manually reviewed. The closed Mission was archived, reopened and restored with
its two messages and closure intact. Final sidebar navigation returned to it.

## Screenshots

| Files | What was personally inspected |
| --- | --- |
| 01–04 | Original paused Goal, archived read-only details, guide return and restored paused owner |
| 05–08 | Archived completed Goal, disabled budget, Chinese details, restored complete owner |
| 09–10 | Original completed Task and **original broken archived link** |
| 11–13 | Actual closed Mission before archive, archived history, explicit restore |
| 14 | **First candidate failure:** exact backend read succeeded but active-list refresh cleared selection |
| 15–16 | Final original archived Task link, disabled input, completed state and explicit restore |
| 17 | Explicit local Task archive still leaves the selected Task for Home |
| 18–19 | Reopened archived Task delivery and actual readable `counter.py` preview after scrolling |
| 20–21 | Final paused and completed Goal details with original usage/evidence |
| 22–23 | Sidebar transition loading and its **settled** original Mission page; 22 alone is not a pass |

## Native evidence

- `focused-red-exact-*`: the new positive backend regression fails on the
  original implementation. `focused-green-*`: five tests/69 assertions pass
  through real SQLite and Server routes, including ordinary list output,
  exact archived owner, independent Project and restored visibility.
- `build-final-*` and `types-final-*`: ordinary Overlay build/public renderer
  surface and type checking pass. Final published entry `main-CfHqJFgs.js`.
  These checks do not replace screenshots.
- `*-readback.json`: actual selected-item, Goal and history HTTP reads. Task
  root-Session messages are empty and are **not** its transcript; the dedicated
  `before-task-original-conversation-readback.json` and subsequent
  `taskConversation` fields identify the real 30-message/139-event projection.
- `data-qualified.json`: native SQLite `EXCEPT` preserves all 204,326 original
  rows across 92 tables, including full TEXT/BLOB values. Only the three
  operated Sessions' archive/update fields and the operated Task's archive
  field are allowed to change; all owners end restored. Schema remains 9.
  Original source database remains exactly 204,326 rows; final copy has 204,673.
  All 75 original attachment files across six namespaces and all five QA
  projects' Git command results/tracked bytes remain exact, including an unborn
  HEAD and the Task project's pre-existing staged/unstaged changes.
- `publication-qualified.json`: 10 ordinary archive/restore notifications,
  70 successful deliveries, 30 phase receipts, three retired runtime-process
  owners and one expected paused Goal revision explain all additions.
- `physical-retirement.json`: all three native occurrences ended by public
  shutdown 200, original launcher/native exit 0, physical/output/request cleanup
  confirmed. All share the original 60-minute diagnostic deadline; the final
  scope closed more than 16 minutes before it. All copied auth/catalog pairs
  were retired and original source metadata/catalog bytes preserved.
- `final-browser-logs.json`: captured final browser warnings/errors. Visible
  product behavior and screenshots remain the acceptance evidence.

Provider requests in this batch: **0**, prior cumulative count 1,083. Local
Provider registration and paired model-catalog projection do not claim a new
authenticated model request. No Goal create/resume/complete, Send, Task/Mission
execution, permanent deletion, release or tag was performed. The native QA
launch preflight caught a copied diagnostic path, and the collector's paused
baseline reference was corrected; neither was treated as a production failure.

The implementation plan, full root-cause analysis and delivery record are in
[the monthly record](../../records/2026-10/2026-10-30-archived-goal-owner-controls.md).
