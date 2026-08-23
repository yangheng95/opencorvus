import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import {
  auditTaskTraceScopeSeal,
  auditLegacyTraceEnvironmentAttestation,
  completeTaskTraceReceipt,
  LEGACY_TRACE_ATTESTATION_KIND,
  LEGACY_TRACE_ATTESTATION_LIMITATION,
  TASK_TRACE_DEFAULT_EVENT_BYTES,
  TASK_TRACE_LIVE_TAIL_BYTES,
} from "../../script/benchmark/external-agent/contract"
import { readCompleteTaskTraceEvents } from "../../script/benchmark/external-agent/trace-evidence"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe("complete benchmark Task trace evidence", () => {
  test("seals every canonical event when the live bounded projection exceeds two MiB", async () => {
    const runtimeRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-complete-trace-"))
    temporaryRoots.push(runtimeRoot)
    const taskID = "tsk_complete_trace_contract"
    const tracePath = ProjectRuntimePaths.taskAbsoluteFromRuntimeRoot(runtimeRoot, taskID, "trace.jsonl")
    await fs.mkdir(path.dirname(tracePath), { recursive: true })
    const sourceEvents = Array.from({ length: 5_000 }, (_, index) => ({
      ts: 1_000 + index,
      kind: "llm_request",
      taskID,
      sessionID: `ses_${Math.floor(index / 100)}`,
      agentName: "base-developer",
      payload: { sequence: index, promptComposition: { digest: String(index).padStart(8, "0") }, padding: "x".repeat(480) },
    }))
    const source = sourceEvents.map((event) => JSON.stringify(event)).join("\n") + "\n"
    expect(Buffer.byteLength(source)).toBeGreaterThan(2 * 1024 * 1024)
    await fs.writeFile(tracePath, source, "utf8")

    const events = await readCompleteTaskTraceEvents({ traceDir: runtimeRoot, taskID })
    const receipt = completeTaskTraceReceipt([taskID], events)

    expect(events).toHaveLength(sourceEvents.length)
    expect(events[0]?.payload.sequence).toBe(0)
    expect(events.at(-1)?.payload.sequence).toBe(sourceEvents.length - 1)
    expect(receipt).toEqual({
      schema_version: 1,
      kind: "complete_post_quiescence_task_trace",
      passed: true,
      task_ids: [taskID],
      tasks: [
        {
          task_id: taskID,
          event_count: sourceEvents.length,
          events_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
      ],
      violations: [],
    })
    expect(completeTaskTraceReceipt([taskID], events)).toEqual(receipt)
    expect(
      auditTaskTraceScopeSeal({
        taskIDs: [taskID],
        traceEvents: events,
        tracedSessionIDs: [...new Set(events.map((event) => event.sessionID))].sort(),
        declaredScope: {
          kind: "task_bound_agent_trace",
          mission_session_traced: false,
          mission_usage_preserved_in_provider_ledger: true,
          traced_session_ids: [...new Set(events.map((event) => event.sessionID))].sort(),
          complete_task_trace: receipt,
        },
      }),
    ).toMatchObject({ passed: true, mode: "complete_post_quiescence", violations: [] })
  })

  test("represents a zero-child Mission with an exact empty complete trace", () => {
    expect(completeTaskTraceReceipt([], [])).toEqual({
      schema_version: 1,
      kind: "complete_post_quiescence_task_trace",
      passed: true,
      task_ids: [],
      tasks: [],
      violations: [],
    })
  })

  test("preserves a legacy trace below the physical tail-mode lower bound", () => {
    const taskID = "tsk_legacy_complete_trace"
    const events = [
      {
        ts: 1,
        kind: "llm_request",
        taskID,
        sessionID: "ses_legacy",
        agentName: "base-planner",
        payload: { promptComposition: { digest: "legacy" } },
      },
    ]
    expect(
      auditTaskTraceScopeSeal({
        taskIDs: [taskID],
        traceEvents: events,
        tracedSessionIDs: ["ses_legacy"],
        legacyDefaultBoundAttested: true,
        declaredScope: {
          kind: "task_bound_agent_trace",
          mission_session_traced: false,
          mission_usage_preserved_in_provider_ledger: true,
          traced_session_ids: ["ses_legacy"],
        },
      }),
    ).toMatchObject({ passed: true, mode: "legacy_operator_attested_tail_lower_bound", violations: [] })
  })

  test("accepts an explicit post-hoc legacy environment evidence contract", () => {
    expect(
      auditLegacyTraceEnvironmentAttestation({
        schema_version: 1,
        kind: LEGACY_TRACE_ATTESTATION_KIND,
        created_at: 1,
        event_max_bytes: TASK_TRACE_DEFAULT_EVENT_BYTES,
        runs: ["ca04c80a-fb39-4f31-b268-2c4c5153be7a"],
        basis: {
          launch_form: "fresh wsl -u root -- bash -lc coordinator process",
          windows_parent_override_present_at_attestation: false,
          wsl_login_override_present_at_attestation: false,
          wsl_pid1_override_present_at_attestation: false,
          profile_files: [
            {
              path: "/etc/environment",
              mtime_ns: 1,
              bytes: 1,
              sha256: "a".repeat(64),
              override_marker_present: false,
            },
          ],
        },
        limitation: LEGACY_TRACE_ATTESTATION_LIMITATION,
      }),
    ).toEqual({
      passed: true,
      run_ids: ["ca04c80a-fb39-4f31-b268-2c4c5153be7a"],
      violations: [],
    })
  })

  test("classifies a real oversized bounded-tail projection with a typed evidence violation", () => {
    const taskID = "tsk_legacy_truncated_trace"
    const canonicalEvents = Array.from({ length: 6 }, (_, index) => ({
      ts: index,
      kind: "llm_request",
      taskID,
      sessionID: "ses_tail",
      agentName: "base-tester",
      payload: { sequence: index, padding: "x".repeat(440_000) },
    }))
    const canonical = canonicalEvents.map((event) => JSON.stringify(event)).join("\n") + "\n"
    expect(Buffer.byteLength(canonical)).toBeGreaterThan(TASK_TRACE_LIVE_TAIL_BYTES)
    const tail = Buffer.from(canonical).subarray(-TASK_TRACE_LIVE_TAIL_BYTES).toString("utf8")
    const returned = tail.slice(tail.indexOf("\n") + 1)
    const projectedEvents = returned
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    const projectedCompactBytes = projectedEvents.reduce(
      (total, event) => total + Buffer.byteLength(JSON.stringify(event)) + 1,
      0,
    )
    expect(projectedCompactBytes).toBeGreaterThanOrEqual(
      TASK_TRACE_LIVE_TAIL_BYTES - TASK_TRACE_DEFAULT_EVENT_BYTES - 1,
    )
    const audit = auditTaskTraceScopeSeal({
      taskIDs: [taskID],
      traceEvents: projectedEvents,
      tracedSessionIDs: ["ses_tail"],
      legacyDefaultBoundAttested: true,
      declaredScope: {
        kind: "task_bound_agent_trace",
        mission_session_traced: false,
        mission_usage_preserved_in_provider_ledger: true,
        traced_session_ids: ["ses_tail"],
      },
    })
    expect(audit).toMatchObject({
      passed: false,
      mode: "invalid",
      violations: ["complete_task_trace_seal_missing_or_unproven"],
    })
  })
})
