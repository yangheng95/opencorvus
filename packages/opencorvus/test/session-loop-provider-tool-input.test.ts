import { describe, expect, test } from "bun:test"
import { asSchema, generateText, InvalidToolInputError, tool, type ToolExecutionOptions } from "ai"
import { createAzure } from "@ai-sdk/azure"
import { createOpenAI } from "@ai-sdk/openai"
import { MissionPanelActionSchema } from "@/panel/capability"
import type { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { SessionLoop } from "@/session/loop"
import { ScheduleTool } from "@/tool/schedule"

function openAIModel(): Provider.Model {
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
    model: openAIModel(),
    tool: tool({
      inputSchema: MissionPanelActionSchema,
      execute: async (input) => input,
    }),
  }) as {
    execute: (input: unknown, options: ToolExecutionOptions) => Promise<unknown>
  }
}

function azureModel(): Provider.Model {
  return {
    ...openAIModel(),
    providerID: "azure",
    api: { id: "azure-openai", npm: "@ai-sdk/azure" },
  } as Provider.Model
}

function successfulResponsesFetch(capture: { body?: Record<string, any> }) {
  return (async (_input: RequestInfo | URL, init?: RequestInit) => {
    capture.body = JSON.parse(String(init?.body)) as Record<string, any>
    return Response.json({
      id: "resp_serialized_tool_contract",
      created_at: 1,
      model: "gpt-5.6-terra",
      output: [
        {
          type: "message",
          role: "assistant",
          id: "msg_serialized_tool_contract",
          content: [{ type: "output_text", text: "done", annotations: [] }],
        },
      ],
      usage: {
        input_tokens: 1,
        input_tokens_details: { cached_tokens: 0 },
        output_tokens: 1,
        output_tokens_details: { reasoning_tokens: 0 },
      },
    })
  }) as typeof fetch
}

function serializedToolRequestOptions(model: Provider.Model) {
  return ProviderTransform.providerOptions(
    model,
    ProviderTransform.optionsForToolRequest(
      model,
      { store: false, parallelToolCalls: true },
      { toolChoice: "auto", activeToolCount: 1 },
    ),
  )
}

const executionOptions = {
  toolCallId: "call_panel_provider_union",
  messages: [],
  abortSignal: new AbortController().signal,
} as ToolExecutionOptions

function acceptanceGap(
  readReference = "ar_1234567890abcdef",
  parameters: Record<string, unknown> = {},
) {
  return {
    gap_id: "gap-audit-receipt",
    current_ledger_revision_artifact_id: null,
    criteria: [
      {
        criterion_id: "audit-receipt",
        state: "open" as const,
        disposition: "failed" as const,
        finding: "The published audit receipt does not match the accepted output.",
        responsibility: { kind: "workflow_node" as const, workflow_id: "repair", workflow_node_id: "builder" },
        observation_evidence_read_refs: [readReference],
        repair_evidence_read_refs: [],
        resolution_evidence_read_refs: [],
        invalidating_evidence_read_refs: [],
        irreducible_blocker_evidence_read_refs: [],
        repair_action: {
          operation: "correct_artifact",
          target: "audit-receipt",
          expected_evidence_kind: "corrected-audit-receipt",
          parameters,
        },
      },
    ],
  }
}

describe("SessionLoop provider Tool execution input", () => {
  test("projects an OpenAI root union as one nested operation with branch-specific required fields", async () => {
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

  test("sends the prepared Tool in a serialized OpenAI Responses request", async () => {
    const capture: { body?: Record<string, any> } = {}
    const model = openAIModel()
    const openAI = createOpenAI({ apiKey: "fixture", fetch: successfulResponsesFetch(capture) })

    await generateText({
      model: openAI.responses("gpt-5.6-terra"),
      prompt: "Finish without calling a Tool.",
      tools: { panel: preparedMissionPanelTool() as any },
      providerOptions: serializedToolRequestOptions(model),
    })

    expect(capture.body).toEqual(
      expect.objectContaining({
        parallel_tool_calls: false,
        tools: [expect.objectContaining({ type: "function", name: "panel", parameters: expect.any(Object) })],
      }),
    )
    const operation = capture.body?.tools?.[0]?.parameters?.properties?.operation
    const resume = (operation?.anyOf ?? operation?.oneOf).find(
      (variant: Record<string, any>) => variant.properties?.action?.const === "resume_task",
    )
    const openCriterion = (resume.properties.acceptance_gap.properties.criteria.items.anyOf ??
      resume.properties.acceptance_gap.properties.criteria.items.oneOf).find(
      (variant: Record<string, any>) => variant.properties?.state?.const === "open",
    )
    expect(openCriterion.properties.repair_action.properties.parameters).toEqual(
      expect.objectContaining({ type: "object", propertyNames: { type: "string" }, additionalProperties: true }),
    )
  })

  test("sends the prepared Tool through Azure's serialized production Responses namespace", async () => {
    const capture: { body?: Record<string, any> } = {}
    const model = azureModel()
    const options = serializedToolRequestOptions(model)
    const azure = createAzure({
      apiKey: "fixture",
      baseURL: "https://azure.example.invalid/openai",
      fetch: successfulResponsesFetch(capture),
    })

    expect(options).toEqual({
      openai: { store: false, parallelToolCalls: false },
      azure: { store: false, parallelToolCalls: false },
    })
    await generateText({
      model: azure.responses("gpt-5.6-terra"),
      prompt: "Finish without calling a Tool.",
      tools: {
        panel: SessionLoop.prepareProviderTool({
          name: "panel",
          source: "registry",
          model,
          tool: tool({ inputSchema: MissionPanelActionSchema, execute: async (input) => input }),
        }) as any,
      },
      providerOptions: options,
    })

    expect(capture.body).toEqual(
      expect.objectContaining({
        parallel_tool_calls: false,
        tools: [expect.objectContaining({ type: "function", name: "panel", parameters: expect.any(Object) })],
      }),
    )
  })

  test("preserves action-specific fields for a second production root-union Tool", async () => {
    const schedule = await ScheduleTool.init()
    const prepared = SessionLoop.prepareProviderTool({
      name: "schedule",
      source: "registry",
      model: openAIModel(),
      tool: tool({ inputSchema: schedule.parameters, execute: async (input) => input }),
    }) as unknown as { inputSchema: unknown }
    const provider = asSchema(prepared.inputSchema as never).jsonSchema as Record<string, any>
    const variants = provider.properties.operation.anyOf as Array<Record<string, any>>
    const history = variants.find((variant) => variant.properties.action.enum?.includes("history"))

    expect(Object.keys(provider.properties)).toEqual(["operation"])
    expect(history.required).toContain("automationId")
    expect(history.properties.automationId).toEqual(expect.objectContaining({ type: "string" }))
  })

  test("materializes the exact resume_task branch from an OpenAI provider union superset", async () => {
    const gap = acceptanceGap("ar_1234567890abcdef", {
      artifact_kind: "corrected-audit-receipt",
      retry_limit: 1,
    })
    const result = await preparedMissionPanelTool().execute(
      {
        operation: {
          action: "resume_task",
          taskID: "task-provider-union",
          acceptance_gap: gap,
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
      acceptance_gap: gap,
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
