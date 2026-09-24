import { expect, test } from "bun:test"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { terminalTask, writeTaskUpdateInTransaction } from "@/engine/state"
import { requireTask } from "@/engine/store"
import { requireCurrentTerminalLifecycleReference } from "@/engine/terminal-lifecycle-reference"
import { Identifier } from "@/id/id"
import { MissionBlockReceipt } from "@/mission/completion"
import { missionBoardProjection } from "@/mission/board"
import { missionRecord, missionStatusRecord } from "@/mission/projection"
import { ensureMissionSession, requireMissionSession } from "@/mission/session"
import { panelLeafToolID } from "@/panel/action-ids"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Tool } from "@/tool/tool"
import { PanelLeafTools } from "@/tool/panel"
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

async function panelLeaf(action: "query_task" | "block_mission") {
  const id = panelLeafToolID(action)
  const definition = PanelLeafTools.find((candidate) => candidate.id === id)
  if (!definition) throw new Error(`Missing Panel leaf ${id}`)
  return { id, tool: await definition.init({ agentID: "mission" }) }
}

test("a failed child Task can settle its Mission as an evidenced blocked outcome", async () => {
  await using project = await memoryProject()
  const identity = await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await ensureMissionSession({
        missionID: "mission-external-authority-block",
        defaultCwd: project.path,
        productPillar: "work",
        heldExpertSquadIDs: ["base"],
      })
      const taskID = Identifier.ascending("task")
      const taskRoot = Session.prepareRootNext({ kind: "root", directory: project.path, title: "Portal submission" })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: taskRoot,
        now,
        title: "Portal submission",
        request: "Send eligible candidates and submit them in an Account Manager-only portal.",
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
      await terminalTask(
        requireTask(taskID),
        { status: "failed", time_started: now, time_completed: now + 1, error: "Portal authority is external" },
        "Emails sent; authorized portal submission remains blocked",
      )
      const terminalReference = requireCurrentTerminalLifecycleReference(taskID)
      const input = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        role: "user",
        author: "user",
        time: { created: now + 2 },
        agent: "mission",
        model: { providerID: "test", modelID: "test" },
      })
      const assistant = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        parentID: input.id,
        role: "assistant",
        author: "mission",
        time: { created: now + 3 },
        agent: "mission",
        providerID: "test",
        modelID: "test",
        path: { cwd: project.path, root: project.path },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      const query = await panelLeaf("query_task")
      const block = await panelLeaf("block_mission")
      const context = (toolID: string, callID: string) => ({
        sessionID: mission.id,
        messageID: assistant.id,
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
        id: Identifier.ascending("part"), sessionID: mission.id, messageID: assistant.id, type: "step-start",
      })
      const queryCallID = "query-current-failed-task"
      const queryPart = await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: assistant.id,
        type: "tool",
        callID: queryCallID,
        tool: query.id,
        state: { status: "running", input: { taskIDs: [taskID] }, time: { start: now + 3 } },
      })
      const queried = await query.tool.execute({ taskIDs: [taskID] }, context(query.id, queryCallID))
      expect(JSON.parse(queried.output).tasks[0]).toMatchObject({
        taskID, status: "failed", terminal_lifecycle_reference: terminalReference,
      })
      await Session.updatePart({
        ...queryPart,
        state: {
          status: "completed", input: { taskIDs: [taskID] }, output: queried.output,
          title: queried.title, metadata: queried.metadata, time: { start: now + 3, end: now + 4 },
        },
      })

      const artifactLocator = {
        source: "engine_artifact" as const,
        artifact_id: "art_external_portal_evidence",
        catalog_revision: 1,
        expected_sha256: "b".repeat(64),
      }
      const readRef = "ar_1234567890abcdef"
      await Session.updatePart({
        id: Identifier.ascending("part"),
        sessionID: mission.id,
        messageID: assistant.id,
        type: "tool",
        callID: "read-current-blocker-evidence",
        tool: "panel_read_task_artifact",
        state: {
          status: "completed",
          input: {
            taskID, artifact_transport_version: 2, artifact_locator_ref: "al_1234567890abcdef",
            byte_offset: 0, max_bytes: 65_536, delivery: "inline",
          },
          output: JSON.stringify({
            taskID, terminal_lifecycle_reference: terminalReference,
            artifact_transport_version: 2, artifact_locator_ref: "al_1234567890abcdef",
            artifact_read_ref: readRef, locator: artifactLocator, media_type: "application/json",
            byte_start: 0, byte_end: 2, next_offset: null, total_bytes: 2,
            complete: true, sha256: artifactLocator.expected_sha256, text: "xy", attachment: false,
          }),
          title: "Task blocker evidence",
          metadata: { truncated: false },
          time: { start: now + 4, end: now + 5 },
        },
      })
      await Session.updatePart({
        id: Identifier.ascending("part"), sessionID: mission.id, messageID: assistant.id, type: "step-start",
      })
      const args = {
        summary: "Eligible candidates were emailed; authorized portal submission remains external.",
        unresolved_criteria: ["Submit the candidates directly in the Account Manager-only portal"],
        task_reviews: [{ task_id: taskID, evidence_read_refs: [readRef] }],
      }
      const callID = "settle-external-portal-blocker"
      const toolPartID = Identifier.ascending("part")
      const part = await Session.updatePart({
        id: toolPartID,
        sessionID: mission.id,
        messageID: assistant.id,
        type: "tool",
        callID,
        tool: block.id,
        state: { status: "running", input: args, time: { start: now + 6 } },
      })
      const result = await block.tool.execute(args, context(block.id, callID))
      expect(MissionBlockReceipt.parse(JSON.parse(result.output))).toMatchObject({
        kind: "mission_blocked",
        mission_id: mission.missionID,
        task_reviews: [{ task_id: taskID, evidence_locators: [artifactLocator], terminal_lifecycle_reference: terminalReference }],
        unresolved_criteria: args.unresolved_criteria,
      })
      await Session.updatePart({
        ...part,
        state: {
          status: "completed", input: args, output: result.output,
          title: result.title, metadata: result.metadata, time: { start: now + 6, end: now + 7 },
        },
      })
      await Session.updateMessage({ ...assistant, time: { ...assistant.time, completed: now + 7 }, finish: "tool-calls" })
      expect(missionBoardProjection(mission, {
        interruptible: false, pendingInteractions: 0, taskLifecycleStatuses: ["failed"],
      })).toMatchObject({
        lane: "attention", outcome: { kind: "blocked", messageID: assistant.id, unresolvedCriteria: args.unresolved_criteria },
      })
      expect(missionRecord(mission)).toMatchObject({
        outcome: { kind: "blocked", summary: args.summary }, tasks: [{ id: taskID, lifecycleStatus: "failed" }],
      })
      expect(missionStatusRecord(mission)).toMatchObject({
        outcome: { kind: "blocked", summary: args.summary }, tasks: [{ taskID, lifecycleStatus: "failed" }],
      })
      return { missionSessionID: mission.id, taskID, now }
    },
  })
  await Instance.disposeAll()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const mission = await requireMissionSession(identity.missionSessionID)
      expect(missionRecord(mission)).toMatchObject({
        boardLane: "attention", outcome: { kind: "blocked" }, tasks: [{ id: identity.taskID, lifecycleStatus: "failed" }],
      })
      Database.transaction((db) => writeTaskUpdateInTransaction({
        db, taskID: identity.taskID, values: { status: "active", error: null },
        summary: "Operator supplied new portal authority", now: identity.now + 8,
      }))
      Database.transaction((db) => writeTaskUpdateInTransaction({
        db, taskID: identity.taskID, values: { status: "completed", error: null },
        summary: "New occurrence settled", now: identity.now + 9,
      }))
      expect(missionBoardProjection(mission, {
        interruptible: false, pendingInteractions: 0, taskLifecycleStatuses: ["completed"],
      })).toMatchObject({ lane: "review" })
    },
  })
})
