import { publishInteractiveArtifact } from "@/interactive-artifact/persist"
import {
  canonicalPublishableInteractiveArtifactFromToolPayload,
  PublishableInteractiveArtifactToolPayload,
} from "@/interactive-artifact/schema"
import { PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION } from "@/prompt/fragments/interactive-artifact-guidance"
import { tool as aiTool } from "ai"
import z from "zod"
import { Tool } from "./tool"

export const PublishInteractiveArtifactParameters = z
  .object({
    artifact: PublishableInteractiveArtifactToolPayload.describe(
      "Versioned inline content. MCP Apps come from real MCP tool UI resources; use those tools to produce them.",
    ),
  })
  .strict()

export const PublishInteractiveArtifactTool = Tool.define("publish_interactive_artifact", {
  description: PUBLISH_INTERACTIVE_ARTIFACT_DESCRIPTION,
  parameters: PublishInteractiveArtifactParameters,
  async execute(args, ctx) {
    const payload = canonicalPublishableInteractiveArtifactFromToolPayload(args.artifact)
    const artifact = await publishInteractiveArtifact({
      sessionID: ctx.sessionID,
      messageID: ctx.messageID,
      payload,
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
      const payload = canonicalPublishableInteractiveArtifactFromToolPayload(args.artifact)
      return resultForArtifact(await publishInteractiveArtifact({ sessionID, messageID, payload }))
    },
  })
}
