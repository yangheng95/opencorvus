import { publishInteractiveArtifact } from "@/interactive-artifact/persist"
import { PublishableInteractiveArtifactPayload } from "@/interactive-artifact/schema"
import { PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION } from "@/prompt/fragments/interactive-artifact-guidance"
import { tool as aiTool } from "ai"
import z from "zod"
import { Tool } from "./tool"

export const PublishInteractiveArtifactParameters = z
  .object({
    artifact: PublishableInteractiveArtifactPayload.describe(
      "A strictly versioned document, data view, code view, attachment-backed preview, or notebook to render inside the assistant message card. MCP Apps are produced automatically from real MCP tool UI resources and cannot be authored through this tool.",
    ),
  })
  .strict()

export const PublishInteractiveArtifactTool = Tool.define("publish_interactive_artifact", {
  description: PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION,
  parameters: PublishInteractiveArtifactParameters,
  async execute(args, ctx) {
    const artifact = await publishInteractiveArtifact({
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      payload: args.artifact,
    })
    return resultForArtifact(artifact)
  },
})

function resultForArtifact(artifact: Awaited<ReturnType<typeof publishInteractiveArtifact>>) {
  return {
    title: artifact.payload.title,
    metadata: {
      artifactID: artifact.id,
      renderer: artifact.payload.renderer,
    },
    output: JSON.stringify({ artifactID: artifact.id, renderer: artifact.payload.renderer }),
    display: [
      {
        type: "interactive-artifact" as const,
        artifactID: artifact.id,
      },
    ],
  }
}

export function createPublishInteractiveArtifactAiTool() {
  return aiTool({
    description: PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION,
    inputSchema: PublishInteractiveArtifactParameters,
    execute: async (args, options) => {
      const meta = (options as { opencorvus?: Record<string, unknown> } | undefined)?.opencorvus
      const sessionID = typeof meta?.sessionID === "string" ? meta.sessionID : ""
      const messageID = typeof meta?.messageID === "string" ? meta.messageID : ""
      if (!sessionID || !messageID) {
        throw new Error("publish_interactive_artifact requires real SessionLoop message ownership")
      }
      return resultForArtifact(await publishInteractiveArtifact({ sessionID, messageID, payload: args.artifact }))
    },
  })
}
