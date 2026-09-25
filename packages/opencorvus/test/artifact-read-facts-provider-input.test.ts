import { afterEach, describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import {
  completeArtifactReadsBeforePanelAction,
  resolveMissionArtifactReadAcceptancesBeforeCompletion,
  resolvePanelArtifactReadReferencesBeforeAction,
} from "@/agent/artifact-read-facts"
import { Identifier } from "@/id/id"
import { PermissionExecutionResultTable, PermissionLedgerTable } from "@/permission/permission.sql"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Artifact read facts from provider Tool input", () => {
  test("audits a completed panel read from its exact discriminated-union branch", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({
          kind: "mission",
          title: "Provider read facts",
          metadata: {
            mission: {
              id: "provider-read-facts",
              channelKey: "mission:provider-read-facts",
              cwd: project.path,
              productPillar: "code",
              visibleExpertSquadIDs: ["base"],
            },
          },
        })
        const now = Date.now()
        const taskID = "task-provider-read-facts"
        const locatorRef = "al_1234567890abcdef"
        const readRef = "ar_1234567890abcdef"
        const terminalReference = {
          terminalEventID: "evt_provider_read_fact",
        }
        const locator = {
          source: "engine_artifact" as const,
          artifact_id: "art_provider_read_fact",
          catalog_revision: 7,
          expected_sha256: "b".repeat(64),
        }
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: now },
          agent: "mission",
          model: { providerID: "openai", modelID: "gpt-5.6-terra" },
        })
        const readMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 1 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "tool-calls",
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: "call_unrelated_panel_fact",
          tool: "panel_query_task",
          state: {
            status: "completed",
            input: { taskID: "unrelated" },
            output: JSON.stringify({ ok: true }),
            title: "Unrelated panel fact",
            metadata: { truncated: false },
            time: { start: now + 1, end: now + 2 },
          },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: "call_provider_read_fact",
          tool: "panel_read_task_artifact",
          state: {
            status: "completed",
            input: {
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
            },
            output: JSON.stringify({
              taskID,
              terminal_lifecycle_reference: terminalReference,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              artifact_read_ref: readRef,
              locator,
              media_type: "application/json",
              byte_start: 0,
              byte_end: 1,
              next_offset: null,
              total_bytes: 1,
              complete: true,
              sha256: locator.expected_sha256,
              text: "x",
              attachment: false,
            }),
            title: "Task Artifact",
            metadata: { truncated: false },
            time: { start: now + 1, end: now + 2 },
          },
        })
        const batchLocators = [0, 1].map((index) => ({ ...locator, artifact_id: "art_batch_" + index }))
        const batchInputs = batchLocators.map((_, index) => ({
          taskID,
          artifact_transport_version: 2,
          artifact_locator_ref: "al_batchreference0" + index,
          byte_offset: 0,
          max_bytes: 64,
          delivery: "inline",
        }))
        const batchReferences = ["ar_batchreference00", "ar_batchreference01"]
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: "call_batch_read_facts",
          tool: "panel_read_task_artifact",
          state: {
            status: "completed",
            input: { reads: batchInputs },
            title: "Batch reads",
            metadata: { truncated: false },
            output: JSON.stringify({
              results: batchLocators.map((current, index) => ({
                request_index: index,
                value: {
                  taskID,
                  terminal_lifecycle_reference: terminalReference,
                  artifact_transport_version: 2,
                  artifact_locator_ref: batchInputs[index]!.artifact_locator_ref,
                  artifact_read_ref: batchReferences[index],
                  locator: current,
                  media_type: "application/json",
                  byte_start: 0,
                  byte_end: 1,
                  next_offset: null,
                  total_bytes: 1,
                  complete: true,
                  sha256: current.expected_sha256,
                  text: "x",
                  attachment: false,
                },
              })),
              complete: true,
              next_reads: [],
            }),
            time: { start: now + 1, end: now + 2 },
          },
        })
        const deferredReadRef = "ar_deferredread0000"
        const deferredCallID = "call_provider_deferred_read_fact"
        const deferredPartID = Identifier.ascending("part")
        const deferredOutput = JSON.stringify({
          taskID,
          terminal_lifecycle_reference: terminalReference,
          artifact_transport_version: 2,
          artifact_locator_ref: locatorRef,
          artifact_read_ref: deferredReadRef,
          locator,
          media_type: "application/json",
          byte_start: 0,
          byte_end: 1,
          next_offset: null,
          total_bytes: 1,
          complete: true,
          sha256: locator.expected_sha256,
          text: "x",
          attachment: false,
        })
        await Session.updatePart({
          id: deferredPartID,
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: deferredCallID,
          tool: "panel_read_task_artifact",
          state: {
            status: "running",
            input: {
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
            },
            time: { start: now + 2 },
          },
        })
        const permissionRequestID = Identifier.ascending("permission")
        const permissionAttemptID = Identifier.deterministic("permission", `attempt\0${permissionRequestID}`)
        Database.use((db) => {
          db.insert(PermissionLedgerTable)
            .values({
              id: Identifier.ascending("permission"),
              request_id: permissionRequestID,
              project_id: Instance.project.id,
              session_id: session.id,
              message_id: readMessage.id,
              tool_call_id: deferredCallID,
              event_type: "requested",
              mode: "ask",
              policy_revision: "provider-read-facts",
              provider_kind: "builtin",
              provider_id: "test",
              provider_digest: "provider-read-facts",
              tool_name: "panel_read_task_artifact",
              effect_class: "read",
              scope_version: "1",
              scope: {},
              fingerprint: "provider-deferred-read",
              summary: "Read one exact Task Artifact",
              time_created: now + 2,
            })
            .run()
          db.insert(PermissionExecutionResultTable)
            .values({
              attempt_id: permissionAttemptID,
              result: {
                kind: "json",
                value: {
                  title: "Deferred Task Artifact",
                  output: deferredOutput,
                  metadata: { truncated: false },
                },
              },
              time_created: now + 2,
            })
            .run()
        })
        await Session.updatePart({
          id: deferredPartID,
          sessionID: session.id,
          messageID: readMessage.id,
          type: "tool",
          callID: deferredCallID,
          tool: "panel_read_task_artifact",
          state: {
            status: "completed",
            input: {
              taskID,
              artifact_transport_version: 2,
              artifact_locator_ref: locatorRef,
              byte_offset: 0,
              max_bytes: 65_536,
              delivery: "inline",
            },
            output: deferredOutput,
            title: "Deferred Task Artifact",
            metadata: { truncated: false },
            time: { start: now + 2, end: now + 3 },
          },
        })
        const deferredReferencePlan = Database.allFinalized<{ detail: string }>(
          `
          EXPLAIN QUERY PLAN
          SELECT attempt_id
          FROM permission_execution_result
          WHERE CASE
            WHEN json_extract(result, '$.kind') = 'json'
              AND json_valid(json_extract(result, '$.value.output'))
            THEN json_extract(json_extract(result, '$.value.output'), '$.artifact_read_ref')
          END = '${deferredReadRef}'
        `,
        ).map((row) => row.detail)
        expect(deferredReferencePlan.join("\n")).toContain("permission_execution_result_artifact_read_reference_idx")
        const deferredOutcomePlan = Database.allFinalized<{ detail: string }>(
          `
          EXPLAIN QUERY PLAN
          SELECT request_part_id
          FROM tool_part_outcome
          WHERE json_extract(data, '$.resultAttemptID') = '${permissionAttemptID}'
        `,
        ).map((row) => row.detail)
        expect(deferredOutcomePlan.join("\n")).toContain("tool_part_outcome_result_attempt_idx")
        const activeLocator = {
          ...locator,
          artifact_id: "art_active_observation",
          expected_sha256: createHash("sha256").update("{}").digest("hex"),
        }
        const activeReadRef = "ar_activeinspect001"
        const terminalPartialRef = "ar_terminalpartial1"
        for (const active of [true, false]) {
          const reference = active ? activeReadRef : terminalPartialRef
          const byteStart = active ? 0 : 1
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: session.id,
            messageID: readMessage.id,
            type: "tool",
            callID: `read-observation-${active}`,
            tool: "panel_read_task_artifact",
            state: {
              status: "completed",
              input: {
                taskID,
                artifact_transport_version: 2,
                artifact_locator_ref: locatorRef,
                byte_offset: byteStart,
                max_bytes: 65536,
                delivery: "inline",
              },
              output: JSON.stringify({
                taskID,
                terminal_lifecycle_reference: active ? null : terminalReference,
                ...(active
                  ? { active_execution_reference: { openedEventID: "pev_active_read", executionEpoch: 1 } }
                  : {}),
                artifact_transport_version: 2,
                artifact_locator_ref: locatorRef,
                artifact_read_ref: reference,
                locator: activeLocator,
                media_type: "application/json",
                byte_start: byteStart,
                byte_end: 2,
                next_offset: null,
                total_bytes: 2,
                complete: true,
                sha256: activeLocator.expected_sha256,
                text: active ? "{}" : "}",
                attachment: false,
              }),
              title: "Local observation fact fixture",
              metadata: {},
              time: { start: now + 2, end: now + 3 },
            },
          })
        }
        await Session.updateMessage({
          ...readMessage,
          time: { ...readMessage.time, completed: now + 3 },
          finish: "tool-calls",
        })
        const mutationMessage = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          parentID: user.id,
          role: "assistant",
          author: "mission",
          time: { created: now + 3 },
          agent: "mission",
          providerID: "openai",
          modelID: "gpt-5.6-terra",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: mutationMessage.id,
          type: "step-start",
        })
        const mutationPart = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: mutationMessage.id,
          type: "tool",
          callID: "complete-panel-action",
          tool: "panel_complete_mission",
          state: { status: "running", input: {}, time: { start: now + 4 } },
        })

        expect(
          completeArtifactReadsBeforePanelAction({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            taskID,
          }),
        ).toEqual([activeLocator, ...batchLocators, locator])
        expect(() =>
          resolveMissionArtifactReadAcceptancesBeforeCompletion({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            acceptances: [{ taskID, terminalLifecycleReference: terminalReference, references: [activeReadRef] }],
          }),
        ).toThrow("Artifact read does not belong to the accepted Task terminal occurrence")
        expect(() =>
          resolvePanelArtifactReadReferencesBeforeAction({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            taskID,
            observation: { terminal_lifecycle_reference: terminalReference },
            references: [terminalPartialRef],
          }),
        ).toThrow("not backed by a complete persisted read")
        expect(
          resolveMissionArtifactReadAcceptancesBeforeCompletion({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            acceptances: [
              {
                taskID,
                terminalLifecycleReference: terminalReference,
                references: [deferredReadRef],
              },
            ],
          }),
        ).toEqual([{ taskID, evidenceLocators: [locator] }])
        expect(
          resolveMissionArtifactReadAcceptancesBeforeCompletion({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            acceptances: [{ taskID, terminalLifecycleReference: terminalReference, references: batchReferences }],
          }),
        ).toEqual([{ taskID, evidenceLocators: batchLocators }])
        expect(
          resolveMissionArtifactReadAcceptancesBeforeCompletion({
            sessionID: session.id,
            assistantMessageID: mutationMessage.id,
            toolPartID: mutationPart.id,
            acceptances: [{ taskID, terminalLifecycleReference: terminalReference, references: [batchReferences[1]!] }],
          }),
        ).toEqual([{ taskID, evidenceLocators: [batchLocators[1]] }])
      },
    })
  })
})
