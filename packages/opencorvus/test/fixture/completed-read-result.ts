import { Bus } from "../../src/bus"
import { Config } from "../../src/config/config"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { Identifier } from "../../src/id/id"
import { PermissionAuthority } from "../../src/permission/authority"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { Message } from "../../src/session/message"
import { SessionProcessor } from "../../src/session/processor"
import { ReadTool } from "../../src/tool/read"
import { executeWebFetch } from "../../src/tool/webfetch"
import { withTaskToolInvocation } from "../../src/tool/task-tool-invocation"
import { Tool } from "../../src/tool/tool"
import { ensureMissionSession, setMissionPendingPrompt } from "../../src/mission/session"
import { openMissionExecutionWithWake } from "../../src/mission/execution-closure"
import { SessionWake } from "../../src/session/wake"
import { randomUUID } from "node:crypto"

export const resultRecoveryModel = {
  id: "result-recovery-contract", providerID: "local-contract", name: "Result recovery contract",
  api: { id: "result-recovery-contract", npm: "@ai-sdk/anthropic" }, options: {},
  limit: { context: 100000, input: 90000, output: 4096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: { toolcall: true, attachment: false, reasoning: false, temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false } },
} as Provider.Model

export async function openResultRecoveryMission() {
  const model = resultRecoveryModel
  await Config.updateProjectPatch({ model: `${model.providerID}/${model.id}`, provider: {
    [model.providerID]: { name: "Recovery contract", npm: "@ai-sdk/openai-compatible", api: "http://127.0.0.1:1/v1",
      models: { [model.id]: { name: "Recovery contract", tool_call: true, modalities: { input: ["text"], output: ["text"] }, limit: { context: 100000, output: 4096 } } } },
  } })
  const mission = await ensureMissionSession({ missionID: `result-${randomUUID()}`,
    defaultCwd: Instance.directory, productPillar: "code", heldExpertSquadIDs: ["base"] })
  await setMissionPendingPrompt({ session: mission, pendingPrompt: { text: "Read the recovery input" } })
  using wakeConsumer = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
  await openMissionExecutionWithWake({ missionID: mission.missionID, sessionID: mission.id, source: "mission.dispatch",
    requestID: `${mission.id}:open`, acceptedInput: { text: "Read the recovery input", model: null, attachments: [], configPatch: {}, context: {} },
    wake: (admission) => SessionWake.wakeWithReceipt({ sessionID: mission.id, messageID: admission.messageID,
      textPartID: admission.textPartID, controlID: admission.controlID, prompt: "Read the recovery input", author: "user",
      agent: "mission", surface: "panel", userAuthored: true,
      reason: { source: "mission.operator", missionID: mission.missionID,
        requestID: admission.operatorRequest!.requestID, requestFingerprint: admission.operatorRequest!.requestFingerprint,
        openedEventID: admission.closureEventID },
      commitBundle: admission.commitBundle, preflightBundle: admission.preflightBundle,
      ownerPreflight: admission.ownerPreflight, ownerLifecycle: admission.ownerLifecycle }),
  })
  return mission
}

/** Execute an actual permission-bearing file or web read; leave its result open. */
export async function completedReadResult(input: {
  mode: "full_access" | "ask"
  session?: Session.Info
  message?: Message.Assistant
  taskID?: string
} & ({ filePath: string; url?: never } | { url: string; filePath?: never })) {
  await Config.updateProjectPatch({ permission_mode: input.mode })
  const session = input.session ?? await Session.create({ kind: "assistant", title: "Tool result recovery" })
  const model = resultRecoveryModel
  const user = input.message ? undefined : await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, role: "user", author: "user", agent: "build",
    time: { created: Date.now() }, model: { providerID: model.providerID, modelID: model.id },
  })
  const assistant = input.message ?? await Session.updateMessage({
    id: Identifier.ascending("message"), sessionID: session.id, parentID: user!.id,
    role: "assistant", author: "build", agent: "build", time: { created: Date.now() },
    modelID: model.id, providerID: model.providerID, path: { cwd: Instance.directory, root: Instance.directory },
    cost: 0, tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  if (assistant.role !== "assistant") throw new Error("Assistant fixture required")
  const abort = new AbortController().signal
  const processor = SessionProcessor.create({ assistantMessage: assistant, sessionID: session.id, model, abort })
  const toolName = input.url === undefined ? "read" : "webfetch"
  const args = input.url === undefined ? { filePath: input.filePath, offset: 1, limit: 1 }
    : { url: input.url, format: "markdown" as const }
  const callID = `read-${Identifier.ascending("part")}`
  const part = await processor.ensureToolPart(callID, toolName, args)
  const executionSurface = Tool.executionSurface([toolName], [])
  const context: Tool.Context = {
    sessionID: session.id, messageID: assistant.id, callID, agent: "build", abort, messages: [],
    executionSurface, metadata() {}, executionAuthority: await resolveSessionExecutionAuthority({
      sessionID: session.id, projectID: Instance.project.id,
      expected: input.taskID ? { kind: "task", taskID: input.taskID } : { kind: "conversation" },
    }),
  }
  const execute = input.url === undefined
    ? async () => (await ReadTool.init()).execute({ filePath: input.filePath, offset: 1, limit: 1 }, context)
    : () => executeWebFetch({ url: input.url, format: "markdown" }, context)
  let executeCount = 0
  let resolveAsked!: (request: PermissionAuthority.Request) => void
  const asked = new Promise<PermissionAuthority.Request>((resolve) => (resolveAsked = resolve))
  const stop = Bus.subscribe(PermissionAuthority.Event.Asked, ({ properties }) => {
    if (properties.toolCallID === callID) resolveAsked(properties)
  })
  try {
    const pending = withTaskToolInvocation({
      projectID: Instance.project.id, sessionID: session.id, messageID: assistant.id,
      toolCallID: callID, toolPartID: part.id, providerName: toolName, providerKind: "builtin", providerID: "builtin", args,
    }, executionSurface, async () => { executeCount++; return execute() })
    if (input.mode === "ask") {
      const request = await asked
      await PermissionAuthority.reply({ requestID: request.id, decision: "allow_once", actorID: "owned-recovery-contract" })
    }
    const result = await pending
    return { session, assistant, processor, part, args, callID, result, executeCount: () => executeCount }
  } finally { stop() }
}
