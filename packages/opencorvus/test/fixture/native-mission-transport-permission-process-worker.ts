import fs from "node:fs/promises"
import { Bus } from "@/bus"
import { Config } from "@/config/config"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "@/agent/session-agent-runtime"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { Identifier } from "@/id/id"
import { ensureMissionSession } from "@/mission/session"
import { PermissionAuthority } from "@/permission/authority"
import { ProtocolEventTable } from "@/protocol/protocol.sql"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Message, Session } from "@/session"
import { LLM } from "@/session/llm"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { SessionLoop } from "@/session/loop"
import { Database, eq } from "@/storage/db"
import { ToolRegistry } from "@/tool/registry"
import { NATIVE_MISSION_TRANSPORT_TOOL_IDS } from "@/tool/tool-id-catalog"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import { persistEstablishedTask } from "./engine-task"
import { resolveTestCapabilityTools } from "./capability-occurrence"

type ProcessState = {
  requestID: string
  missionSessionID: string
  assistantMessageID: string
  taskID: string
  toolCallID: string
  scenario: "plain" | "structured-reveal" | "legacy-reveal"
}

const [mode, projectPath, statePath] = process.argv.slice(2)
if (
  !(
    [
      "prepare",
      "prepare-structured-reveal",
      "prepare-legacy-reveal",
      "resume-same",
      "resume-drift",
      "resume-missing",
      "resume-harness-drift",
    ] as const
  ).includes(mode as never) ||
  !projectPath ||
  !statePath
) {
  throw new Error(
    "usage: native-mission-transport-permission-process-worker <prepare|prepare-structured-reveal|prepare-legacy-reveal|resume-same|resume-drift|resume-missing|resume-harness-drift> <project> <state>",
  )
}

declareNativeTaskProcessDeployment()
installDefaultControlPlaneToolLoaders()

const model = {
  id: "native-mission-transport-permission-model",
  providerID: "openai",
  name: "Native Mission transport permission",
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
  api: { id: "native-mission-transport-permission-model", npm: "@ai-sdk/openai" },
  options: {},
} as Provider.Model

const packageRevision = {
  scope: "built_in" as const,
  projectID: null,
  namespace: "builtin",
  id: "base",
  version: "2026.09.03.1",
  packageDigest: "a".repeat(64),
}

async function prepare(scenario: ProcessState["scenario"]) {
  await Instance.provide({
    directory: projectPath,
    fn: async () => {
      await Config.updateProjectPatch({ permission_mode: "ask" })
      const config = await Config.get()
      const mission = await ensureMissionSession({
        missionID: "mission-native-transport-permission-process",
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
        includeMcpTools: false,
        ...(scenario === "structured-reveal"
          ? {
              format: {
                type: "json_schema" as const,
                schema: {
                  type: "object",
                  properties: { result: { type: "string" } },
                  required: ["result"],
                  additionalProperties: false,
                },
                retryCount: 2,
              },
            }
          : {}),
      })
      const assistant: Message.Assistant = {
        id: Identifier.ascending("message"),
        sessionID: mission.id,
        parentID: user.id,
        role: "assistant",
        author: "mission",
        agent: "mission",
        providerID: model.providerID,
        modelID: model.id,
        path: { cwd: projectPath, root: projectPath },
        cost: 0,
        tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: Date.now() + 1 },
      }
      const taskID = Identifier.ascending("task")
      const taskSession = Session.prepareRootNext({
        kind: "root",
        directory: projectPath,
        title: "Native Mission permission recovery target",
      })
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: taskSession,
        now,
        title: "Native Mission permission recovery target",
        request: "Receive one recovered scheduler notification.",
        productPillar: "work",
        source: "mission",
        metadata: {
          actor: "mission",
          mission: { id: mission.missionID, session_id: mission.id },
        },
        projectID: Instance.project.id,
        packageRevision,
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: projectPath,
          packageRevisionSHA256: packageRevision.packageDigest,
          timeCreated: now,
        }),
      })
      const processor = SessionProcessor.create({
        assistantMessage: assistant,
        sessionID: mission.id,
        model,
        abort: new AbortController().signal,
      })
      const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("mission", { config }))
      const structuredOutput =
        user.format?.type === "json_schema"
          ? {
              name: "StructuredOutput",
              owner: {
                source: "structured" as const,
                ref: `assistant:${assistant.id}:response-encoder`,
              },
              tool: SessionLoop.prepareProviderTool({
                name: "StructuredOutput",
                source: "structured",
                model,
                tool: SessionLoop.createStructuredOutputTool({ schema: user.format.schema, onSuccess() {} }),
              }),
            }
          : undefined
      const mutableNativeTransportIDs = NATIVE_MISSION_TRANSPORT_TOOL_IDS as unknown as string[]
      const schedulerIndex = mutableNativeTransportIDs.indexOf("scheduler_message")
      if (scenario === "legacy-reveal" && schedulerIndex >= 0) mutableNativeTransportIDs.splice(schedulerIndex, 1)
      const tools = (
        await resolveTestCapabilityTools({
          config,
          model,
          session: mission,
          assistant,
          processor,
          agent,
          agentID: "mission",
          messages: await Session.messages({ sessionID: mission.id }),
          includeMcpTools: false,
          ...(scenario === "structured-reveal" ? { activeLocalRefs: ["wait"] } : {}),
          ...(scenario === "legacy-reveal" ? { activeLocalRefs: ["scheduler_message"] } : {}),
          ...(structuredOutput ? { reservedProviderTools: [structuredOutput] } : {}),
        })
      ).tools
      if (scenario === "legacy-reveal" && schedulerIndex >= 0) {
        mutableNativeTransportIDs.splice(schedulerIndex, 0, "scheduler_message")
      }
      const schedulerMessage = tools.scheduler_message
      if (!schedulerMessage?.execute) throw new Error("Native Mission scheduler_message was not materialized.")
      let resolveAsked!: (request: PermissionAuthority.Request) => void
      const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
      const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => resolveAsked(properties))
      const toolCallID = "call_native_mission_permission_process"
      const pending = schedulerMessage
        .execute(
          {
            kind: "notification",
            task_id: taskID,
            subject: "Native Mission recovered permission",
            message: "Execute only under the exact approved Provider authority.",
          },
          { toolCallId: toolCallID, messages: [], abortSignal: new AbortController().signal },
        )
        .catch((error) => error)
      const request = await Promise.race([
        asked,
        pending.then((result) => {
          throw result instanceof Error ? result : new Error("scheduler_message settled before permission Ask")
        }),
      ])
      stop()
      const state: ProcessState = {
        requestID: request.id,
        missionSessionID: mission.id,
        assistantMessageID: assistant.id,
        taskID,
        toolCallID,
        scenario,
      }
      await fs.writeFile(statePath, `${JSON.stringify(state)}\n`, "utf8")
      process.stdout.write(`NATIVE_MISSION_PERMISSION_PREPARED=${JSON.stringify(state)}\n`)
      process.exit(0)
    },
  })
}

async function resume() {
  const state = JSON.parse(await fs.readFile(statePath, "utf8")) as ProcessState
  Provider.getModel = (async () => model) as typeof Provider.getModel
  LLM.stream = (async () => ({
    fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "finish-step", finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
      yield { type: "finish", finishReason: "stop", totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } }
    })(),
  })) as typeof LLM.stream
  if (mode === "resume-drift" || mode === "resume-missing") {
    const exactRuntimeTools = ToolRegistry.exactRuntimeTools
    ToolRegistry.exactRuntimeTools = (async (...args: Parameters<typeof ToolRegistry.exactRuntimeTools>) =>
      mode === "resume-missing"
        ? (await exactRuntimeTools(...args)).filter((item) => item.id !== "scheduler_message")
        : (await exactRuntimeTools(...args)).map((item) =>
            item.id === "scheduler_message"
              ? { ...item, description: `${item.description}\nChanged after the permission occurrence was approved.` }
              : item,
          )) as typeof ToolRegistry.exactRuntimeTools
  }
  if (mode === "resume-harness-drift") {
    const registry = PrimaryAssistantRegistry as typeof PrimaryAssistantRegistry & {
      get: typeof PrimaryAssistantRegistry.get
    }
    const get = registry.get
    registry.get = (async (...args: Parameters<typeof get>) => {
      const agent = await get(...args)
      if (args[0] !== "mission") return agent
      return {
        ...agent,
        tools: {
          ...agent.tools,
          global: (agent.tools?.global ?? []).filter((toolID) => toolID !== "scheduler_message"),
        },
      }
    }) as typeof PrimaryAssistantRegistry.get
  }
  await Instance.provide({
    directory: projectPath,
    fn: async () => {
      let staleName: string | undefined
      let staleMessage: string | undefined
      try {
        await PermissionAuthority.reply({
          requestID: state.requestID,
          decision: "allow_once",
          actorID: "native-mission-transport-process-test",
        })
      } catch (error) {
        if (!(error instanceof PermissionAuthority.StaleContinuationError)) throw error
        staleName = error.name
        staleMessage = error.message
      }
      const schedulerEvents = Database.use((db) =>
        db.select().from(ProtocolEventTable).where(eq(ProtocolEventTable.type, "scheduler.message")).all(),
      ).filter((event) => (event.payload as { subject?: string }).subject === "Native Mission recovered permission")
      const assistant = await MessageStore.get({
        sessionID: state.missionSessionID,
        messageID: state.assistantMessageID,
      })
      const toolPart = assistant.parts.find(
        (part) => part.type === "tool" && part.callID === state.toolCallID,
      )
      const staleEvents = (await PermissionAuthority.history()).filter(
        (event) => event.request_id === state.requestID && event.event_type === "stale",
      )
      process.stdout.write(
        `NATIVE_MISSION_PERMISSION_RESULT=${JSON.stringify({
          mode,
          staleName: staleName ?? null,
          staleMessage: staleMessage ?? null,
          schedulerEventCount: schedulerEvents.length,
          toolPartStatus: toolPart?.type === "tool" ? toolPart.state.status : null,
          staleEventCount: staleEvents.length,
          staleReasons: staleEvents.map((event) => event.reason),
        })}\n`,
      )
    },
  })
}

if (mode === "prepare") await prepare("plain")
else if (mode === "prepare-structured-reveal") await prepare("structured-reveal")
else if (mode === "prepare-legacy-reveal") await prepare("legacy-reveal")
else await resume()
