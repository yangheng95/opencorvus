# Run OpenCorvus Missions

A Task is one unit of work. A **Mission** is the Expert Squad surface: it holds an immutable Expert
Squad snapshot and coordinates the Tasks that squad dispatches. Choose deliberately.

- Use a **Task** for one bounded request handled by the default squad.
- Use a **Mission** when the work needs a named Expert Squad, spans several Tasks, or must keep one
  durable thread across many operator turns.

These commands drive an already running server; start one with `serve` first. Every command accepts
`--url` and `--dir`, and `--format json` for machine-readable output.

## Choose an Expert Squad

A Mission's squad snapshot is immutable after creation, so resolve real identifiers first. Never
invent a squad identifier.

```bash
opencorvus mission squads --dir "$PROJECT_DIR" --pillar work
```

The search is bounded to twenty entries per page and reports its own total. Follow `--cursor` when
the total exceeds the page; do not report a truncated page as the full inventory.

## Create and dispatch

Creating a draft holds the operator request without invoking a model. Nothing runs until dispatch.

```bash
opencorvus mission create --dir "$PROJECT_DIR" \
  --pillar work \
  --title "Competitive landscape review" \
  --request "Survey the three named competitors and produce a comparison brief." \
  --squad research-studio

opencorvus mission dispatch "$MISSION_ID" --dir "$PROJECT_DIR"
```

Use `send` to start or resume a Mission in one step. Omit `--mission-id` to start a new Mission;
supply it to resume an existing one.

```bash
opencorvus mission send --dir "$PROJECT_DIR" \
  --pillar work \
  --mission-id "$MISSION_ID" \
  --text "Add the pricing dimension and refresh the brief."
```

Choose `--pillar` the same way as a Task: `code` for repository implementation, debugging,
refactoring, or code review; `work` for research, analysis, writing, and other knowledge artifacts.
The pillar is immutable for the life of the Mission.

`--request-id` makes a dispatch or send idempotent. Replaying the same identifier with a changed
prompt, model, or attachment set is rejected as a conflict rather than silently starting new work.
Reuse it when retrying an ambiguous failure; change it for genuinely new input.

## Observe

```bash
opencorvus mission list --dir "$PROJECT_DIR"
opencorvus mission status "$MISSION_ID" --dir "$PROJECT_DIR" --format json
```

Acceptance is not completion. `status` reports Mission and Task activity as a read-time projection;
`--format json` additionally returns the durable activity cursor, whose `activity_sha256` is the
honest "has anything moved" fingerprint between polls. A quiet event stream is not evidence that the
Mission settled.

A Mission dispatches ordinary Tasks. Observe and steer those through the Task routes documented in
[http-api.md](http-api.md), and answer any pending interaction as documented in
[interactions.md](interactions.md).

## Stop

Aborting ends the active Mission session loop and requires a visible reason:

```bash
opencorvus mission abort "$MISSION_ID" --dir "$PROJECT_DIR" \
  --reason "Operator explicitly requested the Mission stop."
```

Treat abort as destructive. Obtain explicit authority and preserve the exact Mission identifier
before executing it.
