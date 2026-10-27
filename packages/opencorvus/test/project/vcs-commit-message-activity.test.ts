import { afterEach, expect, spyOn, test } from "bun:test"
import * as AgentModel from "@/agent/model"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { EffectiveConfig } from "@/config/effective"
import { Auth } from "@/auth"
import { Provider } from "@/provider/provider"
import { ProviderLLM } from "@/provider/llm"
import { streamCommitMessage } from "@/project/vcs-commit-message"
import { Vcs } from "@/project/vcs"
import { streamingModelMetadata, streamingTextModel } from "../fixture/streaming-language"

const restore: Array<() => void> = []

function track<T extends { mockRestore(): void }>(mock: T): T {
  restore.push(() => mock.mockRestore())
  return mock
}

afterEach(() => {
  for (const cleanup of restore.splice(0).reverse()) cleanup()
})

for (const oauth of [false, true])
  test(`streams a bounded VCS subject through SDK and ${oauth ? "OAuth" : "API"} provider options`, async () => {
    track(
      spyOn(Vcs, "diff").mockResolvedValue([
        { file: "src/example.ts", status: "modified", additions: 2, deletions: 1, patch: "+bounded" },
      ]),
    )
    track(spyOn(Vcs, "recentSubjects").mockResolvedValue(["fix: prior subject"]))
    track(spyOn(EffectiveConfig, "effective").mockResolvedValue({} as never))
    track(
      spyOn(HelperAgentRegistry, "get").mockResolvedValue({
        name: "summary",
        options: { reasoningEffort: "low" },
      } as never),
    )
    track(
      spyOn(AgentModel, "resolveAgentModel").mockResolvedValue({
        ...streamingModelMetadata,
        options: { textVerbosity: "low" },
      }),
    )
    track(spyOn(Provider, "getProvider").mockResolvedValue({ id: "openai", options: {} } as never))
    track(spyOn(Auth, "get").mockResolvedValue(oauth ? ({ type: "oauth" } as never) : undefined))
    const language = streamingTextModel(["fix: ", "bound helper streams"])
    track(spyOn(Provider, "getLanguage").mockResolvedValue(language))
    track(spyOn(ProviderLLM, "wrapModel").mockImplementation((model) => model))
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
    const instructions = expect.stringContaining("Generate exactly one concise Git commit subject")
    expect(language.doStreamCalls[0]!.prompt).toEqual([
      ...(oauth ? [] : [{ role: "system", content: instructions }]),
      { role: "user", content: [{ type: "text", text: expect.stringContaining("### src/example.ts") }] },
    ])
    expect(language.doStreamCalls[0]!.providerOptions).toEqual({
      openai: {
        store: false,
        promptCacheKey: "session-vcs-activity",
        textVerbosity: "low",
        reasoningEffort: "low",
        ...(oauth ? { instructions } : {}),
      },
    })
  })
