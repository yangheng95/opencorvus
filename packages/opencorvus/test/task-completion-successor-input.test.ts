import { afterEach, expect, spyOn, test } from "bun:test"
import { Config } from "@/config/config"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { EngineGit } from "@/engine/git"
import { taskLifecycleProjection } from "@/engine/task-lifecycle"
import {
  TestHooks as Ingress,
  taskRootIngressDebugProjection,
  waitForIngressDeliveryHooksForTest,
} from "@/engine/task-root-ingress-delivery"
import { runTaskLoop } from "@/orchestrator/loop"
import { Instance } from "@/project/instance"
import { Server } from "@/server/server"
import { Database, and, eq } from "@/storage/db"
import { EngineService } from "@/task-api"
import { controlledMemoryReply, controlledProviderRequestKind } from "./fixture/controlled-streaming-provider"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function within<T>(operation: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`Timed out: ${label}`)), 40_000)
      }),
    ])
  } finally {
    clearTimeout(timer)
  }
}

test("handles accepted successor Messages in the original Task before committing completion", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const entered = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const prompts: string[] = []
      const statuses: string[] = []
      let calls = 0
      let taskID = ""
      // Actual streamed HTTP model transport; only the model's choices are scripted.
      const provider = Bun.serve({
        hostname: "127.0.0.1",
        port: 0,
        async fetch(request) {
          const body = (await request.json()) as any
          const memory = controlledProviderRequestKind(body.messages ?? []) === "memory"
          const root = body.tools?.some((tool: any) => tool.function?.name === "manage_task")
          if (root) {
            prompts.push(JSON.stringify(body.messages))
            statuses.push(taskLifecycleProjection(taskID).status)
          }
          if (calls > 5) throw new Error("Unexpected repeated scripted completion")
          const tool = root
            ? {
                index: 0,
                id: `successor_complete_${++calls}`,
                type: "function",
                function: {
                  name: "manage_task",
                  arguments: JSON.stringify({
                    action: "complete_task",
                    summary: `Handled input ${calls}`,
                    workflow_id: null,
                    evidence_locators: [],
                    deliverable_artifact_locators: [],
                    accepted_delivery_slice_revision_ids: [],
                  }),
                },
              }
            : undefined
          const content = memory ? controlledMemoryReply(body.messages) : "Accepted input handled."
          const chunks = [{ role: "assistant" }, tool ? { tool_calls: [tool] } : { content }].map((delta) => ({
            id: "successor-model",
            object: "chat.completion.chunk",
            created: 1,
            model: "fixture",
            choices: [{ index: 0, delta, finish_reason: null }],
          }))
          chunks.push({
            id: "successor-model",
            object: "chat.completion.chunk",
            created: 1,
            model: "fixture",
            choices: [{ index: 0, delta: {}, finish_reason: tool ? "tool_calls" : "stop" }] as any,
          })
          return new Response(
            chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n",
            { headers: { "content-type": "text/event-stream" } },
          )
        },
      })
      const complete = EngineGit.complete
      using checkpoint = spyOn(EngineGit, "complete").mockImplementation(async (...args) => {
        if (calls === 1) {
          entered.resolve()
          await release.promise
        }
        return complete(...args)
      })
      try {
        await Config.updateProjectPatch({
          model: "successor-input/fixture",
          small_model: "successor-input/fixture",
          permission_mode: "full_access",
          provider: {
            "successor-input": {
              name: "Local successor protocol",
              npm: "@ai-sdk/openai-compatible",
              api: `http://127.0.0.1:${provider.port}/v1`,
              models: {
                fixture: {
                  name: "Scripted streaming model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4096 },
                },
              },
            },
          },
        })
        using runner = Ingress.replaceTaskIngressRunner({
          runner: runTaskLoop,
        })
        taskID = await EngineService.createTask(
          {
            requestID: "completion-successor-input",
            title: "Preserve accepted successor input",
            request: "Handle the original input, then complete.",
            productPillar: "work",
            model: "successor-input/fixture",
            promptProfile: "base",
          },
          { actor: "user" },
        )
        await within(entered.promise, "original completion checkpoint")
        const accepted: Array<{ messageID: string; text: string }> = []
        for (const text of ["Successor budget is 1200.", "Successor owner is Ada."]) {
          const response = await Server.App().request(
            `/task/${taskID}/message?directory=${encodeURIComponent(project.path)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", "x-opencorvus-directory": project.path },
              body: JSON.stringify({ text, source: "api" }),
            },
          )
          const body = (await response.json()) as any
          expect({ status: response.status, wake: body.wake_status }).toEqual({ status: 202, wake: "accepted" })
          accepted.push({ messageID: body.user_message.info.id, text })
        }
        const before = taskRootIngressDebugProjection(taskID)
        expect(
          before
            .filter((row) => row.source === "message")
            .map((row) => ({
              sourceID: row.sourceID,
              state: row.projection.state,
              activations: row.activationIDs.length,
            })),
        ).toEqual(accepted.map((row) => ({ sourceID: row.messageID, state: "ready", activations: 0 })))
        release.resolve()
        for (let pass = 0; pass < 4; pass++) await within(waitForIngressDeliveryHooksForTest(), "Task FIFO")
        await Database.awaitEffectIdle(30_000)
        const after = taskRootIngressDebugProjection(taskID)
        expect(statuses).toEqual(["active", "active", "active"])
        for (const [index, input] of accepted.entries()) {
          const ingress = after.find((row) => row.sourceID === input.messageID)!
          expect(ingress.activationIDs.length).toBe(1)
          expect(ingress.decisions.map((decision) => decision.command)).toEqual(["manage_task"])
          expect(ingress.executionEpoch).toBe(1)
          expect(prompts[index + 1]).toContain(input.text)
        }
        expect(taskLifecycleProjection(taskID).status).toBe("completed")
        expect(taskLifecycleProjection(taskID).epoch).toBe(1)
        const decisions = Database.use((db) =>
          db
            .select()
            .from(EngineArtifactTable)
            .where(
              and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "task_completion_decision")),
            )
            .all(),
        )
        expect(decisions.map((row) => (row.payload as any).tool_call_id)).toEqual(["successor_complete_3"])
      } finally {
        release.resolve()
        provider.stop(true)
      }
    },
  })
}, 150_000)
