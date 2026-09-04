import { afterEach, describe, expect, spyOn, test } from "bun:test"
import path from "node:path"
import fs from "node:fs/promises"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { ensureMissionSession } from "../../src/mission/session"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Session } from "../../src/session"
import { MessageStore } from "../../src/session/message-store"
import { SessionProcessor } from "../../src/session/processor"
import { Config } from "../../src/config/config"
import { AttachmentStore } from "../../src/storage/attachment-store"
import { CatalogOccurrenceBinding, StaleCatalogOccurrenceError } from "../../src/capability/catalog-binding"
import { LLM } from "../../src/session/llm"
import { Provider } from "../../src/provider/provider"
import { SessionPrompt } from "../../src/session/prompt"
import { canonicalJSONValue } from "../../src/util/canonical-digest"
import { Database, eq } from "../../src/storage/db"
import { PartTable } from "../../src/session/session.sql"
import { persistEstablishedTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"
import { MissionStateTool } from "../../src/tool/mission-state"
import { Tool } from "../../src/tool/tool"
import { ToolRegistry } from "../../src/tool/registry"

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
    | "prepare-catalog-v2"
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

async function executeMissionState(sessionID: string, args: unknown) {
  const missionState = await MissionStateTool.init()
  return missionState.execute(args as never, {
    sessionID,
    messageID: Identifier.ascending("message"),
    agent: "mission",
    abort: new AbortController().signal,
    messages: [],
    executionSurface: Tool.executionSurface(["mission_state"], []),
    metadata() {},
  })
}

async function waitForFiles(files: readonly string[]) {
  const deadline = Date.now() + 30_000
  while (true) {
    const ready = await Promise.all(
      files.map(async (file) => {
        try {
          await fs.access(file)
          return true
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") return false
          throw error
        }
      }),
    )
    if (ready.every(Boolean)) return
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${files.join(", ")}.`)
    await Bun.sleep(10)
  }
}

function missionStateProcessResult(output: string) {
  const line = output.split(/\r?\n/u).find((candidate) => candidate.startsWith("MISSION_STATE_PROCESS_RESULT="))
  if (!line) throw new Error(`Mission state worker returned no result: ${output}`)
  return JSON.parse(line.slice("MISSION_STATE_PROCESS_RESULT=".length)) as {
    workerID: string
    status: "committed" | "rejected"
    name?: string
    message?: string
    output?: { revision: string }
  }
}

async function runMissionStateMigrationWorker(mode: "crash" | "recover", projectPath: string, sessionID: string) {
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(import.meta.dir, "..", "fixture", "mission-state-migration-process-worker.ts"),
      mode,
      projectPath,
      sessionID,
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
  return { exitCode, stdout, stderr }
}

describe("native Mission transport base", () => {
  test("loads the exact Mission Skill behavior after receipt reconstruction", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const { common, processor } = await createMissionOccurrence(project.path, "mission-skill-reconstruction")
        const revealed = await resolveTestCapabilityTools({ ...common, activeLocalRefs: ["general"] })
        const descriptor = revealed.occurrence.payload.descriptors.find(
          (item) => item.ref.kind === "mission_skill" && item.ref.local_ref === "general",
        )
        if (descriptor?.behavior.kind !== "open_mission_skill") throw new Error("Missing exact Mission Skill behavior")
        expect(descriptor.behavior.name).toBe("general")
        const reconstructed = await resolveTestCapabilityTools(common)
        const toolInput = { name: descriptor.behavior.name }
        const output = await reconstructed.tools.mission_skill!.execute!(toolInput, {
          toolCallId: "call_load_reconstructed_mission_skill",
          messages: [],
          abortSignal: new AbortController().signal,
        }) as Parameters<typeof processor.completeRecoveredToolPart>[0]["output"]
        expect(output.metadata.name).toBe("general")
        expect(output.output).toContain("general")
        await processor.completeRecoveredToolPart({
          toolCallID: "call_load_reconstructed_mission_skill",
          toolInput,
          output,
        })
      },
    })
  }, 30_000)

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

  test("materializes the permanent Provider base once on each continuation of the same input", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-native-transport-single-materialization")
        const exactRuntimeTools = ToolRegistry.exactRuntimeTools
        const requestedNonemptySets: string[][] = []
        const registry = spyOn(ToolRegistry, "exactRuntimeTools").mockImplementation(async (...args) => {
          const requested = args[4] ?? []
          if (requested.length > 0) requestedNonemptySets.push([...requested])
          return exactRuntimeTools(...args)
        })
        try {
          await resolveTestCapabilityTools(occurrence.common)
          const firstStepCalls = requestedNonemptySets.length
          await resolveTestCapabilityTools(occurrence.common)
          expect({ firstStepCalls, continuationCalls: requestedNonemptySets.length - firstStepCalls }).toEqual({
            firstStepCalls: 2,
            continuationCalls: 1,
          })
          expect(requestedNonemptySets.at(-1)?.sort()).toEqual([
            "capability_search",
            "mission_state",
            "scheduler_message",
          ])
        } finally {
          registry.mockRestore()
        }
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
        const emptyStateResult = await missionState.execute(
          { action: "snapshot" },
          options("call_native_mission_state_snapshot"),
        )
        const emptySnapshot = JSON.parse(emptyStateResult.output) as {
          revision: string
          files: Array<{ file: string; exists: boolean; bytes: number; content: string }>
        }
        const commitResult = await missionState.execute(
          {
            action: "commit",
            base_revision: emptySnapshot.revision,
            updates: [
              { file: "handoff.md", content: "## Next wake\nRead the terminal evidence.\n" },
              { file: "frontier.md", content: "## Mission contract\nNative transport acceptance.\n" },
            ],
          },
          options("call_native_mission_state_commit"),
        )
        const stateResult = await missionState.execute(
          { action: "snapshot" },
          options("call_native_mission_state_populated"),
        )
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
        const committed = JSON.parse(commitResult.output) as {
          revision: string
          files: Array<{ file: string; bytes: number }>
        }
        const snapshot = JSON.parse(stateResult.output) as {
          revision: string
          files: Array<{ file: string; exists: boolean; bytes: number; content: string }>
        }
        expect({
          emptySnapshot: emptySnapshot.files,
          committed: committed.files,
          snapshot: snapshot.files,
          revisionChanged:
            emptySnapshot.revision !== committed.revision && committed.revision === snapshot.revision,
          stateTitle: stateResult.title,
          schedulerTitle: schedulerResult.title,
          calls: persisted.parts
            .filter((part) => part.type === "tool")
            .map((part) => ({ callID: part.callID, tool: part.tool }))
            .sort((left, right) => left.callID.localeCompare(right.callID)),
        }).toEqual({
          emptySnapshot: [
              { file: "frontier.md", exists: false, bytes: 0, content: "" },
              { file: "tasks.md", exists: false, bytes: 0, content: "" },
              { file: "handoff.md", exists: false, bytes: 0, content: "" },
              { file: "notes.md", exists: false, bytes: 0, content: "" },
            ],
          committed: [
              { file: "frontier.md", bytes: 49 },
              { file: "handoff.md", bytes: 41 },
            ],
          snapshot: [
              {
                file: "frontier.md",
                exists: true,
                bytes: 49,
                content: "## Mission contract\nNative transport acceptance.\n",
              },
              { file: "tasks.md", exists: false, bytes: 0, content: "" },
              {
                file: "handoff.md",
                exists: true,
                bytes: 41,
                content: "## Next wake\nRead the terminal evidence.\n",
              },
              { file: "notes.md", exists: false, bytes: 0, content: "" },
            ],
          revisionChanged: true,
          stateTitle: expect.stringContaining("mission_state snapshot"),
          schedulerTitle: "scheduler_message notification",
          calls: [
            { callID: "call_native_mission_state_commit", tool: "mission_state" },
            { callID: "call_native_mission_state_populated", tool: "mission_state" },
            { callID: "call_native_mission_state_snapshot", tool: "mission_state" },
            { callID: "call_native_scheduler_message", tool: "scheduler_message" },
          ],
        })
      },
    })
  }, 60_000)

  test("publishes one bounded Mission state revision and preserves it across rejected commits", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-state-bounded-revision")
        const initial = JSON.parse((await executeMissionState(occurrence.mission.id, { action: "snapshot" })).output) as {
          revision: string
        }
        const content = `near-boundary:${"\"\\\n".repeat(8_000)}`
        const committed = JSON.parse(
          (
            await executeMissionState(occurrence.mission.id, {
              action: "commit",
              base_revision: initial.revision,
              updates: [
                { file: "tasks.md", content: "" },
                { file: "notes.md", content },
              ],
            })
          ).output,
        ) as { revision: string }
        const accepted = JSON.parse(
          (await executeMissionState(occurrence.mission.id, { action: "snapshot" })).output,
        ) as {
          revision: string
          files: Array<{ file: string; exists: boolean; bytes: number; content: string }>
        }
        expect(Buffer.byteLength(JSON.stringify(accepted), "utf8")).toBeLessThanOrEqual(50 * 1024)
        expect(accepted.revision).toBe(committed.revision)
        expect(accepted.files.find((file) => file.file === "tasks.md")).toEqual({
          file: "tasks.md",
          exists: true,
          bytes: 0,
          content: "",
        })

        await expect(
          executeMissionState(occurrence.mission.id, {
            action: "commit",
            base_revision: initial.revision,
            updates: [{ file: "frontier.md", content: "stale" }],
          }),
        ).rejects.toMatchObject({ name: "MissionStateRevisionConflictError" })
        await expect(
          executeMissionState(occurrence.mission.id, {
            action: "commit",
            base_revision: accepted.revision,
            updates: [{ file: "notes.md", content: `too-large:${"y".repeat(52_000)}` }],
          }),
        ).rejects.toMatchObject({ name: "MissionStateSnapshotLimitError" })
        const afterRejected = JSON.parse(
          (await executeMissionState(occurrence.mission.id, { action: "snapshot" })).output,
        ) as { revision: string }
        expect(afterRejected.revision).toBe(accepted.revision)

        const directory = ProjectRuntimePaths.missionRoot(project.path, occurrence.mission.missionID)
        expect((await fs.readdir(directory)).sort()).toEqual([".state.lock", "state.json"])
        const document = JSON.parse(await fs.readFile(path.join(directory, "state.json"), "utf8")) as {
          files: Array<{ file: string; content: string }>
        }
        expect(document.files.find((file) => file.file === "notes.md")?.content).toBe(content)
      },
    })
  }, 60_000)

  test("migrates the former four-file layout into one current physical authority", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-state-legacy-layout")
        const directory = ProjectRuntimePaths.missionRoot(project.path, occurrence.mission.missionID)
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(path.join(directory, "frontier.md"), "legacy frontier")
        await fs.writeFile(path.join(directory, "handoff.md"), "legacy handoff")
        const snapshot = JSON.parse(
          (await executeMissionState(occurrence.mission.id, { action: "snapshot" })).output,
        ) as { files: Array<{ file: string; exists: boolean; content: string }> }
        expect(snapshot.files.find((file) => file.file === "frontier.md")).toMatchObject({
          exists: true,
          content: "legacy frontier",
        })
        expect(snapshot.files.find((file) => file.file === "handoff.md")).toMatchObject({
          exists: true,
          content: "legacy handoff",
        })
        expect((await fs.readdir(directory)).sort()).toEqual([".state.lock", "state.json"])
      },
    })
  }, 60_000)

  test("reports an exact recoverable boundary for a valid oversized legacy layout", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-state-legacy-recovery")
        const directory = ProjectRuntimePaths.missionRoot(project.path, occurrence.mission.missionID)
        await fs.mkdir(directory, { recursive: true })
        const legacyContent = "x".repeat(60_000)
        await fs.writeFile(path.join(directory, "frontier.md"), legacyContent)
        await expect(executeMissionState(occurrence.mission.id, { action: "snapshot" })).rejects.toMatchObject({
          name: "MissionStateLegacyMigrationRequiredError",
          data: {
            mission_id: occurrence.mission.missionID,
            recovery_directory: directory,
            files: [{ file: "frontier.md", bytes: 60_000 }],
            output_bytes: expect.any(Number),
            output_limit_bytes: 50 * 1024,
          },
        })
        expect(await fs.readFile(path.join(directory, "frontier.md"), "utf8")).toBe(legacyContent)

        await fs.writeFile(path.join(directory, "frontier.md"), "operator archived bulk evidence")
        const recovered = JSON.parse(
          (await executeMissionState(occurrence.mission.id, { action: "snapshot" })).output,
        ) as { files: Array<{ file: string; exists: boolean; content: string }> }
        expect(recovered.files.find((file) => file.file === "frontier.md")).toMatchObject({
          exists: true,
          content: "operator archived bulk evidence",
        })
        expect((await fs.readdir(directory)).sort()).toEqual([".state.lock", "state.json"])
      },
    })
  }, 60_000)

  test("recovers legacy retirement after a real process crash between publication and cleanup", async () => {
    await using project = await memoryProject()
    const prepared = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-state-migration-crash")
        const directory = ProjectRuntimePaths.missionRoot(project.path, occurrence.mission.missionID)
        await fs.mkdir(directory, { recursive: true })
        await fs.writeFile(path.join(directory, "frontier.md"), "legacy crash-cut frontier")
        await fs.writeFile(path.join(directory, "handoff.md"), "legacy crash-cut handoff")
        return { sessionID: occurrence.mission.id, directory }
      },
    })
    const crashed = await runMissionStateMigrationWorker("crash", project.path, prepared.sessionID)
    expect(crashed.exitCode).toBe(86)
    const interrupted = JSON.parse(await fs.readFile(path.join(prepared.directory, "state.json"), "utf8")) as {
      legacy_retired: boolean
      files: Array<{ file: string; content: string }>
    }
    expect(interrupted).toMatchObject({
      legacy_retired: false,
      files: [
        { file: "frontier.md", content: "legacy crash-cut frontier" },
        { file: "handoff.md", content: "legacy crash-cut handoff" },
      ],
    })
    const recovered = await runMissionStateMigrationWorker("recover", project.path, prepared.sessionID)
    if (recovered.exitCode !== 0) {
      throw new Error(`Mission state migration recovery failed: ${recovered.stderr || recovered.stdout}`)
    }
    const resultLine = recovered.stdout
      .split(/\r?\n/u)
      .find((line) => line.startsWith("MISSION_STATE_MIGRATION_RESULT="))
    if (!resultLine) throw new Error(`Mission state migration recovery returned no result: ${recovered.stdout}`)
    const snapshot = JSON.parse(resultLine.slice("MISSION_STATE_MIGRATION_RESULT=".length)) as {
      files: Array<{ file: string; exists: boolean; content: string }>
    }
    expect(snapshot.files.find((file) => file.file === "frontier.md")).toMatchObject({
      exists: true,
      content: "legacy crash-cut frontier",
    })
    expect(snapshot.files.find((file) => file.file === "handoff.md")).toMatchObject({
      exists: true,
      content: "legacy crash-cut handoff",
    })
    const settled = JSON.parse(await fs.readFile(path.join(prepared.directory, "state.json"), "utf8")) as {
      legacy_retired: boolean
    }
    expect(settled.legacy_retired).toBe(true)
    expect((await fs.readdir(prepared.directory)).sort()).toEqual([".state.lock", "state.json"])
  }, 120_000)

  test("settles concurrent cross-process commits through one complete revision winner", async () => {
    await using project = await memoryProject()
    const prepared = await Instance.provide({
      directory: project.path,
      fn: async () => {
        const occurrence = await createMissionOccurrence(project.path, "mission-state-cross-process")
        const snapshot = JSON.parse(
          (await executeMissionState(occurrence.mission.id, { action: "snapshot" })).output,
        ) as { revision: string }
        return { sessionID: occurrence.mission.id, missionID: occurrence.mission.missionID, revision: snapshot.revision }
      },
    })
    const barrier = path.join(project.path, "mission-state-process-barrier")
    await fs.mkdir(barrier, { recursive: true })
    const fixture = path.join(import.meta.dir, "..", "fixture", "mission-state-process-worker.ts")
    const children = [
      { id: "alpha", content: "complete alpha generation" },
      { id: "beta", content: "complete beta generation" },
    ].map(({ id, content }) => ({
      id,
      child: Bun.spawn([process.execPath, fixture, project.path, prepared.sessionID, prepared.revision, barrier, id, content], {
        cwd: path.join(import.meta.dir, "..", ".."),
        env: process.env,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      }),
    }))
    await waitForFiles(children.map(({ id }) => path.join(barrier, `${id}.ready`)))
    await fs.writeFile(path.join(barrier, "go"), "go")
    const results = await Promise.all(
      children.map(async ({ child }) => {
        const [exitCode, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ])
        if (exitCode !== 0) throw new Error(`Mission state worker failed (${exitCode}): ${stderr || stdout}`)
        return missionStateProcessResult(stdout)
      }),
    )
    expect(results.map((result) => result.status).sort()).toEqual(["committed", "rejected"])
    expect(results.find((result) => result.status === "rejected")?.name).toBe("MissionStateRevisionConflictError")
    const winner = results.find((result) => result.status === "committed")!.workerID
    const documentPath = path.join(ProjectRuntimePaths.missionRoot(project.path, prepared.missionID), "state.json")
    const document = JSON.parse(await fs.readFile(documentPath, "utf8")) as {
      files: Array<{ file: string; content: string }>
    }
    expect(document.files).toEqual([
      { file: "frontier.md", content: `complete ${winner} generation` },
    ])
  }, 120_000)

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

  test("retires a version-two Catalog during permission continuation before the external effect", async () => {
    await using project = await memoryProject()
    const statePath = path.join(project.path, "native-mission-permission-catalog-v2.json")
    await runPermissionProcessWorker("prepare-catalog-v2", project.path, statePath)
    const result = processWorkerResult(await runPermissionProcessWorker("resume-same", project.path, statePath))
    expect(result).toEqual({
      mode: "resume-same",
      staleName: "StaleContinuationError",
      staleMessage: expect.any(String),
      schedulerEventCount: 0,
      toolPartStatus: "error",
      staleEventCount: 1,
      staleReasons: [expect.any(String)],
    })
  }, 120_000)

  test("terminalizes an ordinary continuation when its persisted Catalog is version two", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const mission = await ensureMissionSession({
          missionID: "mission-native-transport-catalog-v2-continuation",
          defaultCwd: project.path,
          productPillar: "work",
          heldExpertSquadIDs: ["base"],
        })
        const provider = spyOn(Provider, "getModel").mockResolvedValue(model)
        let providerSteps = 0
        const stream = spyOn(LLM, "stream").mockImplementation(async (input) => {
          providerSteps += 1
          const search = input.tools.capability_search
          if (!search?.execute) throw new Error("Mission continuation has no capability_search Tool.")
          const params = {
            queries: ["mission status"],
            exact_refs: [],
            deactivate_refs: [],
            limit: 1,
          }
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield {
                type: "tool-call",
                toolCallId: "call_catalog_v2_ordinary_continuation",
                toolName: "capability_search",
                input: params,
              }
              const output = await search.execute!(params, {
                toolCallId: "call_catalog_v2_ordinary_continuation",
                messages: input.messages,
                abortSignal: input.abort,
              })
              yield {
                type: "tool-result",
                toolCallId: "call_catalog_v2_ordinary_continuation",
                toolName: "capability_search",
                input: params,
                output,
              }

              const messages = await Session.messages({ sessionID: mission.id })
              const user = messages.findLast((message) => message.info.role === "user")
              if (!user || user.info.role !== "user") throw new Error("Mission continuation has no user input.")
              const binding = CatalogOccurrenceBinding.bindingFromInput(user)
              if (!binding) throw new Error("Mission continuation has no Catalog binding.")
              const current = await CatalogOccurrenceBinding.read({ projectID: Instance.project.id, binding })
              const legacy = { ...current } as Record<string, unknown>
              legacy.schema_version = 2
              delete legacy.permanent_provider_base_definition
              const reference = await AttachmentStore.write(
                Instance.project.id,
                Buffer.from(canonicalJSONValue(legacy), "utf8"),
                "application/json",
                "catalog-v2-ordinary.json",
              )
              const carrier = user.parts.find((part) => part.type === "text")
              if (!carrier || carrier.type !== "text") throw new Error("Mission continuation has no input carrier.")
              Database.immediateTransaction((db) =>
                db
                  .update(PartTable)
                  .set({
                    data: {
                      ...carrier,
                      metadata: {
                        ...(carrier.metadata ?? {}),
                        catalog_snapshot_ref: reference.url,
                        catalog_snapshot_hash: reference.sha,
                      },
                    } as never,
                  })
                  .where(eq(PartTable.id, carrier.id))
                  .run(),
              )
              yield {
                type: "finish-step",
                finishReason: "tool-calls",
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              }
              yield {
                type: "finish",
                finishReason: "tool-calls",
                totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              }
            })(),
          } as unknown as Awaited<ReturnType<typeof LLM.stream>>
        })
        let observed: unknown
        try {
          await SessionPrompt.prompt({
            sessionID: mission.id,
            author: "user",
            agent: "mission",
            model: { providerID: model.providerID, modelID: model.id },
            parts: [{ type: "text", text: "Continue the Mission from the exact bound Catalog." }],
          })
        } catch (error) {
          observed = error
        } finally {
          stream.mockRestore()
          provider.mockRestore()
        }
        const messages = await Session.messages({ sessionID: mission.id })
        const assistant = messages.findLast((message) => message.info.role === "assistant")
        expect(observed).toBeInstanceOf(StaleCatalogOccurrenceError)
        expect(providerSteps).toBe(1)
        expect(assistant?.info).toMatchObject({
          role: "assistant",
          finish: "error",
          error: {
            name: "StaleCatalogOccurrenceError",
            data: { mismatches: ["permanent_provider_base_definition"] },
          },
        })
      },
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
