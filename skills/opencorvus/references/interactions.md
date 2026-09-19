# Answer OpenCorvus interactions

A running Task can pause for an operator decision. Two independent interaction kinds exist, and a
host that never answers them silently changes the outcome of the work.

- **Question**: the assistant asks the operator to choose. Unanswered questions expire at the
  automatic deadline (five minutes by default) and the assistant proceeds on its own assumption.
- **Permission**: the assistant requests authority to run a permission-bearing tool. Raised only when
  the project runs in `permission_mode: ask`. In the default `full_access` mode none is ever raised.

Both are durable server state, not transport events. A disconnected Server-Sent Events (SSE) stream
never loses them; poll the list routes after any reconnect.

## Poll for pending interactions

```bash
opencorvus question list --dir "$PROJECT_DIR" --format json
opencorvus permission list --dir "$PROJECT_DIR" --format json
```

An empty list is the healthy steady state, not a failure. Both commands drive an already running
server; start one with `serve` first. Use `--url` when the server is not at the local default, or set
`OPENCORVUS_URL`.

Equivalent HTTP:

```bash
curl --user opencorvus -H "x-opencorvus-directory: $PROJECT_DIR" "$OPENCORVUS_URL/question"
curl --user opencorvus -H "x-opencorvus-directory: $PROJECT_DIR" "$OPENCORVUS_URL/permission"
```

## Answer a question

Each pending request carries an ordered `questions` array. Supply `--answers` as a JSON array of
answer arrays in that order, using exact option values or authorized custom text. JSON preserves
commas and whitespace inside a value; include multiple values for a question marked `multiple`.

```bash
opencorvus question reply "$REQUEST_ID" --dir "$PROJECT_DIR" \
  --answers '[["use-existing-migration"],["postgres","redis"]]'
```

Reject only when the assistant should proceed without an operator choice:

```bash
opencorvus question reject "$REQUEST_ID" --dir "$PROJECT_DIR"
```

Equivalent HTTP posts `{"answers": [["use-existing-migration"], ["postgres", "redis"]]}` to
`/question/<request_id>/reply`. The API validates the nested string-array shape. Match the pending
request's question order, selection rules and exact option values before submitting.

## Decide a permission request

Read `summary` and the request's own `choices` before deciding. `choices` is the server's authority
on what that specific request accepts — `allow_project` is withheld when the scope is not project
grantable.

```bash
opencorvus permission reply "$REQUEST_ID" --dir "$PROJECT_DIR" \
  --decision allow_once \
  --message "Operator approved the migration dry run."
```

Decisions:

- `allow_once`: authorize this invocation only;
- `allow_task`: authorize this exact scope for the remainder of the Task;
- `allow_project`: authorize this exact scope for the project until revoked;
- `deny`: refuse the invocation.

Prefer `allow_once` unless the user granted broader standing authority. Treat `allow_project` as a
durable configuration change.

Review and withdraw standing authority:

```bash
opencorvus permission grants --dir "$PROJECT_DIR"
opencorvus permission revoke "$GRANT_ID" --dir "$PROJECT_DIR"
```

Equivalent HTTP posts `{"decision": "allow_once", "message": "..."}` to
`/permission/<request_id>/reply`.

## Unattended operation

When running without a human present:

1. Poll both list routes on the same cadence used to poll Task state.
2. Answer only what the user's instructions already determine. Deciding on the user's behalf beyond
   that is not autonomy; it is substituting your judgement for theirs.
3. When an interaction needs authority you do not have, stop and report the exact pending request,
   its summary, and its available choices. Do not reject a question to keep a run moving, and do not
   deny a permission request to avoid asking.
4. Record every decision sent, with its reason, in the final report.
