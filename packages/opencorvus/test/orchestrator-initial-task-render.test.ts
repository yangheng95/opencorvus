import { afterEach, expect, spyOn, test } from "bun:test"
import { Orchestrator } from "@/orchestrator/agent"
import { Bus } from "@/bus"
import {
  TestHooks as TaskControlTestHooks,
  taskRootIngressDebugProjection,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { requireTask } from "@/engine/store"
import { EngineGit } from "@/engine/git"
import { Instance } from "@/project/instance"
import { Provider } from "@/provider/provider"
import type { Provider as ProviderType } from "@/provider/provider"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionProcessor } from "@/session/processor"
import { SessionRuntimeContractStore } from "@/session/runtime-contract"
import { SessionPrompt } from "@/session/prompt"
import { EngineService } from "@/task-api"
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

const model = { providerID: "test", modelID: "orchestrator-initial-render" }

function providerModel(): ProviderType.Model {
  return {
    id: model.modelID,
    providerID: model.providerID,
    name: "Orchestrator initial render test",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      interleaved: false,
      input: { text: true, image: false, audio: false, video: false, pdf: false },
      output: { text: true, image: false, audio: false, video: false, pdf: false },
    },
    api: { id: model.modelID, url: "https://orchestrator-render.test.invalid", npm: "@ai-sdk/anthropic" },
    options: {},
    headers: {},
    status: "active",
    release_date: "2026-08-15",
  } as ProviderType.Model
}

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

test("a fresh typed Task ingress installs runtime authority before creator and control Messages", async () => {
  using _durableDrain = Bus.TestHooks.suppressAutomaticDurableDrain()
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      using _runner = TaskControlTestHooks.replaceTaskIngressRunner({
        runner: async (input) =>
          await Orchestrator.processTask(
            input.taskID,
            input.event,
            input.signal,
            input.wakeID,
            input.activationID,
            input.predecessorID,
          ).then((finalMessageID) => ({ finalMessageID })),
      })
      const providerSpy = spyOn(Provider, "getModel").mockResolvedValue(providerModel())
      const gitPrepareSpy = spyOn(EngineGit, "prepare").mockImplementation(async (task) => ({ task }))
      const gitCompleteSpy = spyOn(EngineGit, "complete").mockImplementation(async (task) => ({ task }))
      let observed:
        | {
            sessionID: string
            userMessages: Message.WithParts[]
            runtimeTaskID: string | undefined
          }
        | undefined
      const assistantMessageIDs: string[] = []
      const retainAssistantOnToolContinuation: boolean[] = []
      const retainedDecisionGaps: boolean[] = []
      const decisionRepairPrompts: boolean[] = []
      const providerToolRequests: Array<{ toolIDs: string[]; toolChoice: "auto" | "required" | "none" | object }> = []
      const promptSystemAudits: Array<{ countMatch: boolean; runtimeLabels: string[] }> = []
      const atomicCreatorCuts: Array<{ creatorID: string; controlIDs: string[] }> = []
      let providerSteps = 0
      const unsubscribeCreated = Bus.subscribe(Message.Event.Created, async (event) => {
        const info = event.properties.info
        if (info.role !== "user" || info.agent !== "orchestrator" || info.author !== "user") return
        const creatorExtra = info.extra as { orchestrator_control_ingress?: unknown } | undefined
        if (creatorExtra?.orchestrator_control_ingress) return
        const visible = await Session.messages({ sessionID: info.sessionID })
        atomicCreatorCuts.push({
          creatorID: info.id,
          controlIDs: visible
            .filter(
              (item) =>
                item.info.role === "user" &&
                Boolean(
                  (item.info.extra as { orchestrator_control_ingress?: unknown } | undefined)
                    ?.orchestrator_control_ingress,
                ),
            )
            .map((item) => item.info.id),
        })
      })
      const processorSpy = spyOn(SessionProcessor, "create").mockImplementation((input: any) => {
        const assistant = input.assistantMessage as Message.Assistant
        assistantMessageIDs.push(assistant.id)
        retainAssistantOnToolContinuation.push(input.retainAssistantOnToolContinuation)
        return {
          message: assistant,
          partFromToolCall() {
            return undefined
          },
          async process(processInput: {
            system: string[]
            systemLabels?: string[]
            tools: Record<string, unknown>
            toolChoice?: "auto" | "required" | "none" | { type: "tool"; toolName: string }
          }) {
            providerSteps += 1
            providerToolRequests.push({
              toolIDs: Object.keys(processInput.tools).sort(),
              toolChoice: processInput.toolChoice ?? "auto",
            })
            promptSystemAudits.push({
              countMatch: processInput.system.length === processInput.systemLabels?.length,
              runtimeLabels: (processInput.systemLabels ?? []).filter((label) => label.startsWith("runtime:")),
            })
            decisionRepairPrompts.push(processInput.system.some((part) => part.includes("<task-root-decision-repair>")))
            const messages = await Session.messages({ sessionID: assistant.sessionID })
            observed = {
              sessionID: assistant.sessionID,
              userMessages: messages.filter((item) => item.info.role === "user"),
              runtimeTaskID: SessionRuntimeContractStore.get(assistant.sessionID)?.identity.taskID,
            }
            await Session.updatePart({
              id: Identifier.ascending("part"),
              sessionID: assistant.sessionID,
              messageID: assistant.id,
              type: "text",
              text:
                providerSteps === 1
                  ? "The Task is visible; inspect the available delivery evidence."
                  : "The Task evidence is inspected and ready for a scheduling decision.",
            })
            if (providerSteps === 1) {
              await Session.updatePart({
                id: Identifier.ascending("part"),
                sessionID: assistant.sessionID,
                messageID: assistant.id,
                type: "step-finish",
                reason: "stop",
                cost: 0,
                tokens: { total: 1, input: 1, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
              })
              assistant.finish = "stop"
              await Session.updateMessage(assistant)
              retainedDecisionGaps.push(await input.retainAssistantForNextProviderStep(assistant))
              return "continue"
            }
            const decisionPartID = Identifier.ascending("part")
            const decisionStartedAt = Date.now()
            await Session.updatePart({
              id: decisionPartID,
              sessionID: assistant.sessionID,
              messageID: assistant.id,
              type: "tool",
              callID: "initial-render-decision",
              tool: "manage_task",
              state: {
                status: "running",
                input: { action: "record_renderable_turn" },
                time: { start: decisionStartedAt },
              },
            })
            await Session.updatePart({
              id: decisionPartID,
              sessionID: assistant.sessionID,
              messageID: assistant.id,
              type: "tool",
              callID: "initial-render-decision",
              tool: "manage_task",
              state: {
                status: "completed",
                input: { action: "record_renderable_turn" },
                output: "Renderable Turn recorded",
                title: "Renderable Turn",
                metadata: {},
                time: { start: decisionStartedAt, end: decisionStartedAt + 1 },
              },
            })
            assistant.finish = "stop"
            assistant.time.completed = Date.now()
            await Session.updateMessage(assistant)
            return "stop"
          },
        } as any
      })

      try {
        const taskID = await EngineService.createTask(
          {
            requestID: `initial-render-${Identifier.ascending("artifact")}`,
            title: "Renderable initial Task",
            request: "Create one renderable Orchestrator conversation",
            productPillar: "work",
            model: `${model.providerID}/${model.modelID}`,
            promptProfile: "base",
          },
          { actor: "user" },
        )
        await waitForIngressDeliveryHooksForTest()

        const task = requireTask(taskID)
        const child = (await Session.children(task.session_id!)).find((session) => session.kind === "orchestrator")
        expect(child).toBeDefined()
        const messages = await Session.messages({ sessionID: child!.id })
        const ingressDebug = taskRootIngressDebugProjection(taskID)
        expect({
          taskError: task.error,
          providerSteps,
          assistantMessageIDs,
          retainAssistantOnToolContinuation,
          retainedDecisionGaps,
          decisionRepairPrompts,
          providerToolRequests,
          promptSystemAudits,
          ingressDebug: ingressDebug.map((entry) => ({
            activationCount: entry.activationIDs.length,
            decisionGapCount: entry.decisionGapStepIDs.length,
            semanticAttemptCount: entry.semanticAttemptIDs.length,
            state: entry.projection.state,
          })),
          observed: {
            sessionID: observed?.sessionID,
            runtimeTaskID: observed?.runtimeTaskID,
            userRoles: observed?.userMessages.map((item) => item.info.author),
          },
          persisted: messages.map((item) => ({
            id: item.info.id,
            parentID: item.info.role === "assistant" ? item.info.parentID : undefined,
            role: item.info.role,
            author: item.info.author,
            parts: item.parts.length,
          })),
        }).toEqual({
          taskError: null,
          providerSteps: 2,
          assistantMessageIDs: [expect.any(String), expect.any(String)],
          retainAssistantOnToolContinuation: [true, true],
          retainedDecisionGaps: [true],
          decisionRepairPrompts: [false, true],
          providerToolRequests: [
            { toolIDs: ["capability_search"], toolChoice: "auto" },
            { toolIDs: ["capability_search"], toolChoice: "auto" },
          ],
          promptSystemAudits: [
            {
              countMatch: true,
              runtimeLabels: [
                "runtime:orchestrator-instructions",
                "runtime:orchestrator-wake-and-capabilities",
                "runtime:orchestrator-live-task-baseline",
                "runtime:orchestrator-live-task-delta",
                "runtime:orchestrator-current-ingress",
              ],
            },
            {
              countMatch: true,
              runtimeLabels: [
                "runtime:orchestrator-instructions",
                "runtime:orchestrator-wake-and-capabilities",
                "runtime:orchestrator-live-task-baseline",
                "runtime:orchestrator-live-task-delta",
                "runtime:orchestrator-current-ingress",
              ],
            },
          ],
          ingressDebug: [{ activationCount: 1, decisionGapCount: 1, semanticAttemptCount: 1, state: "resolved" }],
          observed: {
            sessionID: child!.id,
            runtimeTaskID: taskID,
            userRoles: ["user", "orchestrator"],
          },
          persisted: [
            expect.objectContaining({ role: "user", author: "user", parts: 1 }),
            expect.objectContaining({ role: "user", author: "orchestrator", parts: 1 }),
            expect.objectContaining({ role: "assistant", author: "orchestrator", parts: 4 }),
          ],
        })
        expect(new Set(assistantMessageIDs).size).toBe(1)
        const [creator, control, assistant] = messages
        expect({
          atomicCreatorCuts,
          creatorBeforeControl: creator!.info.time.created < control!.info.time.created,
          assistantParentID: assistant!.info.role === "assistant" ? assistant!.info.parentID : undefined,
          controlID: control!.info.id,
        }).toEqual({
          atomicCreatorCuts: [{ creatorID: creator!.info.id, controlIDs: [control!.info.id] }],
          creatorBeforeControl: true,
          assistantParentID: control!.info.id,
          controlID: control!.info.id,
        })
        await SessionPrompt.waitForFinish(child!.id, project.path)
      } finally {
        unsubscribeCreated()
        await Database.awaitEffectIdle(30_000)
        gitCompleteSpy.mockRestore()
        gitPrepareSpy.mockRestore()
        processorSpy.mockRestore()
        providerSpy.mockRestore()
      }
    },
  })
  await waitForIngressDeliveryHooksForTest()
  await Instance.disposeAll()
  await Database.awaitEffectIdle(30_000)
}, 60_000)
