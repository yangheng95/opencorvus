# Operate OpenCorvus

## Choose the operating surface

- Use `run` for a one-off local assistant conversation.
- Use `serve` for durable Tasks, the Overlay user interface, remote channels, or programmatic access.
- Use the HTTP API when another assistant must submit and observe Tasks without driving the user interface.
- Use the `task`, `ledger`, `mission`, `question`, and `permission` commands to drive an already
  running server from a shell. They are thin clients over the same HTTP routes, and avoid quoting a
  JavaScript Object Notation (JSON) body by hand. They never start a server; they require one.

Every one of these accepts `--url` (or `OPENCORVUS_URL`), `--dir` for the server-side project
directory, and `--format json` for machine-readable output. Basic credentials are read from
`OPENCORVUS_SERVER_PASSWORD` and `OPENCORVUS_SERVER_USERNAME` in the process environment; there is no
password flag, so a secret cannot reach shell history or a process listing.

`run` covers only a single assistant conversation. Expert Squad orchestration, operator questions,
and permission decisions are not reachable from it — see [missions.md](missions.md) and
[interactions.md](interactions.md).

## Run one local request

From the target project directory:

```bash
opencorvus run "Inspect this repository and explain its current architecture."
```

Useful options:

```bash
opencorvus run "Implement the requested change and verify it." \
  --dir /absolute/path/to/project \
  --model provider/model-id \
  --format json
```

Use `--continue` to continue the last root session, or `--session <session-id>` for an exact session. Use `--fork` only with one of those continuation selectors. Use `--attach http://127.0.0.1:7878` to run through an existing server and `--dir` to identify the server-side project directory.

## Start the headless service

Keep a stable absolute project directory:

```bash
export OPENCORVUS_SERVER_PASSWORD='<secret-from-secure-input>'
opencorvus serve --hostname 127.0.0.1 --port 7878 --project-dir /absolute/path/to/project
```

Source-checkout equivalent:

```bash
bun "$OPENCORVUS_SOURCE" serve --hostname 127.0.0.1 --port 7878 --project-dir /absolute/path/to/project
```

The default username is `opencorvus`. Override it with `OPENCORVUS_SERVER_USERNAME` only when required. Keep the password outside configuration committed to the project.

Verify startup by observing both log lines and fetching the real service:

```text
opencorvus server listening on http://127.0.0.1:7878
overlay UI available at http://127.0.0.1:7878/ui/
```

```bash
curl --user opencorvus http://127.0.0.1:7878/ui/
```

Enter the password at curl's prompt. For unattended checks, pass Basic authentication through the assistant host's secret-aware HTTP client; do not expand the password into a shell argument.

Open `http://127.0.0.1:7878/ui/` for human review. Do not expose the service beyond localhost without explicit user authority, authentication, and an appropriate network boundary.

## Observe and guide Tasks

After Task creation, retain:

- `task_id`;
- owning project directory;
- server base address;
- authentication method;
- Task product pillar, `code` or `work`.

Observe progress through the Task event stream and board. Send ordinary user follow-up through `/task/<task_id>/message`. Reserve `inject` and session steering routes for callers that understand their narrower live-execution semantics.

The Work Ledger is the cheapest single poll — one call covers Missions, Tasks, and Chat/Work rows,
and flags blocked work:

```bash
opencorvus ledger list --dir /absolute/path/to/project
opencorvus task list --dir /absolute/path/to/project
opencorvus task status "$TASK_ID" --dir /absolute/path/to/project
```

When Ledger returns `nextCursor`, pass its `updated`, `pinned` and `rowKey` values as
`--cursor-updated`, `--cursor-pinned` and `--cursor-row-key` to the same `ledger list` or
`ledger archive` command. Continue until `nextCursor` is null.

A row marked with pending interactions is blocked on an operator decision, not progressing. Confirm
and answer it:

```bash
opencorvus question list --dir /absolute/path/to/project
opencorvus permission list --dir /absolute/path/to/project
```

An empty list is the healthy steady state. A pending entry means work is waiting on an operator decision; answer it as documented in [interactions.md](interactions.md).

Read delivery evidence before calling a Task done:

```bash
opencorvus task artifacts "$TASK_ID" --dir /absolute/path/to/project
opencorvus task board "$TASK_ID" --dir /absolute/path/to/project
```

After resolving a blocker or changing the requirements, send the concrete update through the same message route. Accepted new input can reopen a terminal Task while preserving its history and fixed Expert Squad. Read the response and subsequent Task evidence before reporting progress.

## Stop safely

For a foreground server, request normal process termination and wait for shutdown settlement. Do not kill the process tree unless graceful shutdown is proven unavailable. Task cancellation and server shutdown are different operations: stopping a server does not prove a Task was accepted, completed, or cancelled.

For recurring monitoring, use the assistant host's scheduler or wake-up capability with bounded checks. Re-read the Task board or event cursor on each wake rather than retaining a busy log listener.
