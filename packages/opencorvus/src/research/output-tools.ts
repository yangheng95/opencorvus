import { tool } from "ai"
import { materializeExactTool } from "@/agent/exact-tool-factory"
import { z } from "zod"
import { markdownList } from "@/util/markdown"
import type { FactCheckItem } from "@/fact-check/schema"
import { isHttpWebpageUrl } from "@/util/web-url"
import {
  ResearchBriefSchema,
  ResearchBundleCitationEntrySchema,
  ResearchBundleEvidenceNoteSchema,
  ResearchBundleInputSchema,
  ResearchBundleMarkdownSectionSchema,
  ResearchBundleSchema,
  ResearchConstraintSchema,
  ResearchDocumentSectionSchema,
  ResearchEvidenceRefSchema,
  ResearchFactSchema,
  ResearchInferenceSchema,
  ResearchOpenQuestionSchema,
  ResearchProblemStatementSchema,
  ResearchScopeSchema,
  ResearchSubpageTaskSchema,
  ResearchUserNeedSchema,
  ResearchWebpageAcceptanceCriterionSchema,
  ResearchWebpageContractSchema,
  ResearchWebpageDataInventorySchema,
  ResearchWebpageFidelityRiskSchema,
  ResearchWebpageFunctionalSurfaceSchema,
  ResearchWebpageInteractionStateSchema,
  ResearchWebpageStyleRequirementSchema,
  ResearchWebpageVisualLayoutSchema,
  researchRequestHash,
  researchSourceDigest,
  validateResearchBriefSemantics,
  type ResearchBrief,
  type ResearchBundle,
  type ResearchBundleInput,
  type ResearchConstraint,
  type ResearchDocumentSection,
  type ResearchEvidenceRef,
  type ResearchFact,
  type ResearchInference,
  type ResearchOpenQuestion,
  type ResearchProblemStatement,
  type ResearchScope,
  type ResearchSubpageTask,
  type ResearchUserNeed,
  type ResearchWebpageAcceptanceCriterion,
  type ResearchWebpageDataInventory,
  type ResearchWebpageFidelityRisk,
  type ResearchWebpageFunctionalSurface,
  type ResearchWebpageInteractionState,
  type ResearchWebpageStyleRequirement,
  type ResearchWebpageVisualLayout,
} from "./schema"

const WebpageContractSourceInputSchema = z
  .object({
    source_url: z.string().min(1).refine(isHttpWebpageUrl, "source_url must be an HTTP(S) webpage URL"),
    reference_image_evidence_ids: z.array(z.string().min(1)).default([]),
  })
  .strict()

const ResearchBriefDraftSchema = ResearchBriefSchema.omit({
  metadata: true,
  bundle: true,
}).extend({
  bundle: ResearchBundleInputSchema,
})
export const ResearchPartialDraftSchema = ResearchBriefDraftSchema.partial()

export type ResearchDraft = z.infer<typeof ResearchBriefDraftSchema>
export type ResearchPartialDraft = z.infer<typeof ResearchPartialDraftSchema>

export interface ResearchToolCallReplay {
  toolName: string
  input: unknown
}

export interface ResearchCollector {
  scope?: ResearchScope
  summary?: string
  evidence_index: ResearchEvidenceRef[]
  facts: ResearchFact[]
  inferences: ResearchInference[]
  problem_statements: ResearchProblemStatement[]
  user_needs: ResearchUserNeed[]
  constraints: ResearchConstraint[]
  document_outline: ResearchDocumentSection[]
  webpage_contract_source?: z.infer<typeof WebpageContractSourceInputSchema>
  webpage_functional_surfaces: ResearchWebpageFunctionalSurface[]
  webpage_visual_layout: ResearchWebpageVisualLayout[]
  webpage_style_requirements: ResearchWebpageStyleRequirement[]
  webpage_interaction_states: ResearchWebpageInteractionState[]
  webpage_data_content_inventory: ResearchWebpageDataInventory[]
  webpage_fidelity_acceptance: ResearchWebpageAcceptanceCriterion[]
  webpage_fidelity_risks: ResearchWebpageFidelityRisk[]
  subpage_research_tasks: ResearchSubpageTask[]
  open_questions: ResearchOpenQuestion[]
  bundle: ResearchBundleInput
  draft?: ResearchDraft
  fact_check_items: FactCheckItem[]
  semantic_error?: string
}

function emptyCollector(): ResearchCollector {
  return {
    evidence_index: [],
    facts: [],
    inferences: [],
    problem_statements: [],
    user_needs: [],
    constraints: [],
    document_outline: [],
    webpage_functional_surfaces: [],
    webpage_visual_layout: [],
    webpage_style_requirements: [],
    webpage_interaction_states: [],
    webpage_data_content_inventory: [],
    webpage_fidelity_acceptance: [],
    webpage_fidelity_risks: [],
    subpage_research_tasks: [],
    open_questions: [],
    bundle: {
      full_markdown_sections: [],
      evidence_notes: [],
      citation_map: [],
    },
    fact_check_items: [],
  }
}

export function buildResearchBriefFromDraft(input: {
  draft: ResearchDraft
  metadata: Omit<ResearchBrief["metadata"], "source_digest">
  bundlePaths: ResearchBrief["bundle"]
}): ResearchBrief {
  const brief = parseResearchBriefWithCanonicalDigest({
    ...input.draft,
    metadata: {
      ...input.metadata,
    },
    bundle: input.bundlePaths,
  })
  const semanticError = validateResearchBriefSemantics(brief)
  if (semanticError) throw new Error(`research brief failed semantic validation: ${semanticError}`)
  return brief
}

function parseResearchBriefWithCanonicalDigest(input: unknown): ResearchBrief {
  const parsed = ResearchBriefSchema.parse({
    ...(input as Record<string, unknown>),
    metadata: {
      ...((input as Record<string, unknown>).metadata as Record<string, unknown>),
      source_digest: "pending-canonical-digest",
    },
  })
  return ResearchBriefSchema.parse({
    ...parsed,
    metadata: {
      ...parsed.metadata,
      source_digest: researchSourceDigest(parsed.evidence_index),
    },
  })
}

function validateResearchBundleInputSemantics(bundle: ResearchBundleInput, brief: ResearchBrief): string | undefined {
  const evidenceIDs = new Set(brief.evidence_index.map((item) => item.id))
  for (const section of bundle.full_markdown_sections) {
    const missing = section.evidence_ids.filter((id) => !evidenceIDs.has(id))
    if (missing.length > 0)
      return `bundle.full_markdown_sections "${section.title}" references unknown evidence id(s): ${missing.join(", ")}.`
  }
  for (const note of bundle.evidence_notes) {
    if (!evidenceIDs.has(note.evidence_id))
      return `bundle.evidence_notes references unknown evidence id: ${note.evidence_id}.`
  }
  for (const entry of bundle.citation_map) {
    const missingEvidence = entry.evidence_ids.filter((id) => !evidenceIDs.has(id))
    if (missingEvidence.length > 0) {
      return `bundle.citation_map "${entry.claim_id}" references unknown evidence id(s): ${missingEvidence.join(", ")}.`
    }
  }
  return undefined
}

function renderResearchBundleMarkdown(bundle: ResearchBundleInput): string {
  return bundle.full_markdown_sections
    .map((section) => {
      const evidenceLine = section.evidence_ids.length > 0 ? [`Evidence: ${section.evidence_ids.join(", ")}`] : []
      return [`## ${section.title}`, ...evidenceLine, "", markdownList(section.points)].join("\n")
    })
    .join("\n\n")
}

export function materializeResearchBundle(bundle: ResearchBundleInput): ResearchBundle {
  return ResearchBundleSchema.parse({
    full_markdown: renderResearchBundleMarkdown(bundle),
    evidence_json: JSON.stringify({ evidence_notes: bundle.evidence_notes }, null, 2),
    citation_map_json: JSON.stringify({ citations: bundle.citation_map }, null, 2),
  })
}

function webpageContractFromCollector(collector: ResearchCollector): ResearchDraft["webpage_contract"] | undefined {
  if (!collector.webpage_contract_source) return undefined
  return ResearchWebpageContractSchema.parse({
    ...collector.webpage_contract_source,
    functional_surfaces: collector.webpage_functional_surfaces,
    visual_layout: collector.webpage_visual_layout,
    style_requirements: collector.webpage_style_requirements,
    interaction_states: collector.webpage_interaction_states,
    data_content_inventory: collector.webpage_data_content_inventory,
    fidelity_acceptance: collector.webpage_fidelity_acceptance,
    fidelity_risks: collector.webpage_fidelity_risks,
  })
}

function assembleDraft(collector: ResearchCollector): ResearchDraft {
  return ResearchBriefDraftSchema.parse({
    scope: collector.scope,
    summary: collector.summary,
    evidence_index: collector.evidence_index,
    facts: collector.facts,
    inferences: collector.inferences,
    problem_statements: collector.problem_statements,
    user_needs: collector.user_needs,
    constraints: collector.constraints,
    document_outline: collector.document_outline,
    webpage_contract: webpageContractFromCollector(collector),
    subpage_research_tasks: collector.subpage_research_tasks,
    open_questions: collector.open_questions,
    bundle: collector.bundle,
  })
}

function assemblePartialDraft(collector: ResearchCollector): ResearchPartialDraft {
  const webpageContract = collector.webpage_contract_source
    ? ResearchWebpageContractSchema.safeParse({
        ...collector.webpage_contract_source,
        functional_surfaces: collector.webpage_functional_surfaces,
        visual_layout: collector.webpage_visual_layout,
        style_requirements: collector.webpage_style_requirements,
        interaction_states: collector.webpage_interaction_states,
        data_content_inventory: collector.webpage_data_content_inventory,
        fidelity_acceptance: collector.webpage_fidelity_acceptance,
        fidelity_risks: collector.webpage_fidelity_risks,
      })
    : undefined
  const bundleComplete =
    collector.bundle.full_markdown_sections.length > 0 &&
    collector.bundle.evidence_notes.length > 0 &&
    collector.bundle.citation_map.length > 0
  return ResearchPartialDraftSchema.parse({
    scope: collector.scope,
    summary: collector.summary,
    evidence_index: collector.evidence_index,
    facts: collector.facts,
    inferences: collector.inferences,
    problem_statements: collector.problem_statements,
    user_needs: collector.user_needs,
    constraints: collector.constraints,
    document_outline: collector.document_outline,
    webpage_contract: webpageContract?.success ? webpageContract.data : undefined,
    subpage_research_tasks: collector.subpage_research_tasks,
    open_questions: collector.open_questions,
    bundle: bundleComplete ? collector.bundle : undefined,
  })
}

function validateDraftForSubmit(draft: ResearchDraft): string | undefined {
  const metadata = {
    research_session_id: "semantic-validation",
    created_for_message_id: "semantic-validation",
    request_hash: researchRequestHash("semantic-validation"),
    created_at: new Date(0).toISOString(),
  }
  const paths = {
    full_markdown_path: "semantic-validation/full.md",
    evidence_json_path: "semantic-validation/evidence.json",
    citation_map_path: "semantic-validation/citations.json",
  }
  const brief = parseResearchBriefWithCanonicalDigest({
    ...draft,
    metadata,
    bundle: paths,
  })
  const semanticError = validateResearchBriefSemantics(brief)
  if (semanticError) return `research brief failed semantic validation: ${semanticError}`
  const bundleError = validateResearchBundleInputSemantics(draft.bundle, brief)
  if (bundleError) return `research bundle failed semantic validation: ${bundleError}`
  return undefined
}

function researchMissingActions(
  collector: ResearchCollector,
  options: { expectedWebpageSourceUrl?: string } = {},
): string[] {
  const actions: string[] = []
  if (!collector.scope)
    actions.push(
      "update_research_scope({ user_goal, deliverable_type, audience, explicit_non_goals, assumed_non_goals })",
    )
  if (!collector.summary) actions.push("update_research_summary({ summary })")
  if (collector.bundle.full_markdown_sections.length === 0) {
    actions.push("update_research_bundle_section({ title, evidence_ids, points })")
  }
  if (collector.bundle.evidence_notes.length === 0) {
    actions.push("update_research_evidence_note({ evidence_id, observations, artifact_refs })")
  }
  if (collector.bundle.citation_map.length === 0) {
    actions.push("update_research_citation({ claim_id, evidence_ids, pointer, usage })")
  }
  if (options.expectedWebpageSourceUrl && !collector.webpage_contract_source) {
    actions.push(
      `update_webpage_contract_source({ source_url: "${options.expectedWebpageSourceUrl}", reference_image_evidence_ids })`,
    )
  }
  if (collector.webpage_contract_source || options.expectedWebpageSourceUrl) {
    if (collector.webpage_functional_surfaces.length === 0) {
      actions.push(
        "update_webpage_functional_surface({ id, title, user_visible_behavior, component_kind_hypothesis, required_interactions, evidence_ids })",
      )
    }
    if (collector.webpage_visual_layout.length === 0) {
      actions.push(
        "update_webpage_visual_layout({ id, viewport, region, layout_contract, spacing_and_alignment, evidence_ids })",
      )
    }
    if (collector.webpage_style_requirements.length === 0) {
      actions.push("update_webpage_style_requirement({ id, token_or_selector, requirement, evidence_ids })")
    }
    if (collector.webpage_data_content_inventory.length === 0) {
      actions.push("update_webpage_data_inventory({ id, surface, content_contract, evidence_ids })")
    }
    if (collector.webpage_fidelity_acceptance.length === 0) {
      actions.push("update_webpage_fidelity_acceptance({ id, target, criterion, evidence_ids })")
    }
  }
  return actions
}

function researchResultStatus(
  collector: ResearchCollector,
  options: { expectedWebpageSourceUrl?: string } = {},
): string {
  const missing = researchMissingActions(collector, options)
  const lines = [
    `RESEARCH_RESULT_STATUS: ${missing.length > 0 ? "incomplete" : "complete_snapshot"}`,
    `registered: evidence=${collector.evidence_index.length}, facts=${collector.facts.length}, inferences=${collector.inferences.length}, problems=${collector.problem_statements.length}, needs=${collector.user_needs.length}, constraints=${collector.constraints.length}, outline=${collector.document_outline.length}, bundle_sections=${collector.bundle.full_markdown_sections.length}, evidence_notes=${collector.bundle.evidence_notes.length}, citations=${collector.bundle.citation_map.length}, webpage_functional_surfaces=${collector.webpage_functional_surfaces.length}, webpage_visual_layout=${collector.webpage_visual_layout.length}, webpage_style_requirements=${collector.webpage_style_requirements.length}, webpage_data_inventory=${collector.webpage_data_content_inventory.length}, webpage_fidelity_acceptance=${collector.webpage_fidelity_acceptance.length}`,
  ]
  if (collector.semantic_error) lines.push(`last_validation_error: ${collector.semantic_error}`)
  if (missing.length > 0) {
    lines.push("next_required_update_calls:", markdownList(missing))
  } else lines.push("next: finish with a visible summary; the Host will persist this fact snapshot")
  return lines.join("\n")
}

function markCollectorMutated(collector: ResearchCollector): void {
  collector.semantic_error = undefined
}

function upsertByID<T extends { id: string }>(items: T[], item: T): "registered" | "overwritten" {
  const idx = items.findIndex((existing) => existing.id === item.id)
  if (idx >= 0) {
    items[idx] = item
    return "overwritten"
  }
  items.push(item)
  return "registered"
}

function knownFactIDs(collector: ResearchCollector): Set<string> {
  return new Set(collector.facts.map((fact) => fact.id))
}

function knownEvidenceIDs(collector: ResearchCollector): Set<string> {
  return new Set(collector.evidence_index.map((item) => item.id))
}

function sortedKnownList(ids: Set<string>): string {
  const known = [...ids].sort()
  return known.length ? known.join(", ") : "(none)"
}

function unknownFactIDError(collector: ResearchCollector, label: string, ids: readonly string[]): string | undefined {
  const known = knownFactIDs(collector)
  const missing = [...new Set(ids.filter((id) => !known.has(id)))]
  if (missing.length === 0) return undefined
  return (
    `Error: ${label} references unknown fact id(s): ${missing.join(", ")}. ` +
    `Register or correct the fact ids first; known fact ids: ${sortedKnownList(known)}. ` +
    "Collector unchanged."
  )
}

function unknownEvidenceIDError(
  collector: ResearchCollector,
  label: string,
  ids: readonly string[],
): string | undefined {
  const known = knownEvidenceIDs(collector)
  const missing = [...new Set(ids.filter((id) => !known.has(id)))]
  if (missing.length === 0) return undefined
  return (
    `Error: ${label} references unknown evidence id(s): ${missing.join(", ")}. ` +
    `Register or correct the evidence ids first; known evidence ids: ${sortedKnownList(known)}. ` +
    "Collector unchanged."
  )
}

function upsertBundleSection(
  collector: ResearchCollector,
  section: z.infer<typeof ResearchBundleMarkdownSectionSchema>,
): string {
  const idx = collector.bundle.full_markdown_sections.findIndex((existing) => existing.title === section.title)
  if (idx >= 0) {
    collector.bundle.full_markdown_sections[idx] = section
    return `OK: bundle section "${section.title}" overwritten (${collector.bundle.full_markdown_sections.length} total)`
  }
  collector.bundle.full_markdown_sections.push(section)
  return `OK: bundle section "${section.title}" registered (${collector.bundle.full_markdown_sections.length} total)`
}

export function createResearchOutputTools(
  options: { expectedWebpageSourceUrl?: string; onToolMaterialized?: (toolID: string) => void } = {},
) {
  let collector = emptyCollector()
  const toolFactories = {
    update_research_scope: () => tool({
      description: "Set the brief scope once before registering research items.",
      inputSchema: ResearchScopeSchema,
      execute: async (input) => {
        const parsed = ResearchScopeSchema.parse(input)
        markCollectorMutated(collector)
        collector.scope = parsed
        return "OK: research scope set"
      },
    }),

    update_research_summary: () => tool({
      description: "Set or replace the compact research summary.",
      inputSchema: z.object({ summary: z.string().min(1) }),
      execute: async ({ summary }) => {
        markCollectorMutated(collector)
        collector.summary = summary
        return "OK: research summary set"
      },
    }),

    update_research_evidence: () => tool({
      description: "Register one evidence source. Call once per source or prepared artifact.",
      inputSchema: ResearchEvidenceRefSchema,
      execute: async (input) => {
        const parsed = ResearchEvidenceRefSchema.parse(input)
        markCollectorMutated(collector)
        const mode = upsertByID(collector.evidence_index, parsed)
        return `OK: evidence "${parsed.id}" ${mode} (${collector.evidence_index.length} total)`
      },
    }),

    update_research_fact: () => tool({
      description: "Register one source-backed fact.",
      inputSchema: ResearchFactSchema,
      execute: async (input) => {
        const parsed = ResearchFactSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(collector, `fact ${parsed.id}.evidence_ids`, parsed.evidence_ids)
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.facts, parsed)
        return `OK: fact "${parsed.id}" ${mode} (${collector.facts.length} total)`
      },
    }),

    update_research_inference: () => tool({
      description: "Register one inference based on registered fact IDs.",
      inputSchema: ResearchInferenceSchema,
      execute: async (input) => {
        const parsed = ResearchInferenceSchema.parse(input)
        const factErr = unknownFactIDError(
          collector,
          `inference "${parsed.id}".based_on_fact_ids`,
          parsed.based_on_fact_ids,
        )
        if (factErr) return factErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.inferences, parsed)
        return `OK: inference "${parsed.id}" ${mode} (${collector.inferences.length} total)`
      },
    }),

    update_research_problem: () => tool({
      description: "Register one problem statement derived from the evidence.",
      inputSchema: ResearchProblemStatementSchema,
      execute: async (input) => {
        const parsed = ResearchProblemStatementSchema.parse(input)
        const factErr = unknownFactIDError(collector, `problem "${parsed.id}".fact_ids`, parsed.fact_ids)
        if (factErr) return factErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.problem_statements, parsed)
        return `OK: problem "${parsed.id}" ${mode} (${collector.problem_statements.length} total)`
      },
    }),

    update_research_need: () => tool({
      description: "Register one user need derived from task and evidence.",
      inputSchema: ResearchUserNeedSchema,
      execute: async (input) => {
        const parsed = ResearchUserNeedSchema.parse(input)
        const factErr = unknownFactIDError(collector, `need "${parsed.id}".fact_ids`, parsed.fact_ids)
        if (factErr) return factErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.user_needs, parsed)
        return `OK: need "${parsed.id}" ${mode} (${collector.user_needs.length} total)`
      },
    }),

    update_research_constraint: () => tool({
      description: "Register one constraint derived from task and evidence.",
      inputSchema: ResearchConstraintSchema,
      execute: async (input) => {
        const parsed = ResearchConstraintSchema.parse(input)
        const factErr = unknownFactIDError(collector, `constraint "${parsed.id}".fact_ids`, parsed.fact_ids)
        if (factErr) return factErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.constraints, parsed)
        return `OK: constraint "${parsed.id}" ${mode} (${collector.constraints.length} total)`
      },
    }),

    update_research_document_section: () => tool({
      description: "Register one downstream document-outline section.",
      inputSchema: ResearchDocumentSectionSchema,
      execute: async (input) => {
        const parsed = ResearchDocumentSectionSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `document_outline ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.document_outline, parsed)
        return `OK: document section "${parsed.id}" ${mode} (${collector.document_outline.length} total)`
      },
    }),

    update_webpage_contract_source: () => tool({
      description: "Set webpage contract source URL and visual reference evidence IDs.",
      inputSchema: WebpageContractSourceInputSchema,
      execute: async (input) => {
        const parsed = WebpageContractSourceInputSchema.parse(input)
        if (options.expectedWebpageSourceUrl && parsed.source_url !== options.expectedWebpageSourceUrl) {
          return (
            "Error: webpage_contract.source_url must match the prepared frontend_research source URL " +
            `${options.expectedWebpageSourceUrl}; received ${parsed.source_url}.`
          )
        }
        const evidenceErr = unknownEvidenceIDError(
          collector,
          "webpage_contract.reference_image_evidence_ids",
          parsed.reference_image_evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        collector.webpage_contract_source = parsed
        return "OK: webpage contract source set"
      },
    }),

    update_webpage_functional_surface: () => tool({
      description: "Register one webpage functional surface work packet.",
      inputSchema: ResearchWebpageFunctionalSurfaceSchema,
      execute: async (input) => {
        const parsed = ResearchWebpageFunctionalSurfaceSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.functional_surface ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_functional_surfaces, parsed)
        return `OK: webpage functional surface "${parsed.id}" ${mode}`
      },
    }),

    update_webpage_visual_layout: () => tool({
      description: "Register one webpage visual layout work packet.",
      inputSchema: ResearchWebpageVisualLayoutSchema,
      execute: async (input) => {
        const parsed = ResearchWebpageVisualLayoutSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.visual_layout ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_visual_layout, parsed)
        return `OK: webpage visual layout "${parsed.id}" ${mode}`
      },
    }),

    update_webpage_style_requirement: () => tool({
      description: "Register one webpage style requirement work packet.",
      inputSchema: ResearchWebpageStyleRequirementSchema,
      execute: async (input) => {
        const parsed = ResearchWebpageStyleRequirementSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.style_requirement ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_style_requirements, parsed)
        return `OK: webpage style requirement "${parsed.id}" ${mode}`
      },
    }),

    update_webpage_interaction_state: () => tool({
      description: "Register one webpage interaction-state work packet.",
      inputSchema: ResearchWebpageInteractionStateSchema,
      execute: async (input) => {
        const parsed = ResearchWebpageInteractionStateSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.interaction_state ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_interaction_states, parsed)
        return `OK: webpage interaction state "${parsed.id}" ${mode}`
      },
    }),

    update_webpage_data_inventory: () => tool({
      description: "Register one webpage data/content inventory work packet.",
      inputSchema: ResearchWebpageDataInventorySchema,
      execute: async (input) => {
        const parsed = ResearchWebpageDataInventorySchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.data_content_inventory ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_data_content_inventory, parsed)
        return `OK: webpage data inventory "${parsed.id}" ${mode}`
      },
    }),

    update_webpage_fidelity_acceptance: () => tool({
      description: "Register one webpage fidelity acceptance work packet.",
      inputSchema: ResearchWebpageAcceptanceCriterionSchema,
      execute: async (input) => {
        const parsed = ResearchWebpageAcceptanceCriterionSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.fidelity_acceptance ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_fidelity_acceptance, parsed)
        return `OK: webpage fidelity acceptance "${parsed.id}" ${mode}`
      },
    }),

    update_webpage_fidelity_risk: () => tool({
      description: "Register one webpage fidelity risk.",
      inputSchema: ResearchWebpageFidelityRiskSchema,
      execute: async (input) => {
        const parsed = ResearchWebpageFidelityRiskSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `webpage_contract.fidelity_risk ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.webpage_fidelity_risks, parsed)
        return `OK: webpage fidelity risk "${parsed.id}" ${mode}`
      },
    }),

    update_subpage_research_task: () => tool({
      description: "Register one independent subpage or same-page deep-state research task.",
      inputSchema: ResearchSubpageTaskSchema,
      execute: async (input) => {
        const parsed = ResearchSubpageTaskSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `subpage_research_task ${parsed.id}.evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.subpage_research_tasks, parsed)
        return `OK: subpage research task "${parsed.id}" ${mode}`
      },
    }),

    update_research_open_question: () => tool({
      description: "Register one open question.",
      inputSchema: ResearchOpenQuestionSchema,
      execute: async (input) => {
        const parsed = ResearchOpenQuestionSchema.parse(input)
        const factErr = unknownFactIDError(
          collector,
          `open_question "${parsed.id}".related_fact_ids`,
          parsed.related_fact_ids,
        )
        if (factErr) return factErr
        markCollectorMutated(collector)
        const mode = upsertByID(collector.open_questions, parsed)
        return `OK: open question "${parsed.id}" ${mode} (${collector.open_questions.length} total)`
      },
    }),

    update_research_bundle_section: () => tool({
      description: "Register one rendered research-bundle markdown section.",
      inputSchema: ResearchBundleMarkdownSectionSchema,
      execute: async (input) => {
        const parsed = ResearchBundleMarkdownSectionSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `bundle section "${parsed.title}".evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        return upsertBundleSection(collector, parsed)
      },
    }),

    update_research_evidence_note: () => tool({
      description: "Register one structured evidence note for evidence.json.",
      inputSchema: ResearchBundleEvidenceNoteSchema,
      execute: async (input) => {
        const parsed = ResearchBundleEvidenceNoteSchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(collector, "evidence note.evidence_id", [parsed.evidence_id])
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const idx = collector.bundle.evidence_notes.findIndex((existing) => existing.evidence_id === parsed.evidence_id)
        if (idx >= 0) {
          collector.bundle.evidence_notes[idx] = parsed
          return `OK: evidence note "${parsed.evidence_id}" overwritten`
        }
        collector.bundle.evidence_notes.push(parsed)
        return `OK: evidence note "${parsed.evidence_id}" registered (${collector.bundle.evidence_notes.length} total)`
      },
    }),

    update_research_citation: () => tool({
      description: "Register one claim-to-evidence citation for citation-map.json.",
      inputSchema: ResearchBundleCitationEntrySchema,
      execute: async (input) => {
        const parsed = ResearchBundleCitationEntrySchema.parse(input)
        const evidenceErr = unknownEvidenceIDError(
          collector,
          `citation "${parsed.claim_id}".evidence_ids`,
          parsed.evidence_ids,
        )
        if (evidenceErr) return evidenceErr
        markCollectorMutated(collector)
        const idx = collector.bundle.citation_map.findIndex((existing) => existing.claim_id === parsed.claim_id)
        if (idx >= 0) {
          collector.bundle.citation_map[idx] = parsed
          return `OK: citation "${parsed.claim_id}" overwritten`
        }
        collector.bundle.citation_map.push(parsed)
        return `OK: citation "${parsed.claim_id}" registered (${collector.bundle.citation_map.length} total)`
      },
    }),

    inspect_research_result_status: () => tool({
      description: "Inspect which research fragments have been recorded and which remain missing.",
      inputSchema: z.object({}).strict(),
      execute: async () => researchResultStatus(collector, options),
    }),
  }
  const nonReplayableToolNames = new Set(["inspect_research_result_status"])
  function isResearchOutputMutationToolName(toolName: string): toolName is keyof typeof toolFactories {
    return Object.prototype.hasOwnProperty.call(toolFactories, toolName) && !nonReplayableToolNames.has(toolName)
  }
  return {
    materializeExact: (toolID: string) =>
      materializeExactTool(toolFactories, toolID, options.onToolMaterialized),
    getCollector: () => collector,
    snapshotDraft() {
      const missing = researchMissingActions(collector, options)
      if (missing.length > 0) return { ok: false as const, missing, draft: assemblePartialDraft(collector) }
      try {
        const draft = assembleDraft(collector)
        const validationError = validateDraftForSubmit(draft)
        if (validationError) {
          return { ok: false as const, missing: [], error: validationError, draft: assemblePartialDraft(collector) }
        }
        return { ok: true as const, draft }
      } catch (error) {
        return {
          ok: false as const,
          missing: [],
          error: error instanceof Error ? error.message : String(error),
          draft: assemblePartialDraft(collector),
        }
      }
    },
    async replayUpdateToolCalls(calls: Iterable<ResearchToolCallReplay>) {
      let replayed = 0
      for (const call of calls) {
        if (!isResearchOutputMutationToolName(call.toolName)) continue
        const outputTool = materializeExactTool(toolFactories, call.toolName, options.onToolMaterialized)!
        const execute = outputTool.execute
        if (!execute) throw new Error(`research output tool ${call.toolName} has no execute handler`)
        await execute(call.input as never, {} as never)
        replayed++
      }
      return replayed
    },
    reset() {
      collector = emptyCollector()
      return collector
    },
  }
}

export function researchBundleFromDraft(draft: ResearchDraft): ResearchBundle {
  return materializeResearchBundle(draft.bundle)
}
