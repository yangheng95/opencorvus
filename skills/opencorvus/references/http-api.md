# OpenCorvus HTTP API

These examples target the default local base address:

```bash
OPENCORVUS_URL=http://127.0.0.1:7878
PROJECT_DIR=/absolute/path/to/project
```

If `OPENCORVUS_SERVER_PASSWORD` is set on the server, use HTTP Basic authentication. The default username is `opencorvus`:

```bash
curl --user opencorvus "$OPENCORVUS_URL/ui/"
```

Curl prompts for the password without placing it in the command. For unattended requests, use the assistant host's secret-aware HTTP client. Never print the expanded authentication header or password, and never place a password in a shell argument.

## Project directory authority

Send the exact project directory in `x-opencorvus-directory` for project-scoped routes. Task lookup routes that resolve an existing Task identity may not require it, but keeping the directory with Task mutation requests prevents cross-project ambiguity.

## Create a Task

Choose `productPillar` deliberately:

- `code`: repository implementation, debugging, refactoring, or code review;
- `work`: research, analysis, writing, and other knowledge artifacts.

```bash
curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/task" \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  -d '{
    "productPillar": "code",
    "request": "Implement the requested change, verify it, and stop only when it is review-ready or genuinely blocked."
  }'
```

Success is HTTP `202` with:

```json
{
  "task_id": "task-id",
  "project_id": "project-id",
  "directory": "/absolute/path/to/project"
}
```

Capture the returned values; do not recover Task identity from a title.

## Read Task state

```bash
curl --user opencorvus \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  "$OPENCORVUS_URL/tasks"

curl --user opencorvus \
  "$OPENCORVUS_URL/task/$TASK_ID"

curl --user opencorvus \
  "$OPENCORVUS_URL/task/$TASK_ID/board"

curl --user opencorvus \
  "$OPENCORVUS_URL/task/$TASK_ID/status"
```

`/tasks` returns a project board: `tasks` rows plus a lifecycle `summary`. Each row carries
`pending_interactions`, so one request answers both "what is running" and "is anything waiting on an
operator decision".

## Read the Work Ledger

One unified projection of Missions, Tasks, and Chat/Work sessions. Tasks with a Mission root nest
inside that Mission; the rest are top-level rows. Prefer it over polling `/tasks` and `/mission`
separately.

```bash
curl --user opencorvus \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  "$OPENCORVUS_URL/work-ledger"

curl --user opencorvus \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  "$OPENCORVUS_URL/work-ledger/archive"
```

Mission and Task rows both expose `pendingInteractions`. A nonzero count means the work is blocked on
an operator decision, not progressing — answer it as documented in [interactions.md](interactions.md).

The response is cursor-paged with `nextCursor`. When it is not `null`, more rows exist; do not report
a truncated page as the whole ledger.

## Read delivery evidence

```bash
curl --user opencorvus "$OPENCORVUS_URL/task/$TASK_ID/turn-artifacts"
curl --user opencorvus "$OPENCORVUS_URL/task/$TASK_ID/interactions"
```

## Stream Task events

```bash
curl -N --user opencorvus \
  "$OPENCORVUS_URL/task/$TASK_ID/events"
```

SSE is a live progress surface, not the sole durable truth. After disconnect or restart, read the Task and board again.

## Send ordinary follow-up input

```bash
curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/task/$TASK_ID/message" \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  -d '{
    "text": "Use the existing design decision and include the missing migration evidence.",
    "source": "assistant-host"
  }'
```

The response reports `wake_status` as `accepted` or `not_woken`, with a message explaining the result. Inspect that response and the refreshed Task state. Acceptance is not completion.

A terminal Task can reopen on accepted ordinary follow-up input, retaining its history and fixed Expert Squad. Use the same message route for corrected requirements or to continue after resolving a blocker. A new Task is needed when the work requires a different Expert Squad.

## Answer pending interactions

A running Task can pause for an operator decision. These are durable server state, not transport
events, so poll them alongside Task state and after any Server-Sent Events reconnect:

```bash
curl --user opencorvus -H "x-opencorvus-directory: $PROJECT_DIR" "$OPENCORVUS_URL/question"
curl --user opencorvus -H "x-opencorvus-directory: $PROJECT_DIR" "$OPENCORVUS_URL/permission"
```

Reply to a question with one answer array per question, in order, using exact option values:

```bash
curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/question/$REQUEST_ID/reply" \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  -d '{"answers": [["use-existing-migration"]]}'
```

Decide a permission request with one of `allow_once`, `allow_task`, `allow_project`, or `deny`:

```bash
curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/permission/$REQUEST_ID/reply" \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  -d '{"decision": "allow_once", "message": "Operator approved the migration dry run."}'
```

Read [interactions.md](interactions.md) before answering either kind. Unanswered questions expire and
the assistant proceeds on its own assumption.

## Run a Mission

Missions hold an immutable Expert Squad snapshot and coordinate the Tasks that squad dispatches.
Resolve real squad identifiers from `/expert-squad/search`, then create and dispatch through
`/mission/draft` and `/mission/<mission_id>/dispatch`, or start and resume in one step through
`/mission/wake`. Read status from `/mission/<mission_id>/status`.

See [missions.md](missions.md) for the full sequence and the equivalent commands.

## Cancel a Task

Cancellation is destructive and requires a visible reason:

```bash
curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/task/$TASK_ID/cancel" \
  -H "content-type: application/json" \
  -H "x-opencorvus-directory: $PROJECT_DIR" \
  -d '{
    "surface": "api",
    "reason": "Operator explicitly requested cancellation."
  }'
```

Use a shell-native HTTP client on platforms where quoting these examples would alter the JavaScript Object Notation (JSON) body. Preserve the same headers and fields.
