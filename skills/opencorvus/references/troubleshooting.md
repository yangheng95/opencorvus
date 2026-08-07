# Troubleshoot OpenCorvus

Diagnose from the first failing layer. Preserve the original command, exit code, standard error, server response status, request identifier, project directory, Task identifier, and relevant timestamps.

## Command not found

1. Check whether `opencorvus` exists on the executable search path.
2. Check whether a source checkout exists and whether Bun is available.
3. From the checkout, run `bun packages/opencorvus/src/index.ts doctor`.
4. If dependencies are missing, run the documented `bun install` at the repository root and repeat the original command.

Do not substitute a different package-manager installation path.

## Build or doctor failure

1. Record `bun --version`; the repository currently declares Bun `1.3.14`.
2. Run the exact failing build command again from the repository root.
3. Run `doctor --json --refresh` for structured capability evidence.
4. Fix the reported dependency or platform capability, then rerun `doctor` and the original acceptance command.

Warnings are not failures unless `--strict` is requested, but they must remain visible in the report.

## Provider or model failure

1. Run `auth list` without displaying secret values.
2. Run `models --refresh` and confirm the exact `provider/model` identifier.
3. Run `debug config` to inspect resolved configuration and provider enable/disable rules.
4. Confirm that the credential is present in the OpenCorvus process environment, not merely the assistant host's unrelated sandbox.
5. Reproduce with the exact model. Do not silently switch providers or models.

## Server unreachable

1. Read the startup output for the actual host and port.
2. Confirm the server process is still alive.
3. Fetch `/ui/` from the same machine.
4. If authentication is enabled, use the configured username and password through Basic authentication.
5. Check bind address, port conflict, proxy, firewall, and container or virtual-machine boundary.

An HTTP `401` indicates missing or incorrect authentication. A connection refusal indicates no listener at that address. Keep these causes distinct.

## Project or Task request rejected

1. Confirm `x-opencorvus-directory` is an absolute, existing directory visible to the server.
2. Confirm the Task body contains `request` and exact `productPillar` value `code` or `work`.
3. Capture `x-opencorvus-request-id` from the response when present.
4. Read the response body before retrying.
5. Query `/task/<task_id>` by the returned identity; never infer identity from a title or recent ordering.

## Event stream stopped

1. Treat transport disconnect separately from Task state.
2. Read `/task/<task_id>` and `/task/<task_id>/board`.
3. Reconnect the SSE endpoint if the Task remains active.
4. If the Task is terminal, inspect its completion decision and deliverable Artifacts rather than waiting for more events.

## Task failed or appears stuck

1. Read the board, interactions, conversation, and trace surfaces relevant to the Task.
2. Check for an unanswered permission or question interaction.
3. Identify the direct failing tool, provider, session, or evidence dependency.
4. Send precise follow-up input when the Task can continue with new information.
5. Use retry only after the failure cause has changed. Use replan when the plan or request must change.

Do not use database reset, repeated cancellation/restart, or an alternate project directory to hide the cause.

## Escalation report

When unresolved, report:

- expected outcome;
- exact environment and OpenCorvus revision/version;
- exact failing command or request;
- exit code or HTTP status and request identifier;
- project and Task identifiers;
- observed direct cause;
- checks already performed;
- why the remaining blocker cannot be corrected within current authority.
