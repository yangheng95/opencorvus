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

The response includes `wake_status` and `should_resume`. Treat `queued` as accepted follow-up work, not completion.

## Retry or replan

```bash
curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/task/$TASK_ID/retry" \
  -H "x-opencorvus-directory: $PROJECT_DIR"

curl --user opencorvus \
  -X POST "$OPENCORVUS_URL/task/$TASK_ID/replan" \
  -H "x-opencorvus-directory: $PROJECT_DIR"
```

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
