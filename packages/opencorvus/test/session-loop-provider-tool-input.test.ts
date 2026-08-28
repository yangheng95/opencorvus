import { describe, expect, test } from "bun:test"
import { asSchema, InvalidToolInputError, tool, type ToolExecutionOptions } from "ai"
import { MissionPanelActionSchema } from "@/panel/capability"
import type { Provider } from "@/provider/provider"
import { SessionLoop } from "@/session/loop"
import { ScheduleTool } from "@/tool/schedule"

function openAIStrictModel(): Provider.Model {
  return {
    id: "gpt-5.6-terra",
    providerID: "openai",
    name: "GPT-5.6 Terra",
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

function acceptanceGap(readReference = "ar_1234567890abcdef") {
  return {
    gap_id: "gap-audit-receipt",
    current_ledger_revision_artifact_id: null,
    criteria: [
      {
        criterion_id: "audit-receipt",
        disposition: "failed" as const,
        finding: "The published audit receipt does not match the accepted output.",
        relied_evidence_read_refs: [readReference],
        contradictory_evidence_read_refs: [],
        responsible_workflow_node_id: "builder",
        required_new_evidence_kind: "corrected-audit-receipt",
      },
    ],
    preserved_acceptances: [],
    requested_next_action: "Correct only the audit receipt and publish its new canonical revision.",
  }
}

describe("SessionLoop provider Tool execution input", () => {
  test("projects an OpenAI strict root union as one nested operation with branch-specific required fields", async () => {
    const prepared = preparedMissionPanelTool() as unknown as { inputSchema: unknown }
    const schema = asSchema(prepared.inputSchema as never) as {
      jsonSchema: Record<string, any>
      validate?: (input: unknown) => Promise<{ success: boolean; value?: unknown; error?: unknown }>
    }
    const provider = schema.jsonSchema
    const variants = provider.properties.operation.anyOf as Array<Record<string, any>>
    const read = variants.find((variant) => variant.properties.action.const === "read_task_artifact")
    const artifactPage = variants.find((variant) => variant.properties.action.const === "query_task_artifacts")

    expect(provider.required).toEqual(["operation"])
    expect(Object.keys(provider.properties)).toEqual(["operation"])
    expect(read.required).toContain("taskID")
    expect(read.required).toContain("artifact_locator_ref")
    expect(read.properties.taskID).toEqual(expect.objectContaining({ type: "string", minLength: 1 }))
    expect(artifactPage.required).toEqual(
      expect.arrayContaining(["taskID", "terminal_lifecycle_reference", "page_number"]),
    )
    expect(artifactPage.properties.page_number).toEqual(
      expect.objectContaining({ type: "integer", minimum: 1, maximum: 1_000 }),
    )
    expect(artifactPage.properties.terminal_lifecycle_reference).toEqual(expect.objectContaining({ type: "object" }))

    const validated = await schema.validate?.({
      operation: {
        action: "read_task_artifact",
        taskID: "task-provider-union",
        artifact_transport_version: 2,
        artifact_locator_ref: "al_1234567890abcdef",
        byte_offset: null,
        max_bytes: null,
        delivery: null,
      },
    })
    expect(validated).toEqual({
      success: true,
      value: {
        action: "read_task_artifact",
        taskID: "task-provider-union",
        artifact_transport_version: 2,
        artifact_locator_ref: "al_1234567890abcdef",
        byte_offset: 0,
        max_bytes: 24_576,
        delivery: "inline",
      },
    })
  })

  test("preserves action-specific fields for a second production root-union Tool", async () => {
    const schedule = await ScheduleTool.init()
    const prepared = SessionLoop.prepareProviderTool({
      name: "schedule",
      source: "registry",
      model: openAIStrictModel(),
      tool: tool({ inputSchema: schedule.parameters, execute: async (input) => input }),
    }) as unknown as { inputSchema: unknown }
    const provider = asSchema(prepared.inputSchema as never).jsonSchema as Record<string, any>
    const variants = provider.properties.operation.anyOf as Array<Record<string, any>>
    const history = variants.find((variant) => variant.properties.action.enum?.includes("history"))

    expect(Object.keys(provider.properties)).toEqual(["operation"])
    expect(history.required).toContain("automationId")
    expect(history.properties.automationId).toEqual(expect.objectContaining({ type: "string" }))
  })

  test("materializes the exact resume_task branch from an OpenAI strict union superset", async () => {
    const result = await preparedMissionPanelTool().execute(
      {
        operation: {
          action: "resume_task",
          taskID: "task-provider-union",
          acceptance_gap: acceptanceGap(),
          model: null,
          summary: null,
          task_acceptances: null,
        },
      },
      executionOptions,
    )

    expect(result).toEqual({
      action: "resume_task",
      taskID: "task-provider-union",
      acceptance_gap: acceptanceGap(),
    })
  })

  test("materializes a completed cross-Task source without any copied Artifact locator", async () => {
    const result = await preparedMissionPanelTool().execute(
      {
        operation: {
          action: "create_task",
          title: "Analyze completed evidence",
          request: "Analyze the predecessor's declared delivery closure.",
          promptProfile: "evolution-lab",
          artifact_sources: [
            {
              authority: "completion_decision",
              source_task_id: "task-completed-source",
            },
          ],
        },
      },
      executionOptions,
    )

    expect(result).toEqual({
      action: "create_task",
      title: "Analyze completed evidence",
      request: "Analyze the predecessor's declared delivery closure.",
      promptProfile: "evolution-lab",
      artifact_sources: [
        {
          authority: "completion_decision",
          source_task_id: "task-completed-source",
        },
      ],
    })
  })

  test("maps a property absent from every panel branch to the canonical typed input error", async () => {
    const execution = preparedMissionPanelTool().execute(
      {
        action: "resume_task",
        taskID: "task-provider-union",
        acceptance_gap: acceptanceGap(),
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

  test("keeps a null required read Task ID as an explicit typed input error", async () => {
    const execution = preparedMissionPanelTool().execute(
      {
        operation: {
          action: "read_task_artifact",
          taskID: null,
          artifact_transport_version: 2,
          artifact_locator_ref: "al_1234567890abcdef",
          byte_offset: null,
          max_bytes: null,
          delivery: null,
        },
      },
      executionOptions,
    )

    const error = await execution.then(
      () => undefined,
      (cause) => cause,
    )
    expect(error).toBeInstanceOf(InvalidToolInputError)
    expect(String(error?.cause)).toContain("taskID")
    expect(String(error?.cause)).toContain("received null")
  })
})
