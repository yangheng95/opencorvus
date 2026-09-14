import { expect, test } from "bun:test"
import { insertPreparedTaskCompletionDecision, prepareTaskCompletionDecision } from "@/engine/completion-decision"
import { requireTaskCompletionDecisionMessage } from "@/engine/completion-decision-read"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { writeTaskUpdateInTransaction } from "@/engine/state"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { panelLeafToolID } from "@/panel/action-ids"
import { PanelQueryTaskOutput } from "@/panel/task-query"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Tool } from "@/tool/tool"
import { PanelLeafTools } from "@/tool/panel"
import { Buffer } from "node:buffer"
import { createHash } from "node:crypto"
import { persistEstablishedTask } from "./fixture/engine-task"
import { memoryProject } from "./fixture/memory"

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.09.14.1",
  packageDigest: "a".repeat(64),
}

async function panelLeaf(action: "query_task" | "read_task_message") {
  const id = panelLeafToolID(action)
  const definition = PanelLeafTools.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Missing Panel leaf ${id}`)
  return { id, tool: await definition.init({ agentID: "mission" }) }
}

test("Mission reads exact participant text named by the current Task Completion Decision", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "mission-completion-message-read",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const taskID = Identifier.ascending("task")
      const taskRoot = Session.prepareRootNext({ kind: "root", directory: project.path, title: "Completion evidence" })
      const createdAt = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: taskRoot,
        now: createdAt,
        title: "Completion evidence",
        request: "Publish and verify the requested business record.",
        productPillar: "work",
        source: "mission",
        metadata: { actor: "mission", mission: { id: mission.missionID, session_id: mission.id } },
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: project.path,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: createdAt,
        }),
      })
      await Session.mergeMetadata({
        sessionID: taskRoot.id,
        patch: { configOverlay: { prompt_profile: { active: packageRevision.id } } },
      })

      const worker = await Session.create({ kind: "assistant", parentID: taskRoot.id, title: "Verifier" })
      const workerInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: worker.id,
        role: "user",
        author: "orchestrator",
        time: { created: createdAt + 1 },
        agent: "base-tester",
        model: { providerID: "test", modelID: "test" },
      })
      let workerFinal = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: worker.id,
        parentID: workerInput.id,
        role: "assistant",
        author: "base-tester",
        time: { created: createdAt + 2 },
        agent: "base-tester",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const workerText =
        "Independent verification PASS: the requested record exists once in the final business state.\n" +
        "持续有效约束与最终状态🙂\n".repeat(1_500)
      const workerTextPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: workerFinal.id,
        type: "text",
        text: workerText,
      })
      const supplementalTextParts = []
      for (let index = 0; index < 16; index += 1) {
        supplementalTextParts.push(
          await Session.updatePart({
            id: Identifier.ascending("part"),
            sessionID: worker.id,
            messageID: workerFinal.id,
            type: "text",
            text: index === 0 ? "A\uFEFFB" : `Supplemental terminal evidence ${index + 1}.`,
          }),
        )
      }
      workerFinal = await Session.updateMessage({
        ...workerFinal,
        time: { ...workerFinal.time, completed: createdAt + 3 },
        finish: "stop",
      })

      const orchestrator = await Session.create({ kind: "orchestrator", parentID: taskRoot.id, title: "Decision" })
      const decisionInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: orchestrator.id,
        role: "user",
        author: "orchestrator",
        time: { created: createdAt + 4 },
        agent: "orchestrator",
        model: { providerID: "test", modelID: "test" },
      })
      const decisionMessage = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: orchestrator.id,
        parentID: decisionInput.id,
        role: "assistant",
        author: "orchestrator",
        time: { created: createdAt + 5 },
        agent: "orchestrator",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: orchestrator.id,
        messageID: decisionMessage.id,
        type: "text",
        text: "The current terminal evidence satisfies every accepted criterion.",
      })
      const decisionCallID = "call-complete-current-evidence"
      const decisionToolPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: orchestrator.id,
        messageID: decisionMessage.id,
        type: "tool",
        callID: decisionCallID,
        tool: "complete_task",
        state: { status: "running", input: {}, time: { start: createdAt + 5 } },
      })
      const completedAt = createdAt + 6
      const prepared = await prepareTaskCompletionDecision({
        taskID,
        visibleToolName: "complete_task",
        payload: {
          orchestrator_session_id: orchestrator.id,
          orchestrator_message_id: decisionMessage.id,
          tool_call_id: decisionCallID,
          tool_part_id: decisionToolPart.id,
          evidence_locators: [
            { source: "session_message", session_id: worker.id, message_id: workerFinal.id },
          ],
          deliverable_artifact_locators: [],
          accepted_delivery_slice_revision_ids: [],
          workflow_binding: {
            kind: "direct",
            package_revision: {
              scope: packageRevision.scope,
              project_id: packageRevision.projectID,
              namespace: packageRevision.namespace,
              id: packageRevision.id,
              version: packageRevision.version,
              package_digest: packageRevision.packageDigest,
            },
          },
          time_recorded: completedAt,
        },
      })
      Database.transaction((db) => {
        const terminal = writeTaskUpdateInTransaction({
          db,
          taskID,
          values: { status: "completed", error: null },
          summary: "Current completion evidence is accepted",
          now: completedAt,
        })
        insertPreparedTaskCompletionDecision(db, prepared, terminal.task)
      })

      const missionInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "orchestrator",
        time: { created: completedAt + 1 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
      })
      const missionAssistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        parentID: missionInput.id,
        role: "assistant",
        author: "mission",
        time: { created: completedAt + 2 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: missionAssistant.id,
        type: "step-start",
      })
      const queryLeaf = await panelLeaf("query_task")
      const readLeaf = await panelLeaf("read_task_message")
      const context = (toolID: string, callID?: string) => ({
        sessionID: mission.id,
        messageID: missionAssistant.id,
        callID,
        agent: "mission",
        abort: new AbortController().signal,
        messages: [],
        executionSurface: Tool.executionSurface([toolID], []),
        extra: { surface: "panel" },
        metadata() {},
        async ask() {},
      })
      const queryCallID = "query-before-completion-message"
      const queryPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: missionAssistant.id,
        type: "tool",
        callID: queryCallID,
        tool: queryLeaf.id,
        state: { status: "running", input: { taskIDs: [taskID] }, time: { start: completedAt + 2 } },
      })
      const queried = await queryLeaf.tool.execute({ taskIDs: [taskID] }, context(queryLeaf.id, queryCallID))
      const terminalReference = requireCurrentTerminalLifecycleReference(taskID)
      expect(PanelQueryTaskOutput.parse(JSON.parse(queried.output)).tasks[0]).toEqual(
        expect.objectContaining({ taskID, status: "completed", terminal_lifecycle_reference: terminalReference }),
      )
      await Session.updatePart({
        ...queryPart,
        state: {
          status: "completed",
          input: { taskIDs: [taskID] },
          output: queried.output,
          title: queried.title,
          metadata: queried.metadata,
          time: { start: completedAt + 2, end: completedAt + 3 },
        },
      })
      let readSequence = 0
      const executeRead = async (input: Record<string, unknown>, label: string) => {
        readSequence += 1
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: missionAssistant.id,
          type: "step-start",
        })
        const callID = `${label}-${readSequence}`
        const part = await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: missionAssistant.id,
          type: "tool",
          callID,
          tool: readLeaf.id,
          state: { status: "running", input, time: { start: completedAt + 3 + readSequence } },
        })
        const result = await readLeaf.tool.execute(input, context(readLeaf.id, callID))
        await Session.updatePart({
          ...part,
          state: {
            status: "completed",
            input,
            output: result.output,
            title: result.title,
            metadata: result.metadata,
            time: { start: completedAt + 3 + readSequence, end: completedAt + 4 + readSequence },
          },
        })
        return JSON.parse(result.output) as Record<string, any>
      }

      const inventory = await executeRead(
        { taskID, sessionID: worker.id, messageID: workerFinal.id },
        "inventory-current-completion-message",
      )
      expect(inventory).toEqual(expect.objectContaining({
        taskID,
        terminal_lifecycle_reference: terminalReference,
        completion_decision_artifact_id: prepared.artifactID,
        mode: "text_part_inventory",
        message: {
          session_id: worker.id,
          message_id: workerFinal.id,
          role: "assistant",
          author: "base-tester",
          agent: "base-tester",
          finish: "stop",
          time_created: createdAt + 2,
          time_completed: createdAt + 3,
        },
        text_part_page: 1,
        text_part_count: 17,
        next_text_part_page: 2,
        complete: false,
      }))
      expect(inventory.text_parts).toHaveLength(16)
      expect(inventory.text_parts[0]).toEqual({
        part_id: workerTextPart.id,
        total_bytes: Buffer.byteLength(workerText),
        sha256: createHash("sha256").update(workerText).digest("hex"),
      })
      const finalInventoryPage = await executeRead(
        { taskID, sessionID: worker.id, messageID: workerFinal.id, text_part_page: 2 },
        "inventory-current-completion-message-page",
      )
      expect(finalInventoryPage).toEqual(
        expect.objectContaining({
          mode: "text_part_inventory",
          text_part_page: 2,
          text_part_count: 17,
          text_parts: [expect.objectContaining({ part_id: supplementalTextParts.at(-1)!.id })],
          next_text_part_page: null,
          complete: true,
        }),
      )
      const bomPrefix = await executeRead(
        {
          taskID,
          sessionID: worker.id,
          messageID: workerFinal.id,
          text_part_id: supplementalTextParts[0]!.id,
          byte_offset: 0,
          max_bytes: 1,
        },
        "read-bom-prefix",
      )
      const bomSuffix = await executeRead(
        {
          taskID,
          sessionID: worker.id,
          messageID: workerFinal.id,
          text_part_id: supplementalTextParts[0]!.id,
          byte_offset: bomPrefix.text_part.next_offset,
          max_bytes: 4,
        },
        "read-bom-suffix",
      )
      expect({
        first: bomPrefix.text_part.text,
        firstNext: bomPrefix.text_part.next_offset,
        second: bomSuffix.text_part.text,
        secondNext: bomSuffix.text_part.next_offset,
        reconstructed: bomPrefix.text_part.text + bomSuffix.text_part.text,
      }).toEqual({ first: "A", firstNext: 1, second: "\uFEFFB", secondNext: null, reconstructed: "A\uFEFFB" })

      let reconstructed = ""
      let byteOffset = 0
      for (;;) {
        const chunk = await executeRead(
          {
            taskID,
            sessionID: worker.id,
            messageID: workerFinal.id,
            text_part_id: workerTextPart.id,
            byte_offset: byteOffset,
            max_bytes: 4_097,
          },
          "read-current-completion-message-chunk",
        )
        expect(chunk).toEqual(
          expect.objectContaining({
            taskID,
            terminal_lifecycle_reference: terminalReference,
            completion_decision_artifact_id: prepared.artifactID,
            mode: "text_part_chunk",
            text_part: expect.objectContaining({
              part_id: workerTextPart.id,
              byte_start: byteOffset,
              total_bytes: Buffer.byteLength(workerText),
              sha256: createHash("sha256").update(workerText).digest("hex"),
            }),
          }),
        )
        reconstructed += chunk.text_part.text
        if (chunk.text_part.next_offset === null) {
          expect(chunk.text_part.complete).toBe(true)
          break
        }
        expect(chunk.text_part.complete).toBe(false)
        byteOffset = chunk.text_part.next_offset
      }
      expect(reconstructed).toBe(workerText)

      await expect(
        requireTaskCompletionDecisionMessage({
          taskID,
          timeCompleted: completedAt,
          sessionID: worker.id,
          messageID: workerInput.id,
        }),
      ).rejects.toThrow(
        `Task ${taskID} current completion decision does not name Session Message ${worker.id}/${workerInput.id}`,
      )

      const otherMission = await ensureMissionSession({
        missionID: "mission-foreign-completion-message-read",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const otherInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: otherMission.id,
        role: "user",
        author: "orchestrator",
        time: { created: completedAt + 80 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
      })
      const otherAssistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: otherMission.id,
        parentID: otherInput.id,
        role: "assistant",
        author: "mission",
        time: { created: completedAt + 81 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: otherMission.id,
        messageID: otherAssistant.id,
        type: "step-start",
      })
      const foreignCallID = "read-foreign-mission-completion-message"
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: otherMission.id,
        messageID: otherAssistant.id,
        type: "tool",
        callID: foreignCallID,
        tool: readLeaf.id,
        state: {
          status: "running",
          input: { taskID, sessionID: worker.id, messageID: workerFinal.id },
          time: { start: completedAt + 82 },
        },
      })
      const otherContext = {
        sessionID: otherMission.id,
        messageID: otherAssistant.id,
        callID: foreignCallID,
        agent: "mission",
        abort: new AbortController().signal,
        messages: [],
        executionSurface: Tool.executionSurface([readLeaf.id], []),
        extra: { surface: "panel" as const },
        metadata() {},
        async ask() {},
      }
      await expect(
        readLeaf.tool.execute(
          { taskID, sessionID: worker.id, messageID: workerFinal.id },
          otherContext,
        ),
      ).rejects.toThrow(`Cross-Task Artifact source ${taskID} is outside Mission ${otherMission.missionID} lineage`)

      Database.transaction((db) =>
        writeTaskUpdateInTransaction({
          db,
          taskID,
          values: { status: "active", error: null },
          summary: "Open a new occurrence after the Mission reviewed the old terminal result",
          now: completedAt + 90,
        }),
      )
      Database.transaction((db) =>
        writeTaskUpdateInTransaction({
          db,
          taskID,
          values: { status: "completed", error: null },
          summary: "Settle the resumed occurrence so its terminal identity differs from the reviewed occurrence",
          now: completedAt + 91,
        }),
      )
      await expect(
        executeRead(
          { taskID, sessionID: worker.id, messageID: workerFinal.id },
          "read-after-terminal-occurrence-changed",
        ),
      ).rejects.toThrow(`panel.read_task_message terminal occurrence changed for Task ${taskID}`)
    },
  })
})
