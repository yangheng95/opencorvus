# Product iteration evidence — 2026-10-05

This directory holds actual desktop development-page screenshots and sanitized functional acceptance evidence for the [iteration record](../../records/2026-10/2026-10-05-product-iteration.md).

Root manually interacted with the owned development `/ui/` and inspected these screenshots. UI automation was neither run nor added. Light/Chinese desktop views cover initial and saved states; final English/dark views use a temporary 1120×720 viewport, subsequently reset.

| Evidence | Observation |
| --- | --- |
| [01](01-mission-draft-before.png), [06](06-mission-edit-after.png), [07](07-mission-edit-conflict-after.png), [08](08-mission-draft-saved-after.png) | Original card lacked request editing; new editor saves/reopens exact input and retains authored input after a real competing-edit 409. |
| [13](13-mission-long-request-dark-1120.png) | Long English/Chinese request scrolls inside the editor; cancellation and Save remain reachable. |
| [04](04-file-save-shortcut-before.png), [09](09-file-shortcut-saved-after.png), [disk facts](manual-calendar-file-after.json) | Original Ctrl+S left dirty input unsaved. Actual new shortcut writes disk, clears dirty/Save state, and existing Find remains usable. |
| [02](02-scheduled-edit-before.png), [03](03-scheduled-renamed-before.png), [before values](scheduled-before.json) | Actual name-only edit changed a future Friday anchor with 37 seconds to current Monday/zero seconds. |
| [10](10-scheduled-calendar-retained-after.png), [retained/new values](manual-calendar-file-after.json), [14](14-calendar-final-dark-1120.png) | Advanced Friday/seconds persist after rename; actual new weekly editor uses explicit date/day and final two-column layout. [11](11-scheduled-calendar-form-after.png) is the first-pass three-column layout, superseded by 14. |
| [name-only values](weekly-name-only-after.json), [explicit UTC edit](weekly-time-zone-after.json), [15](15-utc-summary-final-dark-1120.png) | Name-only edit retains exact calendar/nextRun. Explicit UTC selection retains date/day/time, changes actual nextRun correctly, and final summary labels UTC. |
| [05](05-saved-model-before.png), [before values](saved-model-before.json), [12](12-saved-model-after.png), [retained values](saved-model-retained-after.json) | Saved target-project model/variant originally appeared as defaults; the new form shows their exact stored identities. |
| [explicit model default](saved-model-default-after.json), [explicit reasoning default](saved-reasoning-default-after.json), [16](16-model-catalog-help-final-dark-1120.png) | Explicit model default clears both overrides; explicit reasoning default retains model only. Final missing-catalog help accurately explains the current options. Between these two cases the owned fixture was explicitly restored through its public API. |
| [real model result](mission-edited-draft-real-01.result.json), [independent SQLite review](mission-edited-draft-real-01.review.json) | Edited request reaches actual accepted Message and exact GPT-6.1 Sol streaming requests; reply 386/112, replay, later draft and physical settlement verified. Auth/models copies are removed. |

The model checker and manual UI cases are separate owned runs; no claim is made that the visible UI arithmetic draft was itself executed. The real checker created no child Task. Schedule cases qualify persisted authoring and nextRun, not timed firing. The model-selection fixture has no inference credentials and makes no provider call. No installer or release acceptance is claimed.
