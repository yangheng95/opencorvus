# Operate OpenCorvus

## Choose the operating surface

- Use `run` for a one-off local assistant conversation.
- Use `serve` for durable Tasks, the Overlay user interface, remote channels, or programmatic access.
- Use the HTTP API when another assistant must submit and observe Tasks without driving the user interface.

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

Use retry only for a failed or otherwise retryable Task, and replan when the requested outcome or plan genuinely needs regeneration. Do not repeatedly retry an unchanged root cause.

## Stop safely

For a foreground server, request normal process termination and wait for shutdown settlement. Do not kill the process tree unless graceful shutdown is proven unavailable. Task cancellation and server shutdown are different operations: stopping a server does not prove a Task was accepted, completed, or cancelled.

For recurring monitoring, use the assistant host's scheduler or wake-up capability with bounded checks. Re-read the Task board or event cursor on each wake rather than retaining a busy log listener.
