# 95 log consumer closure

## Recall and expanded qualification

Root's whole-source search identified additional JSON/log consumers after the targeted95 investigation. This note closes those exact inputs by following their producer and fields, without treating every JSON.parse as Pino. Only this independent note is modified; no source/tests/checks/SDK/Git/shared indices/runtime/Provider/UI/credentials changed. Earlier95 targeted coverage was incomplete: MCP diagnostic and CORS log assertions are two additional mandatory migrations. Historical actual89 malformed times remain chronology-unknown.

## Newly identified consumers

| Current file / location | Actual producer and use | Required migration |
| --- | --- | --- |
| test/global-chat-start-process.test.ts:115–121 | Child stdout last JSON line from fixture/global-chat-start-process-worker.ts:215 console.log(JSON.stringify(output)); domain Chat replay result. stderr is only retained as failure text. | None: actual result IDs/message replay fields remain unchanged. Do not namespace this independent protocol. |
| test/global-task-request-replay.test.ts:198/212/227,715–721/732 | SQLite allocation/Session/contract JSON, child domain output from fixture/global-task-request-process-worker.ts:167, and allocation.ready.json. | None: durable contract/replay identity and standalone worker output remain unchanged. |
| test/mcp/local-process-diagnostics.test.ts:59–82 | Actual Log.read Pino JSON lines, service=mcp; filters key and inspects diagnostic/startup failure. Its separately parsed MCP child stdin is genuine JSON-RPC. | Move Pino record.key, diagnostic, diagnosticID, cwd, stderr,error to data; keep service/message outside. JSON-RPC parsing remains unchanged. |
| test/mcp/oauth-callback-durable-legitimacy.test.ts:342–346 | Log.read lines are joined unchanged into a bounded parent-log failure diagnostic; stdout/stderr and callback identities are separate public process/state facts. | No field migration: raw log collection still works. Do not change callback state/revision or startup JSON arguments. |
| test/server/cors-response-headers.test.ts:61–68 | Real Log.file Pino JSON; matches requestID/message and proves attachment500 response correlation. | data.requestID/method/path/statusCode; message remains envelope. Actual response/error schema and CORS remain unchanged. |
| script/cli-run-check.ts:145–180 | Actual CLI `run --format json` stdout events; src/cli/cmd/run.ts:425–426 writes {type,timestamp,sessionID,...data}. Pino stderr remains a raw diagnostic string. | None: CLI event type/timestamp/Session contract is independent. Do not rename its `timestamp` or nest its event data. |
| benchmark/external-agent/run-automationbench.ts:355–370,936/1731 | jsonLines helper is used only on bridgeEventsPath=automationbench-events.jsonl (:721). Python automationbench_bridge.py:133–137 writes sequence/ts/kind data. | None: actual bridge protocol is not Pino. |
| same run-automationbench.ts:1596,2083–2103 | Actual Log.file path is captured, then raw text redacted and copied to opencorvus-runtime.log. | No parsed field migration; raw text redaction/archive continues. It does not parse or infer Pino chronology. No credentials were read during this source review. |
| catalog-automationbench-evidence.ts:349–363 | JSON of terminal board/transcripts/usage/trace and Python automationbench-events.jsonl. | None: domain evidence schemas remain intact. |
| diagnose-automationbench-bridge.ts:70/120 | Python bridge ready {port} and its explicit --events ledger; filters real kind=score/tool/tool_error. | None: independent bridge event schema. |
| diagnose-automationbench-isolation.ts:51/131 | Bridge ready {port} and independent Python isolation probe stdout JSON uid/world audit. | None: not backend logger output. |
| verify-automationbench-evidence.ts:428–445/617 | Same board/transcript/Trace JSON plus Python event ledger, scorer replay/protected-root metadata. | None: event.kind/sequence/ts stay domain authority. |

Source searches additionally found test/test-runner-runtime-isolation.test.ts:95 reading only Log.file path for actual containment, and server/file-save-conflict.test.ts:39 archiving raw peer stdout/stderr to .log. Neither parses Pino subject fields. Other .log filenames in engine-git/permission/process tests are file resources or independent sidecar contracts; they are not Log emit consumers. Production JSON readers such as ripgrep JSONL, PTY RPC and package capsule RPC are independent schemas and must not be keyword-migrated.

## Complete current parsed-Pino migration set found in repository

Mandatory production writer/parser changes remain src/util/log.ts, src/util/log-support-bundle.ts and Overlay src/utils/log.ts. Public app log endpoints transport raw lines/bytes; POST service/level/message/extra input remains unchanged. The parsed script consumers are script/skill-mount-cold-start-check.ts, script/http-exception-response-real.ts and script/server-restart-e2e.ts, with exact field movement documented in95-final note. The expanded parsed tests are log-lifecycle.test.ts, skill-read-diagnostics.test.ts, session-directory-filter.test.ts, mcp/local-process-diagnostics.test.ts and server/cors-response-headers.test.ts. Overlay log-utils.test.ts is pure parsed-data testing; no DOM/render tests are admitted. script/skill-mount-cold-start-contract.test.ts observation fixtures must use actual nested subject objects.

fixture/log-debug-child.ts returns raw actual fileRecords, not a flattened summary; its service filter remains envelope and requires no subject-field rewrite. Parent log-lifecycle projection moves status/count/iteration into data. Backend logger lifecycle tests retain exact real destination/flush/ZIP checks. MCP local-process JSON-RPC tests remain unchanged except the genuine Pino assertion portion. No compatibility flat reader is proposed.

This closure used whole test/script Log.read/file scans, known logfile names and the named benchmark JSON producers. External tooling and ignored .tmp/private helpers are not a tracked-source closure claim; Root owns their precise real adaptation. No check was run to substantiate output migration yet.

## Current architecture owner clarification

Read03-control and07-panel current sections/searches: neither contains a dedicated Pino/envelope/log-support-bundle schema section.03-control describes durable Task/Session/control occurrences and terminal authority, not logger event chronology.07-panel's displayed timestamps and task.activity timestamps are message/durable observation facts, not Pino timestamps. The earlier note's proposed03/07 log sections were suggested additions, not existing sections that had already specified the data namespace.

Minimum documentation update after admission is a small backend diagnostic-envelope subsection in existing03-control (logging is diagnostic; canonical event time does not replace durable occurrence timestamps), plus a short current LogViewer/export subsection in07-panel (canonical data/unknown historical chronology/raw preserved). Do not alter unrelated message timestamps, session.activity computation, Trace schema, benchmark event protocol or generate SDK types for raw log line fields. Root controls documents/shared indices and implementation admission.

## Remaining implementation risks and acceptance

Additional mandatory MCP/CORS field migrations must be included before the first new baseline; otherwise real errors will falsely appear uncorrelated. Preserve raw callbacks/worker failure evidence rather than weakening assertions. Original real log time vs subject entity time are different facts, and CLI/bridge timestamps are third independent protocol facts; the logger namespace change affects only the Pino source.

Positive checks should correlate real HTTP requestID with data.requestID and original status/error; preserve actual local MCP diagnostic redaction/error output under data; retain unchanged Global Chat/Task result IDs, CLI stdout event outputs and bridge protocol if those checks are selected. Running all unrelated model/benchmark workflows is neither necessary nor authorized for this data schema change. Native/visual/log export acceptance remains Root-owned. No source change or successful migration is claimed by this closure note.
