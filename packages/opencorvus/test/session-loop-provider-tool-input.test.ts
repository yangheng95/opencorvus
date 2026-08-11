import { describe, expect, test } from "bun:test"
import { InvalidToolInputError, tool, type ToolExecutionOptions } from "ai"
import { MissionPanelActionSchema } from "@/panel/capability"
import type { Provider } from "@/provider/provider"
import { SessionLoop } from "@/session/loop"

function openAIStrictModel(): Provider.Model {
  return {
    id: "gpt-5.6-sol",
    providerID: "openai",
    name: "GPT-5.6 Sol",
    limit: { context: 1_000_000, input: 900_000, output: 4_096 },
    cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: true,
      temperature: false,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { id: "openai", npm: "@ai-sdk/openai" },
    options: {},
  } as Provider.Model
}

function preparedMissionPanelTool() {
  return SessionLoop.prepareProviderTool({
    name: "panel",
    source: "registry",
    model: openAIStrictModel(),
    tool: tool({
      inputSchema: MissionPanelActionSchema,
      execute: async (input) => input,
    }),
  }) as {
    execute: (input: unknown, options: ToolExecutionOptions) => Promise<unknown>
  }
}

const executionOptions = {
  toolCallId: "call_panel_provider_union",
  messages: [],
  abortSignal: new AbortController().signal,
} as ToolExecutionOptions

describe("SessionLoop provider Tool execution input", () => {
  test("materializes the exact resume_task branch from an OpenAI strict union superset", async () => {
    const result = await preparedMissionPanelTool().execute(
      {
        action: "resume_task",
        taskID: "task-provider-union",
        text: "Apply the reviewed correction.",
        evidence_locators: [
          {
            source: "engine_artifact",
            artifact_id: "art_reviewed_correction",
            catalog_revision: 1,
            expected_sha256: "a".repeat(64),
          },
        ],
        model: "openai/gpt-5.6-sol",
        summary: null,
        task_acceptances: null,
      },
      executionOptions,
    )

    expect(result).toEqual({
      action: "resume_task",
      taskID: "task-provider-union",
      text: "Apply the reviewed correction.",
      evidence_locators: [
        {
          source: "engine_artifact",
          artifact_id: "art_reviewed_correction",
          catalog_revision: 1,
          expected_sha256: "a".repeat(64),
        },
      ],
    })
  })

  test("maps a property absent from every panel branch to the canonical typed input error", async () => {
    const execution = preparedMissionPanelTool().execute(
      {
        action: "resume_task",
        taskID: "task-provider-union",
        text: "Apply the reviewed correction.",
        evidence_locators: [
          {
            source: "engine_artifact",
            artifact_id: "art_reviewed_correction",
            catalog_revision: 1,
            expected_sha256: "a".repeat(64),
          },
        ],
        invented_provider_field: "must remain invalid",
      },
      executionOptions,
    )

    const error = await execution.then(
      () => undefined,
      (cause) => cause,
    )
    expect(error).toBeInstanceOf(InvalidToolInputError)
    expect(String(error?.cause)).toContain("invented_provider_field")
    expect(String(error?.cause)).toContain("unrecognized")
  })
})
