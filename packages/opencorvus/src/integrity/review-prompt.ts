/**
 * Integrity review prompt copy and rendering.
 *
 * Split out of `team-agent.ts`, which carried the prompt text, the review's
 * structural validation, the session/tool orchestration and the report
 * normalization in one 1002-line file. Prompt copy changes for editorial
 * reasons and validation changes for correctness reasons; they had no business
 * sharing a compilation unit.
 */
import type { AcceptanceSpec } from "@/acceptance/types"
import type { GoalContractFields } from "@/pipeline/types"
import { renderUserRequestSection } from "@/intent/request-prompt"
import type { ParsedRequirement } from "@/requirements/types"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { sanitizeIntegrityPromptText } from "./shared-prompt"
import { IntegrityCoverageStatusValues } from "./team-schema"
import {
  projectIntegrityPromptFacts,
  projectIntegrityEvidenceFacts,
  type IntegrityPromptProjection,
  type IntegrityFactSelection,
} from "./fact-projection"

export type IntegrityPromptRefs = IntegrityFactSelection & { instruction: string }

const FINDING_TRACEABILITY_PROMPT = [
  "Finding traceability:",
  "Every finding you register must cite a REQ-N via `requirementIDs`, an AcceptanceSpec id via `specIDs`, or a literal original user-request substring via `userRequestQuotes`.",
  "Do not attach a REQ-N or AS id unless that requirement/spec already names the audited behavior.",
  "If the concern has no REQ, AS, or literal user-request quote anchor, it is out of scope; leave it out and, when useful, mention the dropped untraced concern in the visible final message.",
].join("\n")

const CONSENSUS_TRACEABILITY_PROMPT = [
  FINDING_TRACEABILITY_PROMPT,
  "A finding that does not cite a REQ-N, AS id, or literal user-request substring is out of scope and must be omitted from the IntegrityReview.",
  "If multiple reviewers all reported the same untraced concern, that is evidence that the persisted contract may be incomplete; emit one contract-extraction concern, not a blocker for each sub-aspect.",
].join("\n\n")

const FINDING_MANIFEST_PROMPT = [
  "Finding manifest discipline:",
  "For every finding, include `canonicalSymptom` as a stable plain-language defect description, `verify[]` as concrete checks projected repair or review consumers can use, and `affectedSymbols[]` when a function/component/API is known.",
  "When a finding repeats a prior blocker, keep the same defect surface: set `sourceFindingIDs[]` and `priorReviewRefs[]` when known, and do not rename it to escape repair accountability.",
  "For every blocking finding, register a matching required repair. If that linkage is absent, preserve the mismatch as a visible completeness finding.",
  "Do not invent fingerprints. The host computes deterministic fingerprints after schema validation.",
].join("\n")

const COVERAGE_AUDIT_STATUS_CONTRACT_PROMPT = [
  "Coverage audit status contract:",
  `- \`coverageAudit[].status\` and reviewer \`coverage[].status\` must be exactly one of: ${IntegrityCoverageStatusValues.map((value) => `\`${value}\``).join(", ")}.`,
  "- Use `missing` when a request promise is not satisfied. Do not use `concerns`, `needs_correction`, `failed`, `uncovered`, or `partial` in coverage status fields.",
  "- Overall verdict values belong only in `verdict` / `verdictImpact`; never copy those verdict values into coverage audit rows.",
].join("\n")

const REVIEWER_COVERAGE_ROW_CONTRACT_PROMPT = [
  "Reviewer coverage row contract:",
  "- Each `coverage[]` row uses singular anchor fields plus `checkIDs`: `checkIDs[]`, `requirementID?: string`, `specID?: string`, `userRequestQuote?: string`, `status`, and `evidence`.",
  "- Do not put finding traceability fields inside `coverage[]`: no `requirementIDs`, `specIDs`, `userRequestQuotes`, `affectedSymbols`, or plural arrays.",
  "- Every `coverage[]` row must cite the registered check item IDs that produced the coverage judgment.",
  "- Every `coverage[]` row must include at least one singular anchor: `requirementID`, `specID`, or `userRequestQuote`.",
  "- If several anchors apply, emit several coverage rows or choose the strongest single anchor; reserve plural traceability arrays for `findings[]` only.",
].join("\n")

const REVIEWER_DRILLDOWN_ROW_CONTRACT_PROMPT = [
  "Reviewer drilldown row contract:",
  "- Each `drilldowns[]` row uses exactly `checkIDs`, `kind`, `target`, `purpose`, and `result`.",
  "- Every `drilldowns[]` row must cite the registered check item IDs that motivated the inspection.",
  "- Do not put finding fields inside `drilldowns[]`: no `affectedSymbols`, `requirementIDs`, `specIDs`, `userRequestQuotes`, `filePaths`, or typo variants.",
  "- Put impacted symbols and files on `findings[]` only when there is an actual finding.",
].join("\n")

const REVIEWER_EVIDENCE_ROW_CONTRACT_PROMPT = [
  "Reviewer evidence row contract:",
  "- Each reviewer `evidence[]` row uses exactly `checkIDs` and `note`.",
  "- Every evidence note must cite the registered check item IDs it supports; do not register plain evidence strings.",
  "- Only fill check item `evidence[]` after actual tool-backed inspection or command/runtime/visual evidence exists, and reuse those exact evidence strings in reviewer `evidence[]`, `coverage[]`, or `drilldowns[]` support rows.",
  "- Finding and required-repair `evidence[]` must come from the cited check item evidence; do not invent downstream evidence text from plans, summaries, or intent.",
  "- Every register tool whose row has an ID is an upsert. If validation reports a bad check item, reviewer, finding, required repair, round, or disagreement, call the same register tool again with the same ID and the complete corrected row; it overwrites the prior row. The collector remains open after validation errors, so do not request a reset merely to amend evidence refs.",
].join("\n")

const ADVERSARIAL_INVESTIGATION_PROMPT = [
  "Adversarial investigation discipline:",
  "- Start each reviewer perspective by deriving concrete failure hypotheses from the original request, REQ rows, goal contracts, acceptance specs, changed directories, prior findings, and runtime/visual evidence. Do not start from executor self-assessment.",
  "- Treat build/typecheck success, grep output, and file listings as leads, not proof. A pass claim needs scoped evidence that could have disproved it.",
  "- Every reviewer review must include `investigationPlan` with `requestPromise`, `hypothesis`, `evidencePlan[]`, and `passCriteria[]`; `requestPromise` is the concrete original user/REQ/spec promise being falsified.",
  "- A pass reviewer review still needs `investigationPlan`, `drilldowns[]`, `coverage[]`, and `evidence[]` showing what was inspected and why that inspection would expose the scoped failure.",
  "- Reviewer reviews must not contain `findings[]`; register every finding through `register_integrity_finding` after registering the check item that exposed it.",
  "- If tools are available but a high-risk surface was not inspected, record `coverage` as `inconclusive` or `missing` and include `uninspectedRisks`; do not turn an inspection gap into praise.",
  "- Do not write congratulatory or effort-focused summaries. Summaries should say which request promises survived falsification, which did not, and what remains uninspected.",
].join("\n")


const INTEGRITY_EVIDENCE_PROMPT_MAX_CHARS = 9_200
const INTEGRITY_EVIDENCE_LIMITS = {
  userRequestChars: 800,
  requirementDescriptionChars: 120,
  requirementAcceptanceChars: 100,
  requirementNonGoalChars: 80,
  requirements: 12,
  implementationDirectories: 24,
  goals: 8,
  goalObjectiveChars: 140,
  goalDirectories: 6,
  goalAcceptanceSpecs: 2,
  goalAcceptanceTitleChars: 80,
} as const

export function buildSingleSessionIntegrityPrompt(input: IntegrityPromptRefs): string {
  return renderSingleSessionIntegrityPrompt(projectIntegrityPromptFacts(input))
}

export function renderSingleSessionIntegrityPrompt(projection: IntegrityPromptProjection): string {
  return [
    "# Integrity Review",
    "Review the exact Goal scope and the durable Artifact versions you discover and completely read during this turn. No upstream participant supplies an Artifact inventory, locator, or semantic body.",
    renderSeverityReconciliationPass(),
    [
      "Perform the integrity review in this single streaming session. Do not spawn reviewer sessions or a planning session.",
      "Derive reviewer perspectives from the request, REQs, goals, acceptance specs, changed directories, runtime evidence, prior reviews, and risks.",
      "Register each inspected promise, surface, or suspected defect with `register_integrity_check_item`; cover every supplied REQ-N.",
      "Register reviewer perspectives, findings, repairs, coverage, risks, rounds, disagreements, and fact-check items through their dedicated register_integrity_* tools. Every review row cites its checkIDs.",
      "Register at least one evidence-backed reviewer review. Add perspectives only for distinct inspected risks; do not create reviewer identities to satisfy a count and do not use fixed dimensions.",
      "Compare reviewer evidence adversarially; do not pass with a blocking finding or unresolved blocking disagreement.",
      "Compare current evidence against prior reviews. A repeated blocker should stay persistent/regressed when evidence supports that; do not suppress a prior blocker merely because the current reviewer label differs.",
    ].join("\n\n"),
    CONSENSUS_TRACEABILITY_PROMPT,
    FINDING_MANIFEST_PROMPT,
    ADVERSARIAL_INVESTIGATION_PROMPT,
    COVERAGE_AUDIT_STATUS_CONTRACT_PROMPT,
    REVIEWER_COVERAGE_ROW_CONTRACT_PROMPT,
    REVIEWER_DRILLDOWN_ROW_CONTRACT_PROMPT,
    REVIEWER_EVIDENCE_ROW_CONTRACT_PROMPT,
    renderIntegrityEvidencePrompt(projection),
    "Use scoped evidence tools for the initial falsification pass: inspect overview, changed directories, goal summary, and then exact files/diffs/runtime/visual evidence for the reviewer perspectives that matter. Do not request full upstream context, full contract graph, raw decision log, or broad full-diff dumps unless a specific finding requires it.",
    "Register a coverage audit: every critical request promise should be `covered`, `missing`, or explicitly `inconclusive`. Include `coverageAudit`; include `uninspectedRisks` for high-risk surfaces no reviewer actually inspected.",
    'Every selected persisted REQ-N rendered in this prompt must appear at least once in registered check item requirementIDs and at least once in reviewer `coverage[]`, top-level `findings[].requirementIDs`, or `requiredRepairs[].requirementIDs`. Use `status:"missing"` or `status:"inconclusive"` coverage rows instead of silently skipping a REQ-N.',
    "Register every observed fact through the dedicated tools. You may call update_integrity_judgment whenever you have a current verdict and summary; it is optional and may be revised. Finish with a visible summary of findings, limitations, and exact evidence references.",
  ].join("\n\n")
}

export function buildIntegrityEvidencePrompt(input: IntegrityPromptRefs): string {
  return renderIntegrityEvidencePrompt(projectIntegrityPromptFacts(input))
}

export function renderIntegrityEvidencePrompt(input: IntegrityPromptProjection): string {
  const sections: string[] = []
  sections.push(
    renderUserRequestSection({
      heading: "# User Request",
      title: input.taskTitle,
      request: sanitizeIntegrityPromptText({
        text: input.userRequest,
        field: "user_request_quote",
        maxChars: INTEGRITY_EVIDENCE_LIMITS.userRequestChars,
        markdownContext: "block",
      }).text,
      taskID: input.taskID,
    }),
  )
  sections.push(
    ["# Review Instruction", sanitizePromptBlock(input.instruction, INTEGRITY_EVIDENCE_LIMITS.userRequestChars)].join(
      "\n",
    ),
  )
  if (input.requirements?.length) {
    sections.push(renderRequirementLocatorIndex(input.requirements))
  }
  if (input.hostObservationLocators.length > 0 || input.changedFiles.length > 0) {
    sections.push(renderHostObservationSummary(input))
  }
  const referencedFacts = renderPromptSections(withAttachmentPromptSections(input.contextSections, input.attachments))
  if (referencedFacts) sections.push(referencedFacts)
  sections.push(renderGoalContractSummary(input.goals))
  return clipIntegrityEvidenceText(
    sections.filter((section) => section.trim().length > 0).join("\n\n"),
    INTEGRITY_EVIDENCE_PROMPT_MAX_CHARS,
  )
}

function renderRequirementLocatorIndex(requirements: ParsedRequirement[]): string {
  const visible = requirements.slice(0, INTEGRITY_EVIDENCE_LIMITS.requirements)
  const lines = [
    "# Selected Requirement ID index",
    visible.length === requirements.length
      ? `Indexed all ${requirements.length} selected requirement IDs.`
      : `Indexed ${visible.length}/${requirements.length} selected requirement IDs.`,
    "Read the exact selected RequirementSet locator with `artifact_read` for descriptions, acceptance criteria, non-goals, decisions, and evidence refs; none of those bodies are copied here.",
  ]
  for (const r of visible) {
    lines.push(`- ${r.id}`)
  }
  appendOmittedLine(lines, requirements.length, visible.length, "requirements")
  return lines.join("\n")
}

function renderHostObservationSummary(input: IntegrityPromptProjection): string {
  const allChangedDirectories = promptPathDirectories(input.changedFiles)
  const changedDirectories = allChangedDirectories.slice(0, INTEGRITY_EVIDENCE_LIMITS.implementationDirectories)
  const lines = [
    "# Host Observation References",
    ...(input.hostObservationLocators.length > 0
      ? input.hostObservationLocators.map((locator) => `- ${JSON.stringify(locator)}`)
      : ["- (none)"]),
    `Changed directories (${changedDirectories.length}/${allChangedDirectories.length}; files=${input.changedFiles.length}):`,
    ...(changedDirectories.length > 0 ? changedDirectories.map((directory) => `- ${directory}`) : ["- (none)"]),
  ]
  appendOmittedLine(lines, allChangedDirectories.length, changedDirectories.length, "changed directories")
  lines.push(
    "Use inspect_integrity_evidence for exact Host-observed diffs; no diff payload is copied into this prompt.",
  )
  return lines.join("\n")
}

function renderGoalContractSummary(goals: GoalContractFields[]): string {
  const visible = goals.slice(0, INTEGRITY_EVIDENCE_LIMITS.goals)
  const lines = [`# Goal Contracts Summary (${visible.length}/${goals.length})`]
  for (const goal of visible) {
    const directories = promptPathDirectories(goal.owned_paths).slice(0, INTEGRITY_EVIDENCE_LIMITS.goalDirectories)
    lines.push(
      [
        `## ${goal.id}: ${sanitizePromptLine(goal.title, "generic")}`,
        `Objective: ${sanitizePromptBlock(goal.objective, INTEGRITY_EVIDENCE_LIMITS.goalObjectiveChars)}`,
        `Acceptance Specs Summary:\n${renderAcceptanceSpecSummary(goal.acceptance_specs ?? [])}`,
        `Responsibility Directories (${directories.length}/${promptPathDirectories(goal.owned_paths).length}; paths=${goal.owned_paths.length}): ${directories.join(", ") || "(none)"}`,
        `Priority: ${goal.priority}`,
        `Kind: ${goal.kind}`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
  }
  appendOmittedLine(lines, goals.length, visible.length, "goals")
  return lines.join("\n")
}

function renderAcceptanceSpecSummary(specs: readonly AcceptanceSpec[]): string {
  if (specs.length === 0) return "(no acceptance specs)"
  const visible = specs.slice(0, INTEGRITY_EVIDENCE_LIMITS.goalAcceptanceSpecs)
  const lines: string[] = []
  for (const spec of visible) {
    lines.push(
      `- [${spec.severity}] ${spec.id}${spec.source ? ` <- ${spec.source.kind}:${spec.source.id}` : ""}: ${sanitizePromptBlock(
        spec.title,
        INTEGRITY_EVIDENCE_LIMITS.goalAcceptanceTitleChars,
      )}; scorer_count=${spec.scorers.length}`,
    )
  }
  appendOmittedLine(lines, specs.length, visible.length, "acceptance specs")
  return lines.join("\n")
}

function renderSeverityReconciliationPass(): string {
  return [
    "# Severity Reconciliation Pass",
    "Before recording or revising the optional reviewer judgment:",
    "",
    "1. Identify every group of reviewer findings that target the same defect surface (same file/function/symptom). Treat ids as labels, not as identity; use the description and evidence to detect overlap.",
    "",
    '2. For each group, decide a single team severity using the bar in "Severity Discipline". Do NOT carry both severities forward. If reviewers disagree, fold the group into one finding with `consensus=\"disputed\"` when the disagreement is real, and pick the severity that the bar clauses (a)-(e) support. If neither bar clause is met, the team severity is advisory.',
    "",
    "3. If a finding repeats a defect that was advisory in any prior review from replay context, and there is no Severity Discipline new evidence raising it to a bar clause (a)-(e), keep it advisory. Persistence alone is not a promotion trigger. A deeper reading of unchanged code or unchanged prior runtime output is not new evidence.",
    "",
    '4. If a finding repeats a defect that was blocking in a prior attempt and the implementation evidence since that attempt does NOT show a repair on that surface, keep it blocking and mark `consensus=\"agreed\"` with a persistent note.',
  ].join("\n")
}

function sanitizePromptLine(text: string, field: "user_request_quote" | "generic"): string {
  return sanitizeIntegrityPromptText({
    text,
    field,
    markdownContext: "inline",
  })
    .text.replace(/\s+/g, " ")
    .trim()
}

function sanitizePromptBlock(text: string, maxChars: number): string {
  return sanitizeIntegrityPromptText({
    text,
    field: "generic",
    markdownContext: "block",
    maxChars,
  }).text
}

function promptPathDirectories(paths: readonly string[]): string[] {
  const directories = new Set<string>()
  for (const path of paths) {
    const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "")
    const index = normalized.lastIndexOf("/")
    directories.add(index > 0 ? normalized.slice(0, index) : ".")
  }
  return [...directories].sort((left, right) => left.localeCompare(right))
}

function appendOmittedLine(lines: string[], total: number, rendered: number, label: string) {
  if (total > rendered) lines.push(`- omitted ${total - rendered} ${label} from initial integrity context`)
}

function clipIntegrityEvidenceText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  const marker = "\n[omitted_by_initial_integrity_context_cap]"
  return `${text.slice(0, Math.max(0, maxChars - marker.length)).trimEnd()}${marker}`
}

