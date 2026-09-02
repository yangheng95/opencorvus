import { Config } from "@/config/config"
import { joinProcessLivenessLease } from "@/engine/process-liveness"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import {
  reconcileTaskControlPlane,
  TestHooks as TaskControlTestHooks,
} from "@/engine/task-root-ingress-delivery"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { Identifier } from "@/id/id"
import { BrowserMCPBuiltin } from "@/mcp/browser/builtin"
import { createOrchestratorTools, OrchestratorToolsTestHooks } from "@/orchestrator/tools"
import { currentOrchestratorControlMessage } from "@/orchestrator/agent"
import { Provider } from "@/provider/provider"
import { Instance } from "@/project/instance"
import { sendSchedulerMessage } from "@/protocol/scheduler-message"
import { currentRuntimeOccurrenceID } from "@/runtime/process-occurrence"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { SessionProcessor } from "@/session/processor"
import { Database, eq } from "@/storage/db"
import fs from "node:fs"
import path from "node:path"
import { persistEstablishedTask } from "../fixture/engine-task"

const [mode, projectPath, barrierPath] = process.argv.slice(2)
if (
  (mode !== "seed" &&
    mode !== "execute-blocked" &&
    mode !== "execute-replay" &&
    mode !== "execute-takeover" &&
    mode !== "execute-takeover-held" &&
    mode !== "scan") ||
  !projectPath
) {
  throw new Error(
    "Dispatch occurrence worker requires seed|execute-blocked|execute-replay|execute-takeover|execute-takeover-held|scan and project path",
  )
}
if ((mode === "execute-blocked" || mode === "execute-takeover-held") && !barrierPath) {
  throw new Error("Blocked or held dispatch occurrence worker requires a barrier path")
}

declareNativeTaskProcessDeployment()

const TASK_ID = Identifier.deterministic("task", "cross-process-dispatch-occurrence-claim")
const ROOT_SESSION_ID = Identifier.deterministic("session", "cross-process-dispatch-occurrence-root")
const ORCHESTRATOR_SESSION_ID = Identifier.deterministic("session", "cross-process-dispatch-occurrence-orchestrator")
const ASSISTANT_MESSAGE_ID = Identifier.deterministic("message", "cross-process-dispatch-occurrence-assistant")
const TOOL_PART_ID = Identifier.deterministic("part", "cross-process-dispatch-occurrence-tool-part")
const TOOL_CALL_ID = Identifier.deterministic("call", "cross-process-dispatch-occurrence-tool-call")

const config = Config.Info.parse({
  model: "dispatch-admission-test-provider/dispatch-admission-test-model",
  prompt_profile: { active: "base" },
  mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
})

const model = {
  id: "dispatch-admission-test-model",
  providerID: "dispatch-admission-test-provider",
  name: "Dispatch admission test",
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
  api: { id: "dispatch-admission-test", npm: "@ai-sdk/anthropic" },
  options: {},
} as Provider.Model

Provider.getModel = (async () => model) as typeof Provider.getModel
SessionProcessor.create = ((input: Parameters<typeof SessionProcessor.create>[0]) => {
  const assistant = input.assistantMessage
  return {
    message: assistant,
    partFromToolCall() { return undefined },
    async process() {
      if (mode === "execute-takeover-held") {
        fs.writeFileSync(path.join(barrierPath!, "worker-ready.json"), "ready")
        await waitForBarrierFile("worker-release")
      }
      await Session.updatePart({
        id: Identifier.deterministic("part", `dispatch-admission-result\0${assistant.id}`),
        sessionID: assistant.sessionID,
        messageID: assistant.id,
        type: "text",
        text: "Exact dispatch admission completed",
      })
      assistant.finish = "stop"
      assistant.time.completed = Date.now()
      await Session.updateMessage(assistant)
      return "stop"
    },
  } as ReturnType<typeof SessionProcessor.create>
}) as typeof SessionProcessor.create

function collectionInput(target: string) {
  return {
    team: [
      {
        name: "claim-worker",
        target,
        responsibility: "Own the exact cross-process dispatch occurrence",
        boundary: "Create only the claimed worker Session and durable Turn",
        expected_result: "Return one descriptor-backed dispatch receipt",
        depends_on: [],
      },
    ],
    dispatches: [
      {
        dispatch: {
          target,
          work_scope: { kind: "task" as const },
          turn: {
            kind: "initial" as const,
            workflow_subject: { kind: "direct" as const },
            use_worktree: false,
            input: {
              question: "Which exact dispatch admission occurrence is active?",
              reason: "Verify cross-process claim readiness",
            },
          },
        },
      },
    ],
  }
}

async function waitForBarrierFile(name: string): Promise<void> {
  const target = path.join(barrierPath!, name)
  while (!fs.existsSync(target)) await new Promise((resolve) => setTimeout(resolve, 10))
}

async function run() {
  return Instance.provide({
    directory: projectPath,
    fn: async () => {
      using _ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
      const scheduler = await PromptProfileResolver.resolveSchedulerCapability({ projectDirectory: projectPath, config })
      const worker = await PromptProfileResolver.resolveWorkerCapability({
        projectDirectory: projectPath,
        config,
        packageRevision: scheduler.packageRevision,
        agentID: "base-researcher",
      })
      const input = collectionInput(worker.identity.agentID)
      if (mode === "seed") {
        const now = Date.now()
        const root = Session.prepareRootNext({
          id: ROOT_SESSION_ID,
          kind: "root",
          directory: projectPath,
          title: "Cross-process dispatch occurrence claim",
          metadata: {
            configOverlay: {
              model: "dispatch-admission-test-provider/dispatch-admission-test-model",
              prompt_profile: { active: scheduler.packageRevision.id },
            },
          },
        })
        persistEstablishedTask({
          taskID: TASK_ID,
          rootSession: root,
          now,
          title: "Cross-process dispatch occurrence claim",
          request: "Admit one physical worker effect for one persisted dispatch collection member",
          productPillar: "code",
          source: "test",
          priority: "normal",
          metadata: {},
          projectID: Instance.project.id,
          packageRevision: scheduler.packageRevision,
          executionCapsuleBinding: await prepareTaskProcessBinding({
            mode: "native",
            taskID: TASK_ID,
            projectID: Instance.project.id,
            rootDirectory: projectPath,
            packageRevisionSHA256: scheduler.packageRevision.packageDigest,
            timeCreated: now,
          }),
        })
        const ingress = Database.use((db) =>
          db
            .select()
            .from(EngineTaskRootIngressTable)
            .where(eq(EngineTaskRootIngressTable.task_id, TASK_ID))
            .orderBy(EngineTaskRootIngressTable.sequence, EngineTaskRootIngressTable.id)
            .get(),
        )
        if (!ingress) throw new Error(`Cross-process dispatch Task ${TASK_ID} has no creation ingress`)
        const activation = acquireTaskRootIngressLease({
          ingressID: ingress.id,
          ownerOccurrenceID: `dispatch-claim-seed:${TASK_ID}`,
          now: now + 1,
          leaseMilliseconds: 120_000,
          assertControlOwnerInTransaction: () => undefined,
        })
        if (!activation.acquired) throw new Error(`Cross-process dispatch Task ${TASK_ID} could not acquire its ingress`)
        const orchestrator = await Session.createNext({
          id: ORCHESTRATOR_SESSION_ID,
          kind: "orchestrator",
          parentID: root.id,
          directory: projectPath,
          title: "Cross-process dispatch occurrence orchestrator",
        })
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID: TASK_ID } },
          TASK_ID,
          ingress.id,
          ingress.id,
        )
        if (!control) throw new Error(`Cross-process dispatch Task ${TASK_ID} has no control Message`)
        await Session.updateMessage({
          id: control.messageID,
          sessionID: orchestrator.id,
          role: "user",
          author: "orchestrator",
          agent: "orchestrator",
          model: { providerID: "test", modelID: "test-model" },
          extra: control.extra,
          time: { created: now + 1 },
        })
        await Session.updatePart({
          id: control.partID,
          sessionID: orchestrator.id,
          messageID: control.messageID,
          type: "text",
          text: control.text,
          kind: "control",
          source: "system",
        })
        await Session.updateMessage({
          id: ASSISTANT_MESSAGE_ID,
          parentID: control.messageID,
          acceptedInputMessageIDs: [control.messageID],
          sessionID: orchestrator.id,
          role: "assistant",
          author: "orchestrator",
          agent: "orchestrator",
          providerID: "test",
          modelID: "test-model",
          path: { cwd: projectPath, root: projectPath },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          activationID: activation.activationID,
          time: { created: now + 2 },
        })
        await Session.updatePart({
          id: TOOL_PART_ID,
          sessionID: orchestrator.id,
          messageID: ASSISTANT_MESSAGE_ID,
          type: "tool",
          callID: TOOL_CALL_ID,
          tool: "dispatch_agents",
          state: { status: "running", input, time: { start: now + 3 } },
        })
        return { mode, taskID: TASK_ID, rootSessionID: root.id, toolPartID: TOOL_PART_ID }
      }

      const liveness = joinProcessLivenessLease(currentRuntimeOccurrenceID())
      try {
        if (mode === "scan") {
          await reconcileTaskControlPlane(TASK_ID)
          return { mode }
        }
        using _claimBarrier =
          mode === "execute-blocked"
            ? OrchestratorToolsTestHooks.replaceAfterDispatchLineageClaim(async ({ lineage }) => {
                fs.writeFileSync(
                  path.join(barrierPath!, "ready.json"),
                  JSON.stringify({
                    ownerOccurrenceID: currentRuntimeOccurrenceID(),
                    lineageID: lineage.artifactID,
                    dispatchID: lineage.dispatchID,
                    childSessionID: lineage.payload.child_session_id,
                  }),
                )
                await waitForBarrierFile("materialize")
              })
            : undefined
        const surface = createOrchestratorTools({
          taskID: TASK_ID,
          agentSessionID: ORCHESTRATOR_SESSION_ID,
          sendSchedulerMessage,
          dispatchAgents: [worker],
        })
        const frontier = surface.tools.dispatch_agents as {
          execute?: (frontierInput: unknown, options: unknown) => Promise<unknown>
        }
        if (!frontier.execute) throw new Error("Production dispatch_agents has no executor")
        const result = (await frontier.execute(input, {
          toolCallId: TOOL_CALL_ID,
          opencorvus: {
            sessionID: ORCHESTRATOR_SESSION_ID,
            messageID: ASSISTANT_MESSAGE_ID,
            toolCallID: TOOL_CALL_ID,
            toolPartID: TOOL_PART_ID,
            visibleToolName: "dispatch_agents",
          },
        })) as { title: string; output: string; metadata: Record<string, unknown> }
        const existing = await MessageStore.get({ sessionID: ORCHESTRATOR_SESSION_ID, messageID: ASSISTANT_MESSAGE_ID })
        const part = existing.parts.find((candidate) => candidate.id === TOOL_PART_ID)
        if (!part || part.type !== "tool") {
          throw new Error("Production dispatch_agents outer occurrence is missing")
        }
        const ownsOuterOutcome =
          mode === "execute-blocked" || mode === "execute-takeover" || mode === "execute-takeover-held"
        if (part.state.status === "running" && ownsOuterOutcome) {
          await Session.updatePart({
            id: TOOL_PART_ID,
            sessionID: ORCHESTRATOR_SESSION_ID,
            messageID: ASSISTANT_MESSAGE_ID,
            type: "tool",
            callID: TOOL_CALL_ID,
            tool: "dispatch_agents",
            state: {
              status: "completed",
              input,
              output: result.output,
              title: result.title,
              metadata: result.metadata,
              time: { start: part.state.time.start, end: Date.now() },
            },
          })
        } else if (part.state.status !== "running" && part.state.status !== "completed") {
          throw new Error(`Production dispatch_agents outer occurrence is ${part.state.status}`)
        }
        const member = (JSON.parse(result.output) as { members: Array<{ outcome?: unknown }> }).members[0]
        if (mode === "execute-takeover-held") {
          fs.writeFileSync(
            path.join(barrierPath!, "accepted-ready.json"),
            JSON.stringify({ ownerOccurrenceID: currentRuntimeOccurrenceID() }),
          )
          await waitForBarrierFile("process-release")
        }
        return {
          mode,
          memberOutcome: member?.outcome,
          outerOutput: result.output,
          outerStatus: ownsOuterOutcome ? "completed" : part.state.status,
        }
      } finally {
        liveness.release()
      }
    },
  })
}

try {
  process.stdout.write(`${JSON.stringify(await run())}\n`)
} finally {
  await Instance.disposeAll().catch(() => undefined)
  try {
    Database.close()
  } catch {}
}
