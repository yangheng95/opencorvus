import { recordEngineArtifact } from "@/engine/artifact"
import { EngineArtifactTable } from "@/engine/engine.sql"
import { Database, and, eq } from "@/storage/db"
import {
  FrontendDesignModeSchema,
  FrontendDesignPayloadSchema,
  FrontendDesignDraftSchema,
  VisualSpecSchema,
} from "./schema"
import { z } from "zod"
import {
  ArtifactConsumptionProvenanceSchema,
  ArtifactReadLocatorSchema,
} from "@opencorvus-ai/plugin/artifact-catalog"

const FrontendDesignPartialFactsSchema = z
  .object({
    mode: FrontendDesignModeSchema,
    specs: z.array(VisualSpecSchema),
    draft: FrontendDesignDraftSchema.partial().strict(),
    semantic_error: z.string().optional(),
  })
  .strict()

export const FrontendDesignArtifactSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("partial"),
      mode: FrontendDesignModeSchema,
      session_id: z.string().min(1),
      final_message_id: z.string().min(1),
      observed_artifact_locators: z.array(ArtifactReadLocatorSchema).default([]),
      source_artifact_locators: z.array(ArtifactReadLocatorSchema).default([]),
      facts: FrontendDesignPartialFactsSchema,
      visual_specs: z.array(VisualSpecSchema),
      missing: z.array(z.string()),
      completeness_findings: z.array(z.string()),
    })
    .strict(),
  z
    .object({
      status: z.literal("complete"),
      mode: FrontendDesignModeSchema,
      session_id: z.string().min(1),
      final_message_id: z.string().min(1),
      observed_artifact_locators: z.array(ArtifactReadLocatorSchema).default([]),
      source_artifact_locators: z.array(ArtifactReadLocatorSchema).default([]),
      design: FrontendDesignPayloadSchema,
      visual_specs: z.array(VisualSpecSchema),
      completeness_findings: z.array(z.string()),
    })
    .strict(),
]).superRefine((artifact, context) => {
  const provenance = ArtifactConsumptionProvenanceSchema.safeParse({
    observed_artifact_locators: artifact.observed_artifact_locators,
    source_artifact_locators: artifact.source_artifact_locators,
  })
  if (provenance.success) return
  for (const issue of provenance.error.issues) {
    context.addIssue({
      code: "custom",
      path: issue.path,
      message: issue.message,
    })
  }
})

export type FrontendDesignArtifact = z.infer<typeof FrontendDesignArtifactSchema>
export type FrontendDesignArtifactRecord = {
  id: string
  payload: FrontendDesignArtifact
  timeCreated: number
}

export function recordFrontendDesignArtifact(input: {
  taskID: string
  artifact: FrontendDesignArtifact
  now?: number
}): string {
  const artifact = FrontendDesignArtifactSchema.parse(input.artifact)
  return recordEngineArtifact({
    taskID: input.taskID,
    kind: "frontend_design",
    label: artifact.status,
    payload: artifact,
    timeCreated: input.now ?? Date.now(),
  })
}

export function listFrontendDesignArtifacts(taskID: string): FrontendDesignArtifactRecord[] {
  const rows = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(and(eq(EngineArtifactTable.task_id, taskID), eq(EngineArtifactTable.kind, "frontend_design")))
      .orderBy(EngineArtifactTable.time_created, EngineArtifactTable.id)
      .all(),
  )
  return rows.map((row) => ({
    id: row.id,
    payload: FrontendDesignArtifactSchema.parse(row.payload),
    timeCreated: row.time_created,
  }))
}

export function findFrontendDesignArtifactByID(input: {
  taskID: string
  artifactID: string
}): FrontendDesignArtifactRecord | undefined {
  const row = Database.use((db) =>
    db
      .select()
      .from(EngineArtifactTable)
      .where(
        and(
          eq(EngineArtifactTable.task_id, input.taskID),
          eq(EngineArtifactTable.id, input.artifactID),
          eq(EngineArtifactTable.kind, "frontend_design"),
        ),
      )
      .get(),
  )
  if (!row) return undefined
  return {
    id: row.id,
    payload: FrontendDesignArtifactSchema.parse(row.payload),
    timeCreated: row.time_created,
  }
}
