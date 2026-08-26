import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { GlobalTaskService } from "@/task-api/global-task-service"
import { resetMemoryDatabase } from "./fixture/memory"

beforeAll(async () => {
  // Task execution mode is normally declared by the deployment; a unit test
  // is a native host.
  process.env.OPENCORVUS_TASK_PROCESS_MODE = "native"
  // A global create allocates a fresh anonymous Project, whose effective
  // model can only come from the global configuration.
  await Config.updateGlobalPatch({
    model: "replay-test-provider/replay-test-model",
    provider: {
      "replay-test-provider": {
        name: "Replay test provider",
        npm: "@ai-sdk/openai-compatible",
        api: "http://127.0.0.1:9/replay-test-model",
        models: {
          "replay-test-model": {
            name: "Replay test model",
            tool_call: true,
            modalities: { input: ["text"], output: ["text"] },
            limit: { context: 1_000_000, output: 4_096 },
          },
        },
      },
    },
  })
})

afterAll(resetMemoryDatabase)

describe("global Task request replay", () => {
  test("a replayed global create resolves the first attempt's Project and Task instead of allocating anew", async () => {
    const requestID = Identifier.ascending("call")
    const input = {
      title: "Global replay",
      request: "Create exactly one Task for this request",
      productPillar: "code" as const,
      source: "test",
      requestID,
    }

    const first = await GlobalTaskService.create(input)
    expect(first.task_id).toMatch(/\w+/)

    // The caller lost the first response and retries the documented body.
    // Before the request identity resolved globally, this allocated a second
    // random Project and a second Task the first response never named.
    const replay = await GlobalTaskService.create(input)
    expect(replay).toEqual(first)
  }, 120_000)

  test("a conflicting replay is refused by the same per-project idempotency contract every create uses", async () => {
    const requestID = Identifier.ascending("call")
    const first = await GlobalTaskService.create({
      title: "Global conflict",
      request: "Create exactly one Task for this request",
      productPillar: "code" as const,
      source: "test",
      requestID,
    })
    expect(first.task_id).toMatch(/\w+/)

    await expect(
      GlobalTaskService.create({
        title: "Global conflict",
        request: "Create exactly one Task for this request",
        productPillar: "work" as const,
        source: "test",
        requestID,
      }),
    ).rejects.toThrow(`Task request ${requestID} already committed as ${first.task_id} with a different product pillar`)
  }, 120_000)
})
