import { describe, expect, test } from "bun:test"
import Ajv from "ajv"
import { asSchema } from "ai"
import type { Provider } from "../src/provider/provider"
import { SessionLoop } from "../src/session/loop"
import {
  createPublishInteractiveArtifactAiTool,
  PublishInteractiveArtifactParameters,
} from "../src/tool/publish-interactive-artifact"

function providerModels(): Provider.Model[] {
  const common = {
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
    options: {},
  }
  return [
    {
      ...common,
      id: "claude-artifact-schema",
      providerID: "anthropic",
      name: "Anthropic artifact schema",
      api: { id: "claude-artifact-schema", npm: "@ai-sdk/anthropic" },
    },
    {
      ...common,
      id: "gpt-artifact-schema",
      providerID: "openai",
      name: "OpenAI artifact schema",
      api: { id: "gpt-artifact-schema", npm: "@ai-sdk/openai" },
    },
  ] as Provider.Model[]
}

describe("interactive artifact Tool schema", () => {
  test("accepts the canonical document payload through the factored Provider projection", () => {
    const result = PublishInteractiveArtifactParameters.parse({
      artifact: {
        schemaVersion: "1",
        title: "Mission outcome",
        content: {
          renderer: "document@1",
          markdown: "# Accepted\n\nThe Mission completed with canonical evidence.",
        },
      },
    })

    expect(result).toEqual({
      artifact: {
        schemaVersion: "1",
        title: "Mission outcome",
        content: {
          renderer: "document@1",
          markdown: "# Accepted\n\nThe Mission completed with canonical evidence.",
        },
      },
    })
  })

  test("provides satisfiable OpenAI and Anthropic schemas for one canonical document", () => {
    const providerInput = {
      artifact: {
        schemaVersion: "1",
        title: "Mission outcome",
        presentation: { height: 240 },
        content: {
          renderer: "document@1",
          markdown: "# Accepted\n\nThe Mission completed with canonical evidence.",
        },
      },
    }
    const acceptedProviders = providerModels().map((model) => {
      const prepared = SessionLoop.prepareProviderTool({
        name: "publish_interactive_artifact",
        source: "registry",
        model,
        tool: createPublishInteractiveArtifactAiTool(),
      })
      const schema = asSchema((prepared as { inputSchema?: unknown }).inputSchema as never).jsonSchema
      const validate = new Ajv({ allErrors: true, strict: false, formats: { "date-time": true } }).compile(schema)
      expect(validate(providerInput), JSON.stringify(validate.errors)).toBe(true)
      return model.providerID
    })

    expect(acceptedProviders.sort()).toEqual(["anthropic", "openai"])
  })

  test("preserves canonical renderer refinements in the factored Provider projection", () => {
    const result = PublishInteractiveArtifactParameters.safeParse({
      artifact: {
        schemaVersion: "1",
        title: "Mismatched media",
        content: {
          renderer: "media@1",
          kind: "image",
          source: {
            sha: "a".repeat(64),
            url: "/attachment/prj_example/video.mp4",
            mime: "video/mp4",
            size: 128,
          },
          alt: "A canonical attachment with a mismatched MIME type",
        },
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => ({ path: issue.path, message: issue.message }))).toContainEqual({
        path: ["artifact", "content", "source", "mime"],
        message: "media kind must match attachment MIME",
      })
    }
  })

  test("maps unknown Tool input to the strict projection error before canonical persistence", () => {
    const result = PublishInteractiveArtifactParameters.safeParse({
      artifact: {
        schemaVersion: "1",
        title: "Mission outcome",
        forged: "must not be stripped",
        content: {
          renderer: "document@1",
          markdown: "# Accepted",
        },
      },
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path)).toContainEqual(["artifact"])
    }
  })
})
