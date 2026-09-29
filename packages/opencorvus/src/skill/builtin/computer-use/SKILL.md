---
name: computer-use
description: Operate native desktop apps through OpenCorvus Computer tools when the task requires their visible interface.
---

# Computer Use

Use the Computer tools for native desktop interfaces. Use Browser tools for web pages when available. These tools control the current physical desktop; logical sessions do not provide separate desktops.

## Start from evidence

- `session_create` establishes this run's desktop authority and returns `computer_id` and `display_id`. After the user returns control, call it again to attach the new run, then `observe`.
- `observe` returns the actual screenshot, dimensions and an exact observation identity. Inspect the image and select the intended app/control before input. Coordinates are integer pixels in that returned image, starting at its top left.
- Copy all four binding fields into `act`: `computer_id`, `display_id`, `observation_id`, `observation_digest`. The digest binds the screenshot; copy it verbatim.

## Group predictable actions

`act` accepts an ordered `actions` array. Each action has `kind`: `click`, `type_text`, `keypress`, `scroll`, or `drag`. The current tool schema defines their parameters. For example, after observing a known search field, a short group can click it and type a query. A single action uses a one-element array.

Group actions whose targets and effects are already understood. End the group when the next decision depends on a new page, dialog, focus change or uncertain result. Choose the group size from current evidence; a screenshot/model round trip is not required between every input. Actions run sequentially and the result includes a fresh screenshot when capture succeeds.

- `type_text` sends literal text to the focused control. Use `keypress` for control keys; `keys: ["CTRL", "A"]` is a chord, not two sequential presses.
- `scroll.amount` is a count of lines, unlike Browser pixel deltas. Its point selects the scroll region.
- `drag` takes `from`, `to` pixel points and `durationMs`.
- One observation authorizes one entire group and is consumed at dispatch. Inspect the returned observation and use its new binding for the next group.

## Read results before continuing

The receipt identifies the completed prefix and any failed action by zero-based index. Stop on failure and inspect the returned screen. `COMPUTER_OUTCOME_UNKNOWN` means the failing action may have happened; never replay the group blindly. A transport failure can leave the whole group's outcome unknown: call `observe` and decide from the actual state. If capture failed, explicitly observe again before input.

Input dispatch can finish before the application paints its final state. A fresh screenshot is a point-in-time observation, not a rendering-complete guarantee. If text or a transition is still appearing, observe again instead of repeating the input.

`STALE_OBSERVATION` requires a fresh observation. `COMPUTER_INPUT_OUT_OF_BOUNDS` requires correcting coordinates using the current image dimensions. `COMPUTER_RUN_REVOKED` means the user owns control; wait for return rather than retrying input. For backend errors, read the exact diagnostic; a locked desktop or unavailable native driver needs resolution, not alternate input transports.

Respect the user's authorized scope and leave irreversible external effects for explicit confirmation. Stop on unexpected authentication, permission or target changes. Finish by inspecting the actual requested result. `session_destroy` ends this logical session; it does not close the user's apps. `help` reloads these instructions without interacting with the desktop.
