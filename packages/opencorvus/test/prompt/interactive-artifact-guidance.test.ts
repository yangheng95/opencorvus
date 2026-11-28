import { describe, expect, test } from "bun:test"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import {
  CHAT_INTERACTIVE_ARTIFACT_EXAMPLE_INPUTS,
  CHAT_INTERACTIVE_ARTIFACT_GUIDANCE,
  CHART_ARTIFACT_TIME_GUIDANCE,
  DASHBOARD_ARTIFACT_REVIEW_GUIDANCE,
  INTERACTIVE_ARTIFACT_NUMERIC_GUIDANCE,
  PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION,
} from "../../src/prompt/fragments/interactive-artifact-guidance"
import { PublishInteractiveArtifactParameters } from "../../src/tool/publish-interactive-artifact"
import { WORK_RUNTIME_PROMPT } from "../../src/work/harness"

describe("interactive artifact prompt guidance", () => {
  test("keeps every shared example executable through the current Tool schema", () => {
    expect(
      Object.values(CHAT_INTERACTIVE_ARTIFACT_EXAMPLE_INPUTS).map((input) =>
        PublishInteractiveArtifactParameters.parse(JSON.parse(input)),
      ),
    ).toHaveLength(2)
  })

  test("projects the structured MCP result presentation contract", () => {
    expect(CHAT_INTERACTIVE_ARTIFACT_GUIDANCE).toContain(
      "After a connected Model Context Protocol (MCP) tool returns structured multi-item data, prefer the appropriate native interactive artifact when filtering, comparison, or item-by-item review materially improves the response.",
    )
    expect(CHAT_INTERACTIVE_ARTIFACT_GUIDANCE).toContain(
      "Treat an automatically produced `mcp-app@1` as the sole interactive presentation for that tool result.",
    )
  })

  test("shares the exact presentation contract with Chat and Work", () => {
    expect(PrimaryAssistantRegistry.nativeDefaultPrompt("chat")).toContain(CHAT_INTERACTIVE_ARTIFACT_GUIDANCE)
    expect(WORK_RUNTIME_PROMPT).toContain(CHAT_INTERACTIVE_ARTIFACT_GUIDANCE)
  })

  test("projects the shared timestamp semantics through the tool, Chat and Work", () => {
    expect(PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION).toContain(CHART_ARTIFACT_TIME_GUIDANCE)
    expect(PrimaryAssistantRegistry.nativeDefaultPrompt("chat")).toContain(CHART_ARTIFACT_TIME_GUIDANCE)
    expect(WORK_RUNTIME_PROMPT).toContain(CHART_ARTIFACT_TIME_GUIDANCE)
  })

  test("projects the shared Dashboard review contract through the tool, Chat and Work", () => {
    expect(PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION).toContain(DASHBOARD_ARTIFACT_REVIEW_GUIDANCE)
    expect(PrimaryAssistantRegistry.nativeDefaultPrompt("chat")).toContain(DASHBOARD_ARTIFACT_REVIEW_GUIDANCE)
    expect(WORK_RUNTIME_PROMPT).toContain(DASHBOARD_ARTIFACT_REVIEW_GUIDANCE)
  })

  test("projects numeric claim reconciliation through the tool, Chat and Work", () => {
    expect(PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION).toContain(INTERACTIVE_ARTIFACT_NUMERIC_GUIDANCE)
    expect(PrimaryAssistantRegistry.nativeDefaultPrompt("chat")).toContain(INTERACTIVE_ARTIFACT_NUMERIC_GUIDANCE)
    expect(WORK_RUNTIME_PROMPT).toContain(INTERACTIVE_ARTIFACT_NUMERIC_GUIDANCE)
  })
})
