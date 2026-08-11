import { tool, type ToolSet } from "ai"
import z from "zod"
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { createAiSdkToolFromInfo } from "@/tool/ai-sdk-adapter"
import type { Tool } from "@/tool/tool"
import type { AcceptanceSpec } from "@/acceptance/types"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { FactCheckItemSchema } from "@/fact-check/schema"
import { renderUserRequestSection } from "@/intent/request-prompt"
import type { GoalContractFields } from "@/pipeline/types"
import { createReviewReasoningForwarder, emitReviewStreamStarted, reviewIDForIntegrity } from "@/review/stream"
import type { ParsedRequirement } from "@/requirements/types"
import { completeArtifactReadLocatorsForSession } from "@/agent/artifact-read-facts"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { Log } from "@/util/log"
import { createIntegrityAcceptanceTools } from "./acceptance-tools"
import {
  projectIntegrityPromptFacts,
  type IntegrityFactSelection,
  type IntegrityPromptProjection,
} from "./fact-projection"
import { loadIntegrityPreviewToolInfos } from "./static-tools"
import { integrityFindingFingerprint, stableList } from "./finding-manifest"
import { sanitizeIntegrityPromptText } from "./shared-prompt"
import {
  IntegrityCheckItemSchema,
  IntegrityCoverageAuditRowSchema,
  IntegrityCoverageStatusValues,
  IntegrityVerdictSchema,
  IntegrityFindingSchema,
  IntegrityRequiredRepairSchema,
  IntegrityReviewRoundSchema,
  IntegrityReviewerReviewSchema,
  IntegrityReviewSchema,
  IntegrityUnresolvedDisagreementSchema,
  IntegrityUninspectedRiskSchema,
  type IntegrityFinding,
  type IntegrityRequiredRepair,
  type IntegrityReviewerReview,
  type IntegrityReview,
  type IntegrityVerdict,
} from "./team-schema"

const log = Log.create({ service: "integrity-review" })

export type { IntegrityFinding, IntegrityReviewerReview, IntegrityReview, IntegrityVerdict }

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

export type IntegrityPromptRefs = IntegrityFactSelection & { instruction: string }

type ConsensusCollector = {
  checkItems: IntegrityReview["checkItems"]
  reviewers: IntegrityReview["reviewers"]
  coverageAudit: IntegrityReview["coverageAudit"]
  uninspectedRisks: IntegrityReview["uninspectedRisks"]
  findings: IntegrityReview["findings"]
  rounds: IntegrityReview["rounds"]
  requiredRepairs: IntegrityReview["requiredRepairs"]
  unresolvedDisagreements: IntegrityReview["unresolvedDisagreements"]
  fact_check_items: IntegrityReview["fact_check_items"]
  judgment?: z.infer<typeof IntegrityJudgmentSchema>
}

function emptyConsensusCollector(): ConsensusCollector {
  return {
    checkItems: [],
    reviewers: [],
    coverageAudit: [],
    uninspectedRisks: [],
    findings: [],
    rounds: [],
    requiredRepairs: [],
    unresolvedDisagreements: [],
    fact_check_items: [],
  }
}

const IntegrityJudgmentSchema = z
  .object({
    verdict: IntegrityVerdictSchema,
    summary: z.string().min(1),
  })
  .strict()

function snapshotIntegrityReview(
  collector: ConsensusCollector,
  requirements?: readonly ParsedRequirement[],
): {
  review: IntegrityReview
  facts: Omit<ConsensusCollector, "judgment">
  completenessFindings: string[]
} {
  const { judgment, ...facts } = collector
  const parsed = IntegrityReviewSchema.safeParse({
    ...(judgment ?? {}),
    ...facts,
  })
  if (!parsed.success) {
    throw new Error(`Integrity review facts are invalid: ${parsed.error.message}`)
  }
  return {
    review: parsed.data,
    facts,
    completenessFindings: [
      ...(!judgment ? ["Integrity reviewer judgment was not recorded during this turn."] : []),
      ...integrityCheckGraphIssues(parsed.data, requirements ? [...requirements] : undefined),
      ...integrityRequirementCoverageIssues(parsed.data, requirements ? [...requirements] : undefined),
    ],
  }
}

function upsertByID<T extends { id: string }>(items: T[], item: T): "registered" | "overwritten" {
  const existingIdx = items.findIndex((row) => row.id === item.id)
  if (existingIdx >= 0) {
    items[existingIdx] = item
    return "overwritten"
  }
  items.push(item)
  return "registered"
}

function upsertByRoundID(
  items: IntegrityReview["rounds"],
  item: IntegrityReview["rounds"][number],
): "registered" | "overwritten" {
  const existingIdx = items.findIndex((row) => row.roundID === item.roundID)
  if (existingIdx >= 0) {
    items[existingIdx] = item
    return "overwritten"
  }
  items.push(item)
  return "registered"
}

function unknownIntegrityCheckIDIssues(
  knownCheckIDs: ReadonlySet<string>,
  label: string,
  id: string,
  checkIDs: readonly string[],
): string[] {
  if (checkIDs.length === 0) return [`${label} "${id}" has no checkIDs; register a check item and reference it.`]
  const unknown = checkIDs.filter((checkID) => !knownCheckIDs.has(checkID))
  return unknown.length > 0 ? [`${label} "${id}" references unknown checkIDs: ${unknown.join(", ")}.`] : []
}

function integrityUnknownCheckIDIssues(
  report: IntegrityReview,
  label: string,
  id: string,
  checkIDs: readonly string[],
): string[] {
  return unknownIntegrityCheckIDIssues(new Set(report.checkItems.map((item) => item.id)), label, id, checkIDs)
}

function collectorUnknownCheckIDIssues(
  collector: Pick<ConsensusCollector, "checkItems">,
  rows: Array<{ label: string; id: string; checkIDs: readonly string[] }>,
): string[] {
  const known = new Set(collector.checkItems.map((item) => item.id))
  return rows.flatMap((row) => unknownIntegrityCheckIDIssues(known, row.label, row.id, row.checkIDs))
}

function integrityReviewerCheckIDRows(report: IntegrityReviewerReview): Array<{
  label: string
  id: string
  checkIDs: readonly string[]
}> {
  return [
    { label: "reviewer", id: report.reviewerID, checkIDs: report.checkIDs },
    ...report.drilldowns.map((row, index) => ({
      label: `reviewerDrilldown:${report.reviewerID}`,
      id: `${row.target}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.coverage.map((row, index) => ({
      label: `reviewerCoverage:${report.reviewerID}`,
      id: `${row.requirementID ?? row.specID ?? row.userRequestQuote ?? "coverage"}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.evidence.map((row, index) => ({
      label: `reviewerEvidence:${report.reviewerID}`,
      id: `${row.note}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
  ]
}

function addIntegrityEvidenceSupport(
  map: Map<string, Set<string>>,
  checkIDs: readonly string[],
  evidence: string,
): void {
  for (const checkID of checkIDs) {
    const set = map.get(checkID) ?? new Set<string>()
    set.add(evidence)
    map.set(checkID, set)
  }
}

function integrityReviewerEvidenceSupportByCheckID(report: IntegrityReview): Map<string, Set<string>> {
  const support = new Map<string, Set<string>>()
  for (const reviewer of report.reviewers) {
    for (const row of reviewer.evidence) addIntegrityEvidenceSupport(support, row.checkIDs, row.note)
    for (const row of reviewer.coverage) addIntegrityEvidenceSupport(support, row.checkIDs, row.evidence)
    for (const row of reviewer.drilldowns) addIntegrityEvidenceSupport(support, row.checkIDs, row.result)
  }
  return support
}

function integrityCheckEvidenceByID(report: IntegrityReview): Map<string, Set<string>> {
  return new Map(report.checkItems.map((item) => [item.id, new Set(item.evidence)]))
}

function unsupportedIntegrityEvidenceIssues(report: IntegrityReview): string[] {
  const issues: string[] = []
  const reviewerSupport = integrityReviewerEvidenceSupportByCheckID(report)
  for (const item of report.checkItems) {
    const support = reviewerSupport.get(item.id) ?? new Set<string>()
    if (support.size === 0) {
      issues.push(`checkItem "${item.id}" has no reviewer evidence, drilldown, or coverage support row.`)
      continue
    }
    const missing = item.evidence.filter((evidence) => !support.has(evidence))
    if (missing.length > 0) {
      issues.push(`checkItem "${item.id}" evidence is not backed by reviewer support rows: ${missing.join(" | ")}.`)
    }
  }

  const checkEvidence = integrityCheckEvidenceByID(report)
  const linkedEvidenceIssues = (
    label: string,
    id: string,
    checkIDs: readonly string[],
    evidenceItems: readonly string[],
  ): void => {
    const supported = new Set<string>()
    for (const checkID of checkIDs) for (const evidence of checkEvidence.get(checkID) ?? []) supported.add(evidence)
    const missing = evidenceItems.filter((evidence) => !supported.has(evidence))
    if (missing.length > 0) {
      issues.push(
        `${label} "${id}" evidence is not present on its cited checkItems (${checkIDs.join(", ")}): ${missing.join(" | ")}.`,
      )
    }
  }
  for (const finding of report.findings) {
    linkedEvidenceIssues("finding", finding.id, finding.checkIDs, finding.evidence)
  }
  for (const repair of report.requiredRepairs) {
    linkedEvidenceIssues("requiredRepair", repair.id, repair.checkIDs, repair.evidence)
  }
  return issues
}

function integrityCheckGraphIssues(report: IntegrityReview, requirements?: ParsedRequirement[]): string[] {
  const issues: string[] = []
  if (report.checkItems.length === 0) {
    issues.push("IntegrityReview has no registered checkItems; register each inspected requirement/problem first.")
    return issues
  }
  if (report.coverageAudit.length === 0) {
    issues.push("integrity review has no registered coverageAudit rows; the coverage facts are incomplete.")
  }
  for (const reviewer of report.reviewers) {
    if (reviewer.drilldowns.length === 0) {
      issues.push(`reviewer "${reviewer.reviewerID}" has no drilldowns; register row-level inspected evidence.`)
    }
    if (reviewer.coverage.length === 0) {
      issues.push(
        `reviewer "${reviewer.reviewerID}" has no coverage rows; register what requirement, spec, or user promise was covered.`,
      )
    }
    if (reviewer.evidence.length === 0) {
      issues.push(`reviewer "${reviewer.reviewerID}" has no evidence rows; register evidence rows tied to checkIDs.`)
    }
  }
  const checkByID = new Map(report.checkItems.map((item) => [item.id, item]))
  const activeRequirementIDs = (requirements ?? []).map((requirement) => requirement.id)
  for (const requirementID of activeRequirementIDs) {
    const covered = report.checkItems.some((item) => item.requirementIDs.includes(requirementID))
    if (!covered) {
      issues.push(`active requirement ${requirementID} has no registered integrity check item.`)
    }
  }
  const unresolvedCheckIDs = report.checkItems
    .filter((item) => item.status === "failed" || item.status === "inconclusive")
    .map((item) => item.id)
  if (report.verdict === "pass" && unresolvedCheckIDs.length > 0) {
    issues.push(`pass judgment was recorded with failed/inconclusive checkItems: ${unresolvedCheckIDs.join(", ")}.`)
  }
  if (report.verdict === "pass") {
    const nonCoveredReviewerRows = report.reviewers.flatMap((reviewer) =>
      reviewer.coverage
        .filter((row) => row.status !== "covered")
        .map(
          (row) => `${reviewer.reviewerID}:${row.requirementID ?? row.specID ?? row.userRequestQuote ?? "coverage"}`,
        ),
    )
    if (nonCoveredReviewerRows.length > 0) {
      issues.push(
        `pass judgment was recorded with missing/inconclusive reviewer coverage: ${nonCoveredReviewerRows.join(", ")}.`,
      )
    }
    const nonCoveredAuditRows = report.coverageAudit.filter((row) => row.status !== "covered").map((row) => row.promise)
    if (nonCoveredAuditRows.length > 0) {
      issues.push(
        `pass judgment was recorded with missing/inconclusive coverageAudit rows: ${nonCoveredAuditRows.join(", ")}.`,
      )
    }
  }
  const rows: Array<{ label: string; id: string; checkIDs: readonly string[] }> = [
    ...report.reviewers.flatMap((row) => integrityReviewerCheckIDRows(row)),
    ...report.findings.map((row) => ({ label: "finding", id: row.id, checkIDs: row.checkIDs })),
    ...report.requiredRepairs.map((row) => ({ label: "requiredRepair", id: row.id, checkIDs: row.checkIDs })),
    ...report.coverageAudit.map((row, index) => ({
      label: "coverageAudit",
      id: `${row.promise}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.uninspectedRisks.map((row, index) => ({
      label: "uninspectedRisk",
      id: `${row.risk}#${index + 1}`,
      checkIDs: row.checkIDs,
    })),
    ...report.unresolvedDisagreements.map((row) => ({
      label: "unresolvedDisagreement",
      id: row.id,
      checkIDs: row.checkIDs,
    })),
  ]
  for (const row of rows) issues.push(...integrityUnknownCheckIDIssues(report, row.label, row.id, row.checkIDs))
  issues.push(...unsupportedIntegrityEvidenceIssues(report))
  for (const finding of report.findings) {
    if (finding.severity !== "blocking") continue
    const linked = finding.checkIDs.map((checkID) => checkByID.get(checkID)).filter((item) => item !== undefined)
    if (linked.length > 0 && linked.every((item) => item.status === "passed")) {
      issues.push(
        `blocking finding "${finding.id}" references only passed checkItems; blockers require a failed or inconclusive check.`,
      )
    }
  }
  return issues
}

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
export type IntegrityReviewObservation = {
  sessionID: string
  finalMessageID: string
  review: IntegrityReview
  facts: Omit<ConsensusCollector, "judgment">
  completenessFindings: string[]
}

export async function reviewIntegrity(input: {
  instruction: string
  goalIDs: string[]
  attachmentRefs: string[]
  signal?: AbortSignal
  taskID: string
  workScope: import("@/agent/projected-agent-work-scope").ProjectedAgentWorkScope
  parentSessionID?: string
  newSessionID?: string
  existingSessionID?: string
  continuationPrompt?: string
  dispatchTurn?: import("@/orchestrator/dispatch-turn-projection").DispatchTurn
  onSessionCreated?: (sessionID: string) => void | Promise<void>
  onDispatchAuthorityCommit?: import("@/agent/runner").AgentDispatchAuthorityCommit
  onRuntimeReady?: (sessionID: string) => void | Promise<void>
  agentID: string
  packageRevision: PromptProfileResolver.ResolvedPackageRevision
}): Promise<IntegrityReviewObservation | AgentCoordinationHandoffResult> {
  if (!input.agentID?.trim()) throw new Error("reviewIntegrity requires the exact projected agentID.")
  const reviewNumber = 1
  if (input.taskID && !input.parentSessionID) {
    throw new Error(`reviewIntegrity requires parentSessionID for task-backed runs (taskID=${input.taskID}).`)
  }
  const promptRefs: IntegrityPromptRefs = { ...input, artifactLocators: [] }
  const promptProjection = projectIntegrityPromptFacts(promptRefs)
  let activeReviewID: string | undefined
  let activeSessionID: string | undefined
  const currentFactRefs = (): IntegrityPromptRefs => ({
    ...promptRefs,
    artifactLocators: activeSessionID ? completeArtifactReadLocatorsForSession(activeSessionID) : [],
  })
  const currentRequirements = () => projectIntegrityPromptFacts(currentFactRefs()).requirements

  const collector = emptyConsensusCollector()
  const out = await runAgentSession<ConsensusCollector>({
    agentID: input.agentID,
    packageRevision: input.packageRevision,
    workScope: input.workScope,
    sessionTitle: `${input.agentID} (integrity): ${promptProjection.taskTitle}`,
    newSessionID: input.newSessionID,
    existingSessionID: input.existingSessionID,
    continuationPrompt: input.continuationPrompt,
    dispatchTurn: input.dispatchTurn,
    parentSessionID: input.parentSessionID,
    taskID: input.taskID,
    signal: input.signal,
    toolKit: await createSingleSessionIntegrityToolKit({
      agentID: input.agentID,
      collector,
      factRefs: currentFactRefs,
      requirements: currentRequirements,
      signal: input.signal,
    }),
    buildUserPrompt: () => renderSingleSessionIntegrityPrompt(promptProjection),
    stream: createReviewReasoningForwarder({
      taskID: input.taskID,
      reviewID: () => activeReviewID,
      phase: "integrity",
      agentID: input.agentID,
      attempt: () => reviewNumber,
      source: input.agentID,
    }),
    onSessionCreated: async (session) => {
      activeSessionID = session.id
      await input.onSessionCreated?.(session.id)
      activeReviewID = reviewIDForIntegrity(session.id)
      emitReviewStreamStarted({
        taskID: input.taskID,
        reviewID: activeReviewID,
        phase: "integrity",
        sessionID: session.id,
        agentID: input.agentID,
        source: input.agentID,
      })
    },
    onDispatchAuthorityCommit: input.onDispatchAuthorityCommit
      ? (session, descriptor) => input.onDispatchAuthorityCommit!(session.id, descriptor)
      : undefined,
    onRuntimeReady: input.onRuntimeReady ? (session) => input.onRuntimeReady!(session.id) : undefined,
  })
  const coordinationHandoff = agentCoordinationHandoffResult(out)
  if (coordinationHandoff) return coordinationHandoff

  const snapshot = snapshotIntegrityReview(out.collector, currentRequirements())
  const normalized = normalizeIntegrityReview(snapshot.review)
  log.info("integrity team review completed", {
    verdict: normalized?.verdict,
    reviewers: snapshot.facts.reviewers.length,
    findings: snapshot.facts.findings.length,
    requiredRepairs: snapshot.facts.requiredRepairs.length,
    completenessFindings: snapshot.completenessFindings.length,
  })
  return {
    sessionID: out.session.id,
    finalMessageID: out.finalMessage.info.id,
    review: normalized,
    facts: snapshot.facts,
    completenessFindings: snapshot.completenessFindings,
  }
}

async function createSingleSessionIntegrityToolKit(input: {
  agentID: string
  collector: ConsensusCollector
  factRefs?: IntegrityPromptRefs | (() => IntegrityPromptRefs)
  requirements?: readonly ParsedRequirement[] | (() => readonly ParsedRequirement[])
  signal?: AbortSignal
}) {
  const evidenceTools = input.factRefs ? createIntegrityAcceptanceTools(input.factRefs, { signal: input.signal }) : {}
  const previewTools = input.factRefs
    ? await createIntegrityPreviewTools({
        agentID: input.agentID,
        taskID: typeof input.factRefs === "function" ? input.factRefs().taskID : input.factRefs.taskID,
        signal: input.signal,
      })
    : {}
  const outputTools = {
    register_integrity_check_item: tool({
      description:
        "Register one concrete Integrity check item before recording reviewer coverage, findings, repairs, or a current judgment. Every active requirement should be covered by at least one check item; uncovered requirements remain visible as coverage gaps. Re-register the same id with the complete corrected row to overwrite it.",
      inputSchema: IntegrityCheckItemSchema,
      execute: async (raw) => {
        const item = IntegrityCheckItemSchema.parse(raw)
        const status = upsertByID(input.collector.checkItems, item)
        return `OK: integrity checkItem "${item.id}" ${status} (${input.collector.checkItems.length} total)`
      },
    }),
    register_integrity_reviewer_review: tool({
      description:
        "Register one reviewer review tied to registered checkIDs. Do not put findings here; register findings separately with register_integrity_finding. Re-register the same reviewerID with the complete corrected review to overwrite it.",
      inputSchema: IntegrityReviewerReviewSchema,
      execute: async (raw) => {
        const report = IntegrityReviewerReviewSchema.parse(raw)
        const checkIDIssues = collectorUnknownCheckIDIssues(input.collector, integrityReviewerCheckIDRows(report))
        if (checkIDIssues.length > 0) {
          return `Error: integrity reviewer review references unregistered check items: ${checkIDIssues.join("; ")}`
        }
        const existingIdx = input.collector.reviewers.findIndex((row) => row.reviewerID === report.reviewerID)
        if (existingIdx >= 0) {
          input.collector.reviewers[existingIdx] = report
          return `OK: integrity reviewer "${report.reviewerID}" overwritten (${input.collector.reviewers.length} total)`
        }
        input.collector.reviewers.push(report)
        return `OK: integrity reviewer "${report.reviewerID}" registered (${input.collector.reviewers.length} total)`
      },
    }),
    register_integrity_coverage_audit: tool({
      description: "Register one coverage-audit row tied to registered checkIDs.",
      inputSchema: IntegrityCoverageAuditRowSchema,
      execute: async (raw) => {
        const row = IntegrityCoverageAuditRowSchema.parse(raw)
        const checkIDIssues = collectorUnknownCheckIDIssues(input.collector, [
          { label: "coverageAudit", id: row.promise, checkIDs: row.checkIDs },
        ])
        if (checkIDIssues.length > 0) {
          return `Error: integrity coverageAudit row references unregistered check items: ${checkIDIssues.join("; ")}`
        }
        input.collector.coverageAudit.push(row)
        return `OK: integrity coverageAudit row registered (${input.collector.coverageAudit.length} total)`
      },
    }),
    register_integrity_uninspected_risk: tool({
      description: "Register one uninspected risk tied to registered checkIDs.",
      inputSchema: IntegrityUninspectedRiskSchema,
      execute: async (raw) => {
        const row = IntegrityUninspectedRiskSchema.parse(raw)
        const checkIDIssues = collectorUnknownCheckIDIssues(input.collector, [
          { label: "uninspectedRisk", id: row.risk, checkIDs: row.checkIDs },
        ])
        if (checkIDIssues.length > 0) {
          return `Error: integrity uninspectedRisk references unregistered check items: ${checkIDIssues.join("; ")}`
        }
        input.collector.uninspectedRisks.push(row)
        return `OK: integrity uninspectedRisk registered (${input.collector.uninspectedRisks.length} total)`
      },
    }),
    register_integrity_finding: tool({
      description:
        "Register one Integrity finding tied to registered checkIDs. Re-register the same id with the complete corrected finding to overwrite it.",
      inputSchema: IntegrityFindingSchema,
      execute: async (raw) => {
        const finding = IntegrityFindingSchema.parse(raw)
        const checkIDIssues = collectorUnknownCheckIDIssues(input.collector, [
          { label: "finding", id: finding.id, checkIDs: finding.checkIDs },
        ])
        if (checkIDIssues.length > 0) {
          return `Error: integrity finding references unregistered check items: ${checkIDIssues.join("; ")}`
        }
        const status = upsertByID(input.collector.findings, finding)
        return `OK: integrity finding "${finding.id}" ${status} (${input.collector.findings.length} total)`
      },
    }),
    register_integrity_round: tool({
      description:
        "Register one Integrity review round summary. Re-register the same roundID with the complete corrected round to overwrite it.",
      inputSchema: IntegrityReviewRoundSchema,
      execute: async (raw) => {
        const round = IntegrityReviewRoundSchema.parse(raw)
        const status = upsertByRoundID(input.collector.rounds, round)
        return `OK: integrity round "${round.roundID}" ${status} (${input.collector.rounds.length} total)`
      },
    }),
    register_integrity_required_repair: tool({
      description:
        "Register one required repair tied to registered checkIDs and finding IDs. Re-register the same id with the complete corrected repair to overwrite it.",
      inputSchema: IntegrityRequiredRepairSchema,
      execute: async (raw) => {
        const repair = IntegrityRequiredRepairSchema.parse(raw)
        const checkIDIssues = collectorUnknownCheckIDIssues(input.collector, [
          { label: "requiredRepair", id: repair.id, checkIDs: repair.checkIDs },
        ])
        if (checkIDIssues.length > 0) {
          return `Error: integrity requiredRepair references unregistered check items: ${checkIDIssues.join("; ")}`
        }
        const status = upsertByID(input.collector.requiredRepairs, repair)
        return `OK: integrity requiredRepair "${repair.id}" ${status} (${input.collector.requiredRepairs.length} total)`
      },
    }),
    register_integrity_unresolved_disagreement: tool({
      description:
        "Register one unresolved disagreement tied to registered checkIDs. Re-register the same id with the complete corrected disagreement to overwrite it.",
      inputSchema: IntegrityUnresolvedDisagreementSchema,
      execute: async (raw) => {
        const disagreement = IntegrityUnresolvedDisagreementSchema.parse(raw)
        const checkIDIssues = collectorUnknownCheckIDIssues(input.collector, [
          { label: "unresolvedDisagreement", id: disagreement.id, checkIDs: disagreement.checkIDs },
        ])
        if (checkIDIssues.length > 0) {
          return `Error: integrity unresolvedDisagreement references unregistered check items: ${checkIDIssues.join("; ")}`
        }
        const status = upsertByID(input.collector.unresolvedDisagreements, disagreement)
        return `OK: integrity unresolvedDisagreement "${disagreement.id}" ${status} (${input.collector.unresolvedDisagreements.length} total)`
      },
    }),
    register_integrity_fact_check_item: tool({
      description: "Register one factual claim that the projected review could not verify in-session.",
      inputSchema: FactCheckItemSchema,
      execute: async (raw) => {
        const item = FactCheckItemSchema.parse(raw)
        input.collector.fact_check_items.push(item)
        return `OK: integrity fact_check_item registered (${input.collector.fact_check_items.length} total)`
      },
    }),
    update_integrity_judgment: tool({
      description: `Record or revise the reviewer's current verdict and concise summary. Registered checks, findings, coverage, repairs, disagreements, and risks remain valid whether or not this judgment exists. coverageAudit[].status must be exactly one of ${IntegrityCoverageStatusValues.join(", ")}.`,
      inputSchema: IntegrityJudgmentSchema,
      execute: async (raw) => {
        const parsedJudgment = IntegrityJudgmentSchema.safeParse(raw)
        if (!parsedJudgment.success) {
          return `Error: integrity judgment is invalid: ${parsedJudgment.error.message}`
        }
        input.collector.judgment = parsedJudgment.data
        const requirements = typeof input.requirements === "function" ? input.requirements() : input.requirements
        const snapshot = snapshotIntegrityReview(input.collector, requirements)
        const findingText =
          snapshot.completenessFindings.length > 0
            ? ` Completeness findings: ${snapshot.completenessFindings.join("; ")}`
            : ""
        return `RECORDED: integrity reviewer judgment updated with verdict=${parsedJudgment.data.verdict}.${findingText}`
      },
    }),
  }
  const stageOwnedTools = {
    ...evidenceTools,
    ...outputTools,
  }
  return {
    tools: {
      ...evidenceTools,
      ...previewTools,
      ...outputTools,
    },
    stageOwnedToolIDs: Object.keys(stageOwnedTools),
    getCollector: () => input.collector,
  }
}

function integrityRequirementCoverageIssues(
  report: IntegrityReview,
  requirements: readonly ParsedRequirement[] | undefined,
): string[] {
  const knownRequirementIDs = [...new Set((requirements ?? []).map((requirement) => requirement.id).filter(Boolean))]
  if (knownRequirementIDs.length === 0) return []

  const touchedRequirementIDs = new Set<string>()
  for (const reviewer of report.reviewers) {
    for (const row of reviewer.coverage) {
      if (row.requirementID) touchedRequirementIDs.add(row.requirementID)
    }
  }
  for (const finding of report.findings) {
    for (const requirementID of finding.requirementIDs) touchedRequirementIDs.add(requirementID)
  }
  for (const repair of report.requiredRepairs) {
    for (const requirementID of repair.requirementIDs) touchedRequirementIDs.add(requirementID)
  }

  const missing = knownRequirementIDs.filter((requirementID) => !touchedRequirementIDs.has(requirementID))
  if (missing.length === 0) return []
  return [
    `${missing.join(", ")} missing from reviewer coverage rows, findings, and requiredRepairs; the selected persisted requirement facts are incomplete.`,
  ]
}

async function createIntegrityPreviewTools(input: {
  agentID: string
  taskID: string
  signal?: AbortSignal
}): Promise<ToolSet> {
  const toolInfos = await loadIntegrityPreviewToolInfos()
  const entries = await Promise.all(
    toolInfos.map(async (info) => [info.id, await createIntegrityTool(info, input)] as const),
  )
  return Object.fromEntries(entries) as ToolSet
}

async function createIntegrityTool(info: Tool.Info, input: { agentID: string; taskID: string; signal?: AbortSignal }) {
  return createAiSdkToolFromInfo({
    info,
    agent: input.agentID,
    taskID: input.taskID,
    signal: input.signal,
  })
}

export const IntegrityTestHooks = {
  createSingleSessionIntegrityToolKit,
  emptyConsensusCollector,
  normalizeIntegrityReview,
  renderIntegrityEvidencePrompt,
  renderSingleSessionIntegrityPrompt,
}

export function buildSingleSessionIntegrityPrompt(input: IntegrityPromptRefs): string {
  return renderSingleSessionIntegrityPrompt(projectIntegrityPromptFacts(input))
}

function renderSingleSessionIntegrityPrompt(projection: IntegrityPromptProjection): string {
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

function renderIntegrityEvidencePrompt(input: IntegrityPromptProjection): string {
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

function normalizeIntegrityReview(report: IntegrityReview): IntegrityReview {
  const findings = report.findings.map(normalizeManifestFinding)
  const requiredRepairs = report.requiredRepairs.map((repair) => normalizeManifestRepair(repair, findings))
  return {
    ...report,
    findings,
    requiredRepairs,
  }
}

function normalizeManifestFinding(finding: IntegrityFinding): IntegrityFinding {
  const canonicalSymptom = finding.canonicalSymptom
  const fingerprint = integrityFindingFingerprint({ ...finding, canonicalSymptom })
  return {
    ...finding,
    fingerprint,
    canonicalSymptom,
    priorReviewRefs: stableList(finding.priorReviewRefs),
  }
}

function normalizeManifestRepair(
  repair: IntegrityRequiredRepair,
  findings: IntegrityFinding[],
): IntegrityRequiredRepair {
  const findingIDs = new Set(findings.map((finding) => finding.id))
  for (const sourceFindingID of repair.sourceFindingIDs) {
    if (!findingIDs.has(sourceFindingID)) {
      throw new Error(
        `integrity required repair ${repair.id} must reference current finding ${sourceFindingID} by exact id`,
      )
    }
  }
  const canonicalSymptom = repair.canonicalSymptom
  const fingerprint = integrityFindingFingerprint({ ...repair, canonicalSymptom })
  return {
    ...repair,
    fingerprint,
    canonicalSymptom,
    priorReviewRefs: stableList(repair.priorReviewRefs),
  }
}
