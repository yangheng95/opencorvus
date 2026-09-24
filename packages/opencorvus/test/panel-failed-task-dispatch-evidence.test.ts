import { expect, test } from "bun:test"
import { DispatchOutcome } from "@/agent/dispatch-outcome"
import { Config } from "@/config/config"
import { createDispatchLineageOrigin } from "@/engine/dispatch-lineage"
import { recordDispatchSettlement } from "@/engine/dispatch-settlement"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { terminalTask, writeTaskUpdateInTransaction } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { selectedWorkflowBinding } from "@/engine/workflow-binding"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { panelLeafToolID } from "@/panel/action-ids"
import { Instance } from "@/project/instance"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Tool } from "@/tool/tool"
import { PanelLeafTools } from "@/tool/panel"
import { persistEstablishedTask } from "./fixture/engine-task"
import { recordTestDispatchLineage } from "./fixture/dispatch-lineage"
import { memoryProject } from "./fixture/memory"

async function panelLeaf(action: "query_task" | "read_task_dispatch_evidence") {
  const id = panelLeafToolID(action)
  const definition = PanelLeafTools.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Missing Panel leaf ${id}`)
  return { id, tool: await definition.init({ agentID: "mission" }) }
}

test("Mission reads a failed child Task's settled worker report and causal Tool result", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const config = Config.Info.parse({
        prompt_profile: { active: "base" },
        mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
      })
      const scheduler = await PromptProfileResolver.resolveSchedulerCapability({ projectDirectory: project.path, config })
      const workerCapability = await PromptProfileResolver.resolveWorkerCapability({
        projectDirectory: project.path,
        config,
        packageRevision: scheduler.packageRevision,
        agentID: "base-developer",
      })
      const packageRevision = scheduler.packageRevision
      const mission = await ensureMissionSession({
        missionID: "mission-failed-dispatch-evidence",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const taskID = Identifier.ascending("task")
      const taskRoot = Session.prepareRootNext({ kind: "root", directory: project.path, title: "Source review" })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: taskRoot,
        now,
        title: "Source review",
        request: "Verify whether the source records can be read.",
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
          timeCreated: now,
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
        time: { created: now + 1 },
        agent: "verifier",
        model: { providerID: "test", modelID: "test" },
      })
      const assistantBase = {
        sessionID: worker.id,
        parentID: workerInput.id,
        role: "assistant" as const,
        author: "verifier",
        agent: "verifier",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      }
      const toolMessage = await Session.updateMessage({
        ...assistantBase,
        id: Identifier.ascending("message"),
        time: { created: now + 2 },
      })
      const toolPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: toolMessage.id,
        type: "tool",
        callID: "read-source-records",
        tool: "api_fetch",
        state: {
          status: "completed",
          input: { service: "sheets", operation: "spreadsheets.values.get" },
          output: JSON.stringify({ values: [["candidate", "eligible"]] }),
          title: "Source rows",
          metadata: {},
          time: { start: now + 2, end: now + 3 },
        },
      })
      await Session.updateMessage({
        ...toolMessage,
        time: { ...toolMessage.time, completed: now + 3 },
        finish: "tool-calls",
      })
      const workerFinal = await Session.updateMessage({
        ...assistantBase,
        id: Identifier.ascending("message"),
        time: { created: now + 4 },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: worker.id,
        messageID: workerFinal.id,
        type: "text",
        text: "The sheet contains an eligible candidate; inspect the rows before accepting the failure claim.",
      })
      await Session.updateMessage({
        ...workerFinal,
        time: { ...workerFinal.time, completed: now + 5 },
        finish: "stop",
      })
      const lineage = recordTestDispatchLineage({
        origin: createDispatchLineageOrigin({
          taskID,
          orchestratorSessionID: taskRoot.id,
          orchestratorMessageID: Identifier.ascending("message"),
          toolPartID: Identifier.ascending("part"),
          toolCallID: Identifier.ascending("call"),
          targetAgentID: workerCapability.identity.agentID,
          projectedWorkerIdentity: workerCapability.identity,
          workScope: { kind: "task" },
          workflowBinding: selectedWorkflowBinding({
            projection: { packageRevision, virtualWorkflows: scheduler.virtualWorkflows },
            workflowID: null,
          }),
          workflowNodeID: null,
          adapterInput: {},
        }),
        childSessionID: worker.id,
        now: now + 6,
      })
      recordDispatchSettlement({
        taskID,
        dispatchID: lineage.dispatchID,
        outcome: DispatchOutcome.terminal({ sessionID: worker.id, finalMessageID: workerFinal.id }),
        now: now + 6,
      })
      await terminalTask(requireTask(taskID), {
        status: "failed",
        time_started: now,
        time_completed: now + 7,
        error: "Source unavailable",
      }, "Source unavailable")
      const terminalReference = requireCurrentTerminalLifecycleReference(taskID)
      const missionInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "orchestrator",
        time: { created: now + 8 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
      })
      const caller = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        parentID: missionInput.id,
        role: "assistant",
        author: "mission",
        time: { created: now + 9 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const query = await panelLeaf("query_task")
      const read = await panelLeaf("read_task_dispatch_evidence")
      const context = (toolID: string, callID: string) => ({
        sessionID: mission.id,
        messageID: caller.id,
        callID,
        agent: "mission",
        abort: new AbortController().signal,
        messages: [],
        executionSurface: Tool.executionSurface([toolID], []),
        extra: { surface: "panel" },
        metadata() {},
        async ask() {},
      })
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: caller.id,
        type: "step-start",
      })
      const queryCallID = "query-failed-child"
      const queryPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: caller.id,
        type: "tool",
        callID: queryCallID,
        tool: query.id,
        state: { status: "running", input: { taskIDs: [taskID] }, time: { start: now + 10 } },
      })
      const queried = await query.tool.execute({ taskIDs: [taskID] }, context(query.id, queryCallID))
      expect(JSON.parse(queried.output).tasks[0]).toMatchObject({
        taskID,
        status: "failed",
        terminal_lifecycle_reference: terminalReference,
      })
      await Session.updatePart({
        ...queryPart,
        state: {
          status: "completed",
          input: { taskIDs: [taskID] },
          output: queried.output,
          title: queried.title,
          metadata: queried.metadata,
          time: { start: now + 10, end: now + 11 },
        },
      })
      const executeRead = async (input: Record<string, unknown>, callID: string) => {
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: caller.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: mission.id,
          messageID: caller.id,
          type: "tool",
          callID,
          tool: read.id,
          state: { status: "running", input, time: { start: now + 12 } },
        })
        return JSON.parse((await read.tool.execute(input, context(read.id, callID))).output)
      }
      const inventory = await executeRead({ taskID, message_ids: [workerFinal.id] }, "read-failed-worker-inventory")
      expect(inventory).toMatchObject({
        taskID,
        terminal_lifecycle_reference: terminalReference,
        messages: [{ message_id: workerFinal.id, text: [expect.stringContaining("eligible candidate")] }],
        causal_tool_message_inventory: [{ message_id: toolMessage.id }],
      })
      const evidence = await executeRead({
        taskID,
        message_ids: [workerFinal.id],
        evidence_reads: [{ message_id: toolMessage.id, part_id: toolPart.id, field: "output" }],
      }, "read-failed-worker-tool-result")
      expect(JSON.parse(evidence.evidence_reads[0].content)).toEqual({ values: [["candidate", "eligible"]] })

      const otherMission = await ensureMissionSession({
        missionID: "unrelated-mission-failed-dispatch-evidence",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const otherInput = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: otherMission.id,
        role: "user",
        author: "orchestrator",
        time: { created: now + 13 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
      })
      const otherCaller = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: otherMission.id,
        parentID: otherInput.id,
        role: "assistant",
        author: "mission",
        time: { created: now + 14 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const otherCallID = "other-mission-read-failed-worker"
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: otherMission.id,
        messageID: otherCaller.id,
        type: "tool",
        callID: otherCallID,
        tool: read.id,
        state: { status: "running", input: { taskID, message_ids: [workerFinal.id] }, time: { start: now + 15 } },
      })
      await expect(read.tool.execute({ taskID, message_ids: [workerFinal.id] }, {
        ...context(read.id, otherCallID),
        sessionID: otherMission.id,
        messageID: otherCaller.id,
      })).rejects.toThrow(`Cross-Task Artifact source ${taskID} is outside Mission ${otherMission.missionID} lineage`)

      Database.transaction((db) => writeTaskUpdateInTransaction({
        db,
        taskID,
        values: { status: "active", error: null },
        summary: "Resume the child Task for a fresh source read",
        now: now + 16,
      }))
      Database.transaction((db) => writeTaskUpdateInTransaction({
        db,
        taskID,
        values: { status: "failed", error: "Fresh occurrence failed" },
        summary: "Fresh terminal evidence is now current",
        now: now + 17,
      }))
      await expect(executeRead({ taskID, message_ids: [workerFinal.id] }, "read-stale-failed-occurrence"))
        .rejects.toThrow(`panel.read_task_dispatch_evidence terminal occurrence changed for Task ${taskID}`)
    },
  })
})
