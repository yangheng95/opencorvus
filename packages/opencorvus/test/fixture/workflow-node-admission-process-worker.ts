import { Config } from "@/config/config"
import { EngineTaskRootIngressTable } from "@/engine/engine.sql"
import { joinProcessLivenessLease } from "@/engine/process-liveness"
import { acquireTaskRootIngressLease } from "@/engine/task-root-fact-store"
import { prepareTaskProcessBinding } from "@/engine/task-execution-capsule-binding"
import { TestHooks as TaskControlTestHooks } from "@/engine/task-root-ingress-delivery"
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
import { publishJSONBarrier } from "./json-barrier"

const [mode, projectPath, barrierPath] = process.argv.slice(2)
if ((mode !== "seed" && mode !== "execute-blocked" && mode !== "execute-peer") || !projectPath) {
  throw new Error("Workflow node admission worker requires seed|execute-blocked|execute-peer and project path")
}
if (mode === "execute-blocked" && !barrierPath) {
  throw new Error("Blocked workflow node admission worker requires a barrier path")
}

declareNativeTaskProcessDeployment()

const TASK_ID = Identifier.deterministic("task", "cross-process-workflow-node-admission")
const ROOT_SESSION_ID = Identifier.deterministic("session", "cross-process-workflow-node-root")
const ORCHESTRATOR_SESSION_ID = Identifier.deterministic("session", "cross-process-workflow-node-orchestrator")
const ASSISTANT_MESSAGE_ID = Identifier.deterministic("message", "cross-process-workflow-node-assistant")
const config = Config.Info.parse({
  model: "workflow-node-test-provider/workflow-node-test-model",
  prompt_profile: { active: "base" },
  mcp: { [BrowserMCPBuiltin.ServerName]: BrowserMCPBuiltin.localConfig() },
})
const model = {
  id: "workflow-node-test-model",
  providerID: "workflow-node-test-provider",
  name: "Workflow node admission test",
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
  api: { id: "workflow-node-admission-test", npm: "@ai-sdk/anthropic" },
  options: {},
} as Provider.Model

Provider.getModel = (async () => model) as typeof Provider.getModel
SessionProcessor.create = ((input: Parameters<typeof SessionProcessor.create>[0]) => {
  const assistant = input.assistantMessage
  return {
    message: assistant,
    partFromToolCall() {
      return undefined
    },
    async process() {
      await Session.updatePart({
        id: Identifier.deterministic("part", `workflow-node-result\0${assistant.id}`),
        sessionID: assistant.sessionID,
        messageID: assistant.id,
        type: "text",
        text: "Exact virtual workflow node completed",
      })
      assistant.finish = "stop"
      assistant.time.completed = Date.now()
      await Session.updateMessage(assistant)
      return "stop"
    },
  } as ReturnType<typeof SessionProcessor.create>
}) as typeof SessionProcessor.create

function occurrenceIDs(suffix: "winner" | "peer") {
  return {
    assistantMessageID: ASSISTANT_MESSAGE_ID,
    toolPartID: Identifier.deterministic("part", `workflow-node-admission-${suffix}`),
    toolCallID: Identifier.deterministic("call", `workflow-node-admission-${suffix}`),
  }
}

function dispatchInput(target: string) {
  return {
    dispatch: {
      target,
      work_scope: { kind: "task" as const },
      turn: {
        kind: "initial" as const,
        workflow_subject: {
          kind: "virtual_workflow" as const,
          workflow_id: "workflow-node-admission",
          node_id: "research",
        },
        use_worktree: false,
        input: {
          question: "Which exact workflow-node occurrence owns this Task?",
          reason: "Verify production outer pre-effect admission",
        },
      },
    },
  }
}

async function waitForBarrier(name: string): Promise<void> {
  const file = path.join(barrierPath!, name)
  while (!fs.existsSync(file)) await Bun.sleep(10)
}

async function run() {
  return Instance.provide({
    directory: projectPath,
    fn: async () => {
      using _ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
      const scheduler = await PromptProfileResolver.resolveSchedulerCapability({ projectDirectory: projectPath, config })
      const resolvedWorker = await PromptProfileResolver.resolveWorkerCapability({
        projectDirectory: projectPath,
        config,
        packageRevision: scheduler.packageRevision,
        agentID: "base-researcher",
      })
      const worker = {
        ...resolvedWorker,
        virtualWorkflows: {
          "workflow-node-admission": {
            label: "Workflow node admission",
            description: "One exact virtual workflow node used by the cross-process production admission test.",
            nodes: {
              research: {
                agent_id: resolvedWorker.identity.agentID,
                description: "Own the one exact production workflow-node occurrence.",
                depends_on: [],
              },
            },
          },
        },
      }
      const input = dispatchInput(worker.identity.agentID)
      if (mode === "seed") {
        const now = Date.now()
        const root = Session.prepareRootNext({
          id: ROOT_SESSION_ID,
          kind: "root",
          directory: Instance.directory,
          title: "Cross-process workflow node admission",
          metadata: {
            configOverlay: {
              model: "workflow-node-test-provider/workflow-node-test-model",
              prompt_profile: { active: scheduler.packageRevision.id },
            },
          },
        })
        persistEstablishedTask({
          taskID: TASK_ID,
          rootSession: root,
          now,
          title: "Cross-process workflow node admission",
          request: "Admit one immutable virtual workflow node before physical effects",
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
            rootDirectory: Instance.directory,
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
        if (!ingress) throw new Error(`Cross-process workflow-node Task ${TASK_ID} has no creation ingress`)
        const activation = acquireTaskRootIngressLease({
          ingressID: ingress.id,
          ownerOccurrenceID: `workflow-node-seed:${TASK_ID}`,
          now: now + 1,
          leaseMilliseconds: 120_000,
          assertControlOwnerInTransaction: () => undefined,
        })
        if (!activation.acquired) {
          throw new Error(`Cross-process workflow-node Task ${TASK_ID} could not acquire its ingress`)
        }
        const orchestrator = await Session.createNext({
          id: ORCHESTRATOR_SESSION_ID,
          kind: "orchestrator",
          parentID: root.id,
          directory: Instance.directory,
          title: "Cross-process workflow node orchestrator",
        })
        const control = currentOrchestratorControlMessage(
          { taskCreation: { taskID: TASK_ID } },
          TASK_ID,
          ingress.id,
          ingress.id,
        )
        if (!control) throw new Error(`Cross-process workflow-node Task ${TASK_ID} has no control Message`)
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
        for (const [index, suffix] of (["winner", "peer"] as const).entries()) {
          const ids = occurrenceIDs(suffix)
          await Session.updatePart({
            id: ids.toolPartID,
            sessionID: orchestrator.id,
            messageID: ids.assistantMessageID,
            type: "tool",
            callID: ids.toolCallID,
            tool: "dispatch_agent",
            state: { status: "running", input, time: { start: now + 3 + index } },
          })
        }
        return {
          mode,
          taskID: TASK_ID,
          rootSessionID: ROOT_SESSION_ID,
          orchestratorSessionID: ORCHESTRATOR_SESSION_ID,
        }
      }

      const suffix = mode === "execute-blocked" ? "winner" : "peer"
      const ids = occurrenceIDs(suffix)
      const liveness = joinProcessLivenessLease(currentRuntimeOccurrenceID())
      try {
        using _claimBarrier =
          mode === "execute-blocked"
            ? OrchestratorToolsTestHooks.replaceAfterDispatchLineageClaim(async ({ lineage }) => {
                await publishJSONBarrier(
                  path.join(barrierPath!, "ready.json"),
                  {
                    lineageID: lineage.artifactID,
                    dispatchID: lineage.dispatchID,
                    childSessionID: lineage.payload.child_session_id,
                  },
                )
                await waitForBarrier("release")
              })
            : undefined
        const surface = createOrchestratorTools({
          taskID: TASK_ID,
          agentSessionID: ORCHESTRATOR_SESSION_ID,
          sendSchedulerMessage,
          dispatchAgents: [worker],
        })
        const tool = surface.tools.dispatch_agent as {
          execute?: (toolInput: unknown, options: unknown) => Promise<unknown>
        }
        if (!tool.execute) throw new Error("Production dispatch_agent has no executor")
        const outcome = (await tool.execute(input, {
          toolCallId: ids.toolCallID,
          opencorvus: {
            sessionID: ORCHESTRATOR_SESSION_ID,
            messageID: ids.assistantMessageID,
            toolCallID: ids.toolCallID,
            toolPartID: ids.toolPartID,
            visibleToolName: "dispatch_agent",
          },
        })) as Record<string, unknown>
        const existing = await MessageStore.get({
          sessionID: ORCHESTRATOR_SESSION_ID,
          messageID: ids.assistantMessageID,
        })
        const part = existing.parts.find((candidate) => candidate.id === ids.toolPartID)
        if (!part || part.type !== "tool" || part.state.status !== "running") {
          throw new Error(`Production dispatch_agent outer occurrence is ${part?.type === "tool" ? part.state.status : "missing"}`)
        }
        await Session.updatePart({
          id: ids.toolPartID,
          sessionID: ORCHESTRATOR_SESSION_ID,
          messageID: ids.assistantMessageID,
          type: "tool",
          callID: ids.toolCallID,
          tool: "dispatch_agent",
          state: {
            status: "completed",
            input,
            output: JSON.stringify(outcome),
            title: String(outcome.kind ?? "dispatch_agent"),
            metadata: {},
            time: { start: part.state.time.start, end: Date.now() },
          },
        })
        return { mode, outcome, outerStatus: "completed" }
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
