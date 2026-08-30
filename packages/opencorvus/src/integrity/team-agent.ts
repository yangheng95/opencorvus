import { tool } from "ai"
import z from "zod"
import { agentCoordinationHandoffResult, runAgentSession, type AgentCoordinationHandoffResult } from "@/agent/runner"
import { createAiSdkToolFromInfo } from "@/tool/ai-sdk-adapter"
import type { Tool } from "@/tool/tool"
import type { AcceptanceSpec } from "@/acceptance/types"
import type { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { FactCheckItemSchema } from "@/fact-check/schema"
import { renderUserRequestSection } from "@/intent/request-prompt"
import type { GoalContractFields } from "@/pipeline/types"
import { createReviewReasoningForwarder, emitReviewStreamStarted, reviewIDForIntegrity } from "@/integrity/review-stream"
import type { ParsedRequirement } from "@/requirements/types"
import { completeArtifactReadLocatorsForSession } from "@/agent/artifact-read-facts"
import { renderPromptSections, withAttachmentPromptSections } from "@/agent/prompt-projection"
import { Log } from "@/util/log"
import { createIntegrityAcceptanceToolFactory } from "./acceptance-tools"
import { materializeExactTool } from "@/agent/exact-tool-factory"
import {
  projectIntegrityPromptFacts,
  type IntegrityFactSelection,
  type IntegrityPromptProjection,
} from "./fact-projection"
import { loadIntegrityPreviewToolInfos } from "./static-tools"
import { integrityFindingFingerprint, stableList } from "./finding-manifest"
import {
  integrityCheckGraphIssues,
  integrityRequirementCoverageIssues,
  integrityReviewerCheckIDRows,
  integrityUnknownCheckIDIssues,
  unknownIntegrityCheckIDIssues,
  normalizeIntegrityReview,
  unsupportedIntegrityEvidenceIssues,
} from "./review-validation"
import { sanitizeIntegrityPromptText } from "./shared-prompt"
import { DispatchAdapterContractRegistry } from "@/agent/dispatch-adapter-contract"
import { createStageToolMaterializerBinding } from "@/agent/stage-tool-materializer"
import { Instance } from "@/project/instance"
import { Filesystem } from "@/util/filesystem"
import {
  buildIntegrityEvidencePrompt,
  buildSingleSessionIntegrityPrompt,
  renderIntegrityEvidencePrompt,
  renderSingleSessionIntegrityPrompt,
  type IntegrityPromptRefs,
} from "./review-prompt"
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
export { buildIntegrityEvidencePrompt, buildSingleSessionIntegrityPrompt, type IntegrityPromptRefs }


export type ConsensusCollector = {
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

function collectorUnknownCheckIDIssues(
  collector: Pick<ConsensusCollector, "checkItems">,
  rows: Array<{ label: string; id: string; checkIDs: readonly string[] }>,
): string[] {
  const known = new Set(collector.checkItems.map((item) => item.id))
  return rows.flatMap((row) => unknownIntegrityCheckIDIssues(known, row.label, row.id, row.checkIDs))
}

export function emptyConsensusCollector(): ConsensusCollector {
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
  let integrityToolKitPromise: ReturnType<typeof createSingleSessionIntegrityToolKit> | undefined
  const loadIntegrityToolKit = () =>
    (integrityToolKitPromise ??= createSingleSessionIntegrityToolKit({
      agentID: input.agentID,
      collector,
      factRefs: currentFactRefs,
      requirements: currentRequirements,
      signal: input.signal,
    }))
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
    toolKit: {
      stageOwnedToolIDs: DispatchAdapterContractRegistry.privateStageToolIDs("integrity"),
      stageMaterializers: {
        run_command: createStageToolMaterializerBinding({
          id: "integrity.run-command",
          input: { taskID: input.taskID, projectDirectory: Filesystem.resolve(Instance.directory) },
        }),
      },
      materializeExact: async (toolID) => (await loadIntegrityToolKit()).materializeExact(toolID),
      getCollector: async () => (await loadIntegrityToolKit()).getCollector(),
    },
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

export async function createSingleSessionIntegrityToolKit(input: {
  agentID: string
  collector: ConsensusCollector
  factRefs?: IntegrityPromptRefs | (() => IntegrityPromptRefs)
  requirements?: readonly ParsedRequirement[] | (() => readonly ParsedRequirement[])
  signal?: AbortSignal
  onToolMaterialized?: (toolID: string) => void
}) {
  const evidenceFactory = input.factRefs
    ? createIntegrityAcceptanceToolFactory(input.factRefs, {
        signal: input.signal,
        onToolMaterialized: input.onToolMaterialized,
      })
    : undefined
  const outputToolFactories = {
    register_integrity_check_item: () => tool({
      description:
        "Register one concrete Integrity check item before recording reviewer coverage, findings, repairs, or a current judgment. Every active requirement should be covered by at least one check item; uncovered requirements remain visible as coverage gaps. Re-register the same id with the complete corrected row to overwrite it.",
      inputSchema: IntegrityCheckItemSchema,
      execute: async (raw) => {
        const item = IntegrityCheckItemSchema.parse(raw)
        const status = upsertByID(input.collector.checkItems, item)
        return `OK: integrity checkItem "${item.id}" ${status} (${input.collector.checkItems.length} total)`
      },
    }),
    register_integrity_reviewer_review: () => tool({
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
    register_integrity_coverage_audit: () => tool({
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
    register_integrity_uninspected_risk: () => tool({
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
    register_integrity_finding: () => tool({
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
    register_integrity_round: () => tool({
      description:
        "Register one Integrity review round summary. Re-register the same roundID with the complete corrected round to overwrite it.",
      inputSchema: IntegrityReviewRoundSchema,
      execute: async (raw) => {
        const round = IntegrityReviewRoundSchema.parse(raw)
        const status = upsertByRoundID(input.collector.rounds, round)
        return `OK: integrity round "${round.roundID}" ${status} (${input.collector.rounds.length} total)`
      },
    }),
    register_integrity_required_repair: () => tool({
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
    register_integrity_unresolved_disagreement: () => tool({
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
    register_integrity_fact_check_item: () => tool({
      description: "Register one factual claim that the projected review could not verify in-session.",
      inputSchema: FactCheckItemSchema,
      execute: async (raw) => {
        const item = FactCheckItemSchema.parse(raw)
        input.collector.fact_check_items.push(item)
        return `OK: integrity fact_check_item registered (${input.collector.fact_check_items.length} total)`
      },
    }),
    update_integrity_judgment: () => tool({
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
  return {
    async materializeExact(toolID: string) {
      const output = materializeExactTool(outputToolFactories, toolID, input.onToolMaterialized)
      if (output) return output
      const evidence = evidenceFactory?.materializeExact(toolID)
      if (evidence) return evidence
      if (input.factRefs) {
        const taskID = typeof input.factRefs === "function" ? input.factRefs().taskID : input.factRefs.taskID
        return materializeIntegrityPreviewToolExact({
          toolID,
          agentID: input.agentID,
          taskID,
          signal: input.signal,
          onToolMaterialized: input.onToolMaterialized,
        })
      }
      return undefined
    },
    stageOwnedToolIDs: DispatchAdapterContractRegistry.privateStageToolIDs("integrity"),
    getCollector: () => input.collector,
  }
}

async function materializeIntegrityPreviewToolExact(input: {
  toolID: string
  agentID: string
  taskID: string
  signal?: AbortSignal
  onToolMaterialized?: (toolID: string) => void
}) {
  const toolInfos = await loadIntegrityPreviewToolInfos()
  const info = toolInfos.find((candidate) => candidate.id === input.toolID)
  if (!info) return undefined
  input.onToolMaterialized?.(input.toolID)
  return createIntegrityTool(info, input)
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
