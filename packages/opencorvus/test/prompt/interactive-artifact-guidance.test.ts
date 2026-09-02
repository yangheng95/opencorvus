import { describe, expect, test } from "bun:test"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import {
  CHAT_INTERACTIVE_ARTIFACT_EXAMPLE_INPUTS,
  CHAT_INTERACTIVE_ARTIFACT_GUIDANCE,
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
})
