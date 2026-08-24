import { afterEach, expect, spyOn, test } from "bun:test"
import * as AgentModel from "@/agent/model"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { EffectiveConfig } from "@/config/effective"
import * as LLMApi from "@/llm/api"
import { Provider } from "@/provider/provider"
import { streamCommitMessage } from "@/project/vcs-commit-message"
import { Vcs } from "@/project/vcs"

const restore: Array<() => void> = []

function track<T extends { mockRestore(): void }>(mock: T): T {
  restore.push(() => mock.mockRestore())
  return mock
}

afterEach(() => {
  for (const cleanup of restore.splice(0).reverse()) cleanup()
})

test("streams one bounded VCS commit subject and publishes each successful delta once", async () => {
  track(
    spyOn(Vcs, "diff").mockResolvedValue([
      { file: "src/example.ts", status: "modified", additions: 2, deletions: 1, patch: "+bounded" },
    ]),
  )
  track(spyOn(Vcs, "recentSubjects").mockResolvedValue(["fix: prior subject"]))
  track(spyOn(EffectiveConfig, "effective").mockResolvedValue({} as never))
  track(spyOn(HelperAgentRegistry, "get").mockResolvedValue({ name: "summary", options: {} } as never))
  track(spyOn(AgentModel, "resolveAgentModel").mockResolvedValue({ providerID: "test", id: "commit-model" } as never))
  track(spyOn(Provider, "getLanguage").mockResolvedValue({} as never))
  const streamSpy = track(
    spyOn(LLMApi, "streamText").mockReturnValue({
      fullStream: (async function* () {
        yield { type: "start" as const }
        yield { type: "text-delta" as const, id: "text-1", text: "fix: " }
        yield { type: "text-delta" as const, id: "text-1", text: "bound helper streams" }
        yield { type: "finish" as const }
      })(),
    } as never),
  )
  const deltas: string[] = []

  const message = await streamCommitMessage({
    taskID: "task-vcs-activity",
    sessionID: "session-vcs-activity",
    onDelta: (delta) => {
      deltas.push(delta)
    },
  })

  expect({ message, deltas }).toEqual({
    message: "fix: bound helper streams",
    deltas: ["fix: ", "bound helper streams"],
  })
  expect(streamSpy.mock.calls[0]![0]).toMatchObject({
    usagePurpose: "vcs-commit-message",
    timeoutMs: false,
    retries: 0,
  })
})
