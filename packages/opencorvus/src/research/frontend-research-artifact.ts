import { EngineArtifactEnvelopeSchema } from "@opencorvus-ai/plugin/artifact-catalog"
import z from "zod"
import {
  FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE,
  FRONTEND_RESEARCH_BRIEF_PRODUCER,
} from "@/engine/artifact-catalog-constants"
import { ResearchBriefSchema } from "./schema"

const ResourceIndexSchema = z.number().int().nonnegative()

export const FrontendResearchVisualEvidenceSchema = z
  .object({
    resource_index: ResourceIndexSchema,
    attachment_url: z.string().min(1),
    evidence_ids: z.array(z.string().min(1)),
    page_url: z.string().optional(),
    page_title: z.string().optional(),
    viewport: z
      .object({
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
    screenshot: z
      .object({
        mime_type: z.string().min(1),
        width: z.number().int().positive().optional(),
        height: z.number().int().positive().optional(),
        sha256: z.string().regex(/^[a-f0-9]{64}$/),
      })
      .strict(),
    diagnostics: z
      .object({
        console_errors: z.number().int().nonnegative().optional(),
        page_errors: z.number().int().nonnegative().optional(),
        failed_requests: z.number().int().nonnegative().optional(),
        http_errors: z.number().int().nonnegative().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()

export const FrontendResearchBriefArtifactPayloadSchema = z
  .object({
    goal_id: z.string().min(1).nullable(),
    brief: ResearchBriefSchema,
    resource_roles: z
      .object({
        full_markdown: ResourceIndexSchema,
        evidence_json: ResourceIndexSchema,
        citation_map: ResourceIndexSchema,
      })
      .strict(),
    visual_evidence: z.array(FrontendResearchVisualEvidenceSchema),
  })
  .strict()

export type FrontendResearchBriefArtifactPayload = z.infer<typeof FrontendResearchBriefArtifactPayloadSchema>
export type FrontendResearchVisualEvidence = z.infer<typeof FrontendResearchVisualEvidenceSchema>

export function parseFrontendResearchBriefArtifactEnvelope(input: unknown) {
  const envelope = EngineArtifactEnvelopeSchema.parse(input)
  if (envelope.artifact_type !== FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE) {
    throw new Error(`FrontendResearchBrief Artifact type must be ${FRONTEND_RESEARCH_BRIEF_ARTIFACT_TYPE}`)
  }
  if (
    envelope.producer.owner_kind !== "core" ||
    envelope.producer.component_id !== FRONTEND_RESEARCH_BRIEF_PRODUCER.component_id ||
    envelope.producer.operation_id !== FRONTEND_RESEARCH_BRIEF_PRODUCER.operation_id
  ) {
    throw new Error("FrontendResearchBrief Artifact producer must be Core frontend-research/persist-research-brief")
  }
  const payload = FrontendResearchBriefArtifactPayloadSchema.parse(envelope.payload)
  const resourceIndices = [
    payload.resource_roles.full_markdown,
    payload.resource_roles.evidence_json,
    payload.resource_roles.citation_map,
    ...payload.visual_evidence.map((item) => item.resource_index),
  ]
  if (new Set(resourceIndices).size !== resourceIndices.length) {
    throw new Error("FrontendResearchBrief Artifact resource roles must be one-to-one")
  }
  for (const resourceIndex of resourceIndices) {
    if (!envelope.resources[resourceIndex]) {
      throw new Error(`FrontendResearchBrief Artifact resource index ${resourceIndex} is outside resources`)
    }
  }
  for (const [role, expectedMediaType] of [
    ["full_markdown", "text/markdown"],
    ["evidence_json", "application/json"],
    ["citation_map", "application/json"],
  ] as const) {
    const resource = envelope.resources[payload.resource_roles[role]]
    if (resource.media_type !== expectedMediaType) {
      throw new Error(`FrontendResearchBrief ${role} resource MIME must be ${expectedMediaType}`)
    }
  }
  const evidenceByID = new Map(payload.brief.evidence_index.map((evidence) => [evidence.id, evidence]))
  for (const visualEvidence of payload.visual_evidence) {
    const resource = envelope.resources[visualEvidence.resource_index]
    if (resource.media_type !== visualEvidence.screenshot.mime_type) {
      throw new Error(`FrontendResearchBrief screenshot resource ${visualEvidence.resource_index} MIME does not match`)
    }
    if (resource.sha256 !== visualEvidence.screenshot.sha256) {
      throw new Error(
        `FrontendResearchBrief screenshot resource ${visualEvidence.resource_index} digest does not match`,
      )
    }
    for (const evidenceID of visualEvidence.evidence_ids) {
      const evidence = evidenceByID.get(evidenceID)
      if (!evidence?.pointer.includes(visualEvidence.attachment_url)) {
        throw new Error(`FrontendResearchBrief screenshot evidence ${evidenceID} does not cite its attachment URL`)
      }
    }
  }
  return { envelope, payload }
}
