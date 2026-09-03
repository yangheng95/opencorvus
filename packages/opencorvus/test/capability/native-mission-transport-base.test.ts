import { afterEach, describe, expect, test } from "bun:test"
import path from "node:path"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { ensureMissionSession } from "../../src/mission/session"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { SessionProcessor } from "../../src/session/processor"
import { Config } from "../../src/config/config"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"

const model = {
  id: "native-mission-transport-model",
  providerID: "openai",
  name: "Native Mission transport",
  limit: { context: 1_000_000, input: 900_000, output: 4_096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
  api: { id: "native-mission-transport-model", npm: "@ai-sdk/openai" },
  options: {},
} as any

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.09.03.1",
  packageDigest: "a".repeat(64),
}

afterEach(async () => {
  await resetMemoryDatabase()
})

async function createMissionOccurrence(projectPath: string, missionID: string) {
  const mission = await ensureMissionSession({
    missionID,
    defaultCwd: projectPath,
    productPillar: "work",
    heldExpertSquadIDs: ["base"],
  })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: mission.id,
    role: "user",
    author: "user",
    time: { created: Date.now() },
    agent: "mission",
    model: { providerID: model.providerID, modelID: model.id },
  })
  const assistant = {
    id: Identifier.ascending("message"),
    sessionID: mission.id,
    parentID: user.id,
    role: "assistant" as const,
    author: "mission",
    agent: "mission",
    providerID: model.providerID,
    modelID: model.id,
    path: { cwd: projectPath, root: projectPath },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now() + 1 },
  }
  const config = await Config.get()
  const processor = SessionProcessor.create({
    assistantMessage: assistant,
    sessionID: mission.id,
    model,
    abort: new AbortController().signal,
  })
  const common = {
    config,
    model,
    session: mission,
    assistant,
    processor,
    agent: sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("mission", { config })),
    agentID: "mission",
    messages: await Session.messages({ sessionID: mission.id }),
    includeMcpTools: false,
  }
  return { mission, assistant, processor, common }
}

async function runPermissionProcessWorker(
  mode:
    | "prepare"
    | "prepare-structured-reveal"
    | "prepare-legacy-reveal"
    | "resume-same"
    | "resume-drift"
    | "resume-missing"
    | "resume-harness-drift",
  projectPath: string,
  statePath: string,
) {
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(import.meta.dir, "..", "fixture", "native-mission-transport-permission-process-worker.ts"),
      mode,
      projectPath,
      statePath,
    ],
    {
      cwd: path.join(import.meta.dir, "..", ".."),
      env: process.env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(`Native Mission permission worker ${mode} failed (${exitCode}): ${stderr || stdout}`)
  }
  return stdout
}

function processWorkerResult(output: string) {
  const line = output
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith("NATIVE_MISSION_PERMISSION_RESULT="))
  if (!line) throw new Error(`Native Mission permission worker returned no result: ${output}`)
  return JSON.parse(line.slice("NATIVE_MISSION_PERMISSION_RESULT=".length)) as {
    mode: string
    staleName: string | null
    staleMessage: string | null
    schedulerEventCount: number
    toolPartStatus: string | null
    staleEventCount: number
    staleReasons: Array<string | null>
  }
}

describe("native Mission transport base", () => {
  test("narrows the permanent transport base through the current message Tool switches", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-native-transport-switch")
        const resolved = await resolveTestCapabilityTools({
          ...occurrence.common,
          tools: { scheduler_message: false },
        })
        expect(Object.keys(resolved.tools).sort()).toEqual(["capability_search", "mission_state"])
      },
    })
  }, 60_000)

  test("narrows the permanent transport base through merged execution permission", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-native-transport-permission")
        const agent = sessionRuntimeFromNativeAgent({
          ...occurrence.common.agent,
          permission: [
            ...(occurrence.common.agent.permission ?? []),
            { permission: "mission_state", pattern: "*", action: "deny" },
          ],
        })
        const resolved = await resolveTestCapabilityTools({ ...occurrence.common, agent })
        expect(Object.keys(resolved.tools).sort()).toEqual(["capability_search", "scheduler_message"])
      },
    })
  }, 60_000)

  test("keeps exact native transport leaves through one reveal and deactivate cycle", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-native-transport-reveal")
        const initial = await resolveTestCapabilityTools(occurrence.common)
        expect(Object.keys(initial.tools).sort()).toEqual([
          "capability_search",
          "mission_state",
          "scheduler_message",
        ])

        const revealed = await resolveTestCapabilityTools({ ...occurrence.common, activeLocalRefs: ["wait"] })
        expect(Object.keys(revealed.tools).sort()).toEqual([
          "capability_search",
          "mission_state",
          "scheduler_message",
          "wait",
        ])
        const search = revealed.tools.capability_search
        if (!search?.execute) throw new Error("Native Mission transport occurrence has no capability_search Tool.")
        await search.execute(
          { queries: [""], exact_refs: [], deactivate_refs: [revealed.occurrence.ref("wait")], limit: 5 },
          {
            toolCallId: "call_deactivate_native_mission_wait",
            messages: [],
            abortSignal: new AbortController().signal,
          },
        )

        const deactivated = await resolveTestCapabilityTools(occurrence.common)
        expect(Object.keys(deactivated.tools).sort()).toEqual([
          "capability_search",
          "mission_state",
          "scheduler_message",
        ])
      },
    })
  }, 60_000)

  test("executes both native transport leaves through persisted Tool Parts", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-native-transport-execution")
        const taskID = Identifier.ascending("task")
        const taskSession = Session.prepareRootNext({
          kind: "root",
          directory: project.path,
          title: "Native Mission transport target",
        })
        const now = Date.now()
        persistEstablishedTask({
          taskID,
          rootSession: taskSession,
          now,
          title: "Native Mission transport target",
          request: "Receive one durable scheduler notification.",
          productPillar: "work",
          source: "mission",
          metadata: {
            actor: "mission",
            mission: { id: occurrence.mission.missionID, session_id: occurrence.mission.id },
          },
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
        const { tools } = await resolveTestCapabilityTools(occurrence.common)
        const missionState = tools.mission_state
        const schedulerMessage = tools.scheduler_message
        if (!missionState?.execute || !schedulerMessage?.execute) {
          throw new Error("Native Mission transport base did not materialize both executable leaves.")
        }
        const options = (toolCallId: string) => ({
          toolCallId,
          messages: [],
          abortSignal: new AbortController().signal,
        })
        const stateResult = await missionState.execute({ action: "list" }, options("call_native_mission_state"))
        const schedulerResult = await schedulerMessage.execute(
          {
            kind: "notification",
            task_id: taskID,
            subject: "Transport base acceptance",
            message: "The native Mission transport leaf is executable.",
          },
          options("call_native_scheduler_message"),
        )
        const persisted = await MessageStore.get({
          sessionID: occurrence.mission.id,
          messageID: occurrence.assistant.id,
        })
        expect({
          stateTitle: stateResult.title,
          schedulerTitle: schedulerResult.title,
          calls: persisted.parts
            .filter((part) => part.type === "tool")
            .map((part) => ({ callID: part.callID, tool: part.tool }))
            .sort((left, right) => left.callID.localeCompare(right.callID)),
        }).toEqual({
          stateTitle: expect.stringContaining("mission_state list"),
          schedulerTitle: "scheduler_message notification",
          calls: [
            { callID: "call_native_mission_state", tool: "mission_state" },
            { callID: "call_native_scheduler_message", tool: "scheduler_message" },
          ],
        })
      },
    })
  }, 60_000)

  test("recovers the exact approved scheduler transport authority after process death", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "native-mission-permission-same.json")
    await runPermissionProcessWorker("prepare", project.path, statePath)
    const result = processWorkerResult(
      await runPermissionProcessWorker("resume-same", project.path, statePath),
    )
    expect(result).toEqual({
      mode: "resume-same",
      staleName: null,
      staleMessage: null,
      schedulerEventCount: 1,
      toolPartStatus: "completed",
      staleEventCount: 1,
      staleReasons: [expect.any(String)],
    })
  }, 120_000)

  test("retires a drifted approved scheduler transport authority without an external effect", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "native-mission-permission-drift.json")
    await runPermissionProcessWorker("prepare", project.path, statePath)
    const result = processWorkerResult(
      await runPermissionProcessWorker("resume-drift", project.path, statePath),
    )
    expect(result).toEqual({
      mode: "resume-drift",
      staleName: "StaleContinuationError",
      staleMessage: expect.any(String),
      schedulerEventCount: 0,
      toolPartStatus: "error",
      staleEventCount: 1,
      staleReasons: [expect.any(String)],
    })
  }, 120_000)

  test("recovers the exact StructuredOutput base after reveal and process death", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "native-mission-permission-structured-reveal.json")
    await runPermissionProcessWorker("prepare-structured-reveal", project.path, statePath)
    const result = processWorkerResult(await runPermissionProcessWorker("resume-same", project.path, statePath))
    expect(result).toEqual({
      mode: "resume-same",
      staleName: null,
      staleMessage: null,
      schedulerEventCount: 1,
      toolPartStatus: "completed",
      staleEventCount: 1,
      staleReasons: [expect.any(String)],
    })
  }, 120_000)

  test("reconstructs a legacy revealed scheduler transport occurrence after base promotion", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "native-mission-permission-legacy-reveal.json")
    await runPermissionProcessWorker("prepare-legacy-reveal", project.path, statePath)
    const result = processWorkerResult(await runPermissionProcessWorker("resume-same", project.path, statePath))
    expect(result).toEqual({
      mode: "resume-same",
      staleName: null,
      staleMessage: null,
      schedulerEventCount: 1,
      toolPartStatus: "completed",
      staleEventCount: 1,
      staleReasons: [expect.any(String)],
    })
  }, 120_000)

  for (const mode of ["resume-missing", "resume-harness-drift"] as const) {
    test(`retires ${mode} scheduler transport authority without an external effect`, async () => {
      await using project = await memoryProject()
      const statePath = path.join(project.path, `native-mission-permission-${mode}.json`)
      await runPermissionProcessWorker("prepare", project.path, statePath)
      const result = processWorkerResult(await runPermissionProcessWorker(mode, project.path, statePath))
      expect(result).toEqual({
        mode,
        staleName: "StaleContinuationError",
        staleMessage: expect.any(String),
        schedulerEventCount: 0,
        toolPartStatus: "error",
        staleEventCount: 1,
        staleReasons: [expect.any(String)],
      })
    }, 120_000)
  }
})
