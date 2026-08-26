import { afterEach, describe, expect, spyOn, test } from "bun:test"
import { Identifier } from "../src/id/id"
import { Instance } from "../src/project/instance"
import { Config } from "../src/config/config"
import { Session } from "../src/session"
import { EngineService } from "../src/task-api"
import { TestHooks as TaskControlTestHooks } from "../src/engine/task-root-ingress-delivery"
import { InstanceBootstrap } from "../src/project/bootstrap"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

describe("Task operator message acceptance is one transaction", () => {
  test("a failed acceptance leaves no overlay or message, and the retry commits every fact together", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      init: InstanceBootstrap,
      fn: async () => {
        // The orchestrator loop is out of scope: acceptance atomicity is the
        // contract under test, so ingress wakes run a no-op runner.
        using _ingressRunner = TaskControlTestHooks.replaceTaskIngressRunner({ runner: async () => ({}) })
        await Config.updateProjectPatch({
          provider: {
            "overlay-test-provider": {
              name: "Overlay test provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:9/overlay-test-model",
              models: {
                "overlay-test-model": {
                  name: "Overlay test model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })
        const taskID = await EngineService.createTask(
          {
            requestID: `arc011-${Identifier.ascending("artifact")}`,
            request: "Accept operator messages atomically",
            productPillar: "code",
            model: "firmware/gpt-5",
            promptProfile: "base",
          },
          { actor: "user" },
        )
        const task = await EngineService.getTask(taskID)
        const overlayModel = async () => {
          const rootSession = await Session.get(task.sessionID!)
          const overlay = (rootSession.metadata as Record<string, any> | undefined)?.configOverlay
          return typeof overlay?.model === "string" ? overlay.model : undefined
        }
        const userMessageCount = async () =>
          (await Session.messages({ sessionID: task.sessionID! })).filter((m) => m.info.role === "user").length
        const baselineMessages = await userMessageCount()
        expect(await overlayModel()).toBe("firmware/gpt-5")

        // An injected failure at the Message persist: the whole acceptance —
        // overlay included — must leave nothing behind. The injection is
        // selective (this task root Session, this exact text) so the Task's
        // own background orchestrator persists are untouched.
        const originalPersist = Session.persistMessageWithCommit
        const persist = spyOn(Session, "persistMessageWithCommit").mockImplementation((bundle: any, ...rest: any[]) => {
          const text = Array.isArray(bundle?.parts)
            ? bundle.parts.map((part: any) => (typeof part?.text === "string" ? part.text : "")).join("")
            : ""
          if (bundle?.info?.sessionID === task.sessionID && text.includes("switch models and continue")) {
            throw new Error("injected acceptance commit failure")
          }
          return (originalPersist as any)(bundle, ...rest)
        })
        try {
          await expect(
            EngineService.handleTaskMessage(taskID, {
              source: "api",
              source: "api",
          text: "switch models and continue",
              model: "overlay-test-provider/overlay-test-model",
            }),
          ).rejects.toThrow("injected acceptance commit failure")
        } finally {
          persist.mockRestore()
        }
        expect({ overlay: await overlayModel(), userMessages: await userMessageCount() }).toEqual({
          overlay: "firmware/gpt-5",
          userMessages: baselineMessages,
        })

        // The retried message commits the Message, its ingress and the
        // overlay together.
        const note = await EngineService.handleTaskMessage(taskID, {
          source: "api",
          text: "switch models and continue",
          model: "overlay-test-provider/overlay-test-model",
        })
        expect({
          overlay: await overlayModel(),
          userMessages: await userMessageCount(),
          hasIngress: typeof (note as { ingress_id?: string }).ingress_id === "string",
          messageRole: note.user_message.info.role,
        }).toEqual({
          overlay: "overlay-test-provider/overlay-test-model",
          userMessages: baselineMessages + 1,
          hasIngress: true,
          messageRole: "user",
        })
      },
    })
  }, 120_000)
})
