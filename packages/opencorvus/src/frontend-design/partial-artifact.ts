import { FrontendDesignModeSchema } from "@/frontend-design/schema"
import type { FrontendDesignCollector } from "@/frontend-design/output-tools"
import type { VisualSpec } from "@/frontend-design/types"
import { recordFrontendDesignArtifact } from "./artifact"
import { z } from "zod"
import type { ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { exactEngineArtifactLocator } from "@/artifact-catalog"
import type { EngineArtifactLocator } from "@opencorvus-ai/plugin/artifact-catalog"

export const FRONTEND_DESIGN_COMPLETION_KEYS = [
  "frontend_template",
  "fillable_modules",
  "material_inventory",
  "visual_consistency_contract",
  "ui_data_contract",
  "template_iteration_notes",
  "completeness_review",
] as const

export function recordPartialFrontendDesignFacts(input: {
  taskID: string
  mode: z.infer<typeof FrontendDesignModeSchema>
  sessionID: string
  finalMessageID: string
  observedArtifactLocators: ArtifactReadLocator[]
  sourceArtifactLocators: ArtifactReadLocator[]
  factSnapshot: FrontendDesignCollector
  visualSpecs: VisualSpec[]
  completenessFindings: string[]
  missing?: string[]
}): EngineArtifactLocator {
  const artifactID = recordFrontendDesignArtifact({
    taskID: input.taskID,
    artifact: {
      status: "partial",
      mode: input.mode,
      session_id: input.sessionID,
      final_message_id: input.finalMessageID,
      observed_artifact_locators: input.observedArtifactLocators,
      source_artifact_locators: input.sourceArtifactLocators,
      facts: input.factSnapshot,
      visual_specs: input.visualSpecs,
      missing: input.missing ?? [],
      completeness_findings: input.completenessFindings,
    },
  })
  return exactEngineArtifactLocator({ taskID: input.taskID, artifactID })
}
