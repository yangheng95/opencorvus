import { tool } from "ai"
import z from "zod"
import type { ArtifactReadLocator } from "@opencorvus-ai/plugin/artifact-catalog"
import { FactCheckItemSchema } from "@/fact-check/schema"
import {
  visualQaOpenBlockingFindings,
  visualQaReferenceRegionAuthorityIssues,
  visualReviewConsistencyFindings,
} from "./acceptance-semantics"
import { annotateVisualQaProblemDomRegion } from "./annotated-screenshot"
import {
  assertVisualQaArtifactReadable,
  assertVisualQaEvidence,
  formatVisualQaArtifactLocator,
  visualQaArtifactLocatorKey,
} from "./evidence"
import { parseVisualQaReferenceRegionKey } from "./reference-region-key"
import {
  VISUAL_QA_MULTI_VIEWPORT_ALIGNMENT_CATEGORY,
  VisualQaCheckItemSchema,
  VisualQaCoverageSchema,
  VisualQaEvidenceSchema,
  VisualQaFindingSchema,
  VisualQaProblemDomRegionSchema,
  VisualQaProductionBlockerSchema,
  VisualQaReferenceParitySchema,
  VisualReviewSchema,
  VisualQaUnresolvedCodeModuleProblemSchema,
  type VisualReview,
} from "./schema"

function limitSummary(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim()
  return normalized.length <= 280 ? normalized : normalized.slice(0, 277).trimEnd() + "..."
}

function requireReportString(value: string, label: string): string {
  if (!value.trim()) throw new Error(`${label} is missing`)
  return value.trim()
}

export interface VisualQaOutputToolContext {
  taskID?: string
  projectRoot?: string
  projectID?: string
  referenceParityRequired?: boolean
  requiredReferenceRegions?: string[]
}

export interface VisualQaCollector {
  check_items: VisualReview["check_items"]
  coverage: VisualReview["coverage"]
  findings: VisualReview["findings"]
  production_blockers: VisualReview["production_blockers"]
  unresolved_code_module_problems: VisualReview["unresolved_code_module_problems"]
  problem_dom_regions: VisualReview["problem_dom_regions"]
  evidence: VisualReview["evidence"]
  reference_parity: VisualReview["reference_parity"]
  open_questions: VisualReview["open_questions"]
  fact_check_items: VisualReview["fact_check_items"]
  judgment?: {
    accepted: boolean
    summary: string
  }
}

function emptyCollector(): VisualQaCollector {
  return {
    check_items: [],
    coverage: [],
    findings: [],
    production_blockers: [],
    unresolved_code_module_problems: [],
    problem_dom_regions: [],
    evidence: [],
    reference_parity: {
      required: false,
      required_regions: [],
      reference_comparison_evidence_refs: [],
      missing_regions: [],
      blocker_ids: [],
    },
    open_questions: [],
    fact_check_items: [],
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

function unknownVisualCheckIDs(
  knownCheckIDs: ReadonlySet<string>,
  label: string,
  id: string,
  checkIDs: readonly string[],
): string[] {
  if (checkIDs.length === 0) return [`${label} "${id}" has no check_ids; register a check item and reference it.`]
  const unknown = checkIDs.filter((checkID) => !knownCheckIDs.has(checkID))
  return unknown.length > 0 ? [`${label} "${id}" references unknown check_ids: ${unknown.join(", ")}.`] : []
}

function unknownCheckIDs(report: VisualReview, label: string, id: string, checkIDs: readonly string[]): string[] {
  return unknownVisualCheckIDs(new Set(report.check_items.map((item) => item.id)), label, id, checkIDs)
}

function visualQaEvidenceRefIssues(report: VisualReview): string[] {
  const evidenceByRef = new Map<string, VisualReview["evidence"]>()
  const evidenceRefsByCheckID = new Map<string, Set<string>>()
  for (const row of report.evidence) {
    const key = visualQaArtifactLocatorKey(row.ref)
    const existing = evidenceByRef.get(key) ?? []
    existing.push(row)
    evidenceByRef.set(key, existing)
    for (const checkID of row.check_ids) {
      const refs = evidenceRefsByCheckID.get(checkID) ?? new Set<string>()
      refs.add(key)
      evidenceRefsByCheckID.set(checkID, refs)
    }
  }
  const rows: Array<{
    label: string
    id: string
    refs: readonly ArtifactReadLocator[]
    checkIDs: readonly string[]
  }> = [
    ...report.check_items.map((row) => ({
      label: "check_item",
      id: row.id,
      refs: row.evidence_refs,
      checkIDs: [row.id],
    })),
    ...report.coverage.map((row, index) => ({
      label: "coverage",
      id: `${row.region || "row"}#${index + 1}`,
      refs: row.evidence_refs,
      checkIDs: row.check_ids,
    })),
    ...report.findings.map((row) => ({
      label: "finding",
      id: row.id,
      refs: row.evidence_refs,
      checkIDs: row.check_ids,
    })),
    ...report.production_blockers.map((row) => ({
      label: "production_blocker",
      id: row.id,
      refs: row.evidence_refs,
      checkIDs: row.check_ids,
    })),
    ...report.unresolved_code_module_problems.map((row) => ({
      label: "unresolved_code_module_problem",
      id: row.id,
      refs: row.evidence_refs,
      checkIDs: row.check_ids,
    })),
    ...report.problem_dom_regions.map((row) => ({
      label: "problem_dom_region",
      id: row.id,
      refs: row.evidence_refs,
      checkIDs: row.check_ids,
    })),
    {
      label: "reference_parity",
      id: "reference_comparison_evidence_refs",
      refs: report.reference_parity.reference_comparison_evidence_refs,
      checkIDs: [],
    },
  ]
  const issues: string[] = []
  for (const item of report.check_items) {
    const hasRegisteredEvidenceRow = (evidenceRefsByCheckID.get(item.id)?.size ?? 0) > 0
    if (item.evidence_refs.length === 0 && !hasRegisteredEvidenceRow) {
      issues.push(
        `check_item "${item.id}" has no evidence support; register evidence tied to this check_id or update the check_item with registered evidence_refs.`,
      )
    }
  }
  for (const row of rows) {
    for (const ref of row.refs) {
      const key = visualQaArtifactLocatorKey(ref)
      const display = formatVisualQaArtifactLocator(ref)
      const evidenceRows = evidenceByRef.get(key) ?? []
      if (evidenceRows.length === 0) {
        issues.push(`${row.label} "${row.id}" references unregistered evidence locator: ${display}.`)
        continue
      }
      if (
        row.checkIDs.length > 0 &&
        !evidenceRows.some((evidence) => evidence.check_ids.some((checkID) => row.checkIDs.includes(checkID)))
      ) {
        issues.push(
          `${row.label} "${row.id}" evidence locator ${display} is registered but not tied to its check_ids: ${row.checkIDs.join(", ")}.`,
        )
      }
    }
  }
  return issues
}

async function visualQaLocatorInputIssues(input: {
  taskID?: string
  rows: readonly { label: string; locator: ArtifactReadLocator }[]
}): Promise<string[]> {
  const issues: string[] = []
  const verified = new Set<string>()
  for (const row of input.rows) {
    const key = visualQaArtifactLocatorKey(row.locator)
    if (verified.has(key)) continue
    try {
      await assertVisualQaArtifactReadable({
        taskID: input.taskID,
        locator: row.locator,
        label: row.label,
      })
      verified.add(key)
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      issues.push(`${row.label} locator ${formatVisualQaArtifactLocator(row.locator)} is invalid: ${detail}`)
    }
  }
  return issues
}

function pairedLocatorRows(input: {
  label: string
  sourceRefs?: readonly ArtifactReadLocator[]
  evidenceRefs?: readonly ArtifactReadLocator[]
}): Array<{ label: string; locator: ArtifactReadLocator }> {
  return [
    ...(input.sourceRefs ?? []).map((locator) => ({ label: `${input.label} source`, locator })),
    ...(input.evidenceRefs ?? []).map((locator) => ({ label: `${input.label} evidence`, locator })),
  ]
}

type VisualQaViewport = VisualReview["coverage"][number]["viewports"][number]
type VisualQaEvidence = VisualReview["evidence"][number]

const VISUAL_QA_SCREENSHOT_BEARING_EVIDENCE_TYPES = new Set<VisualQaEvidence["type"]>([
  "screenshot",
  "reference_comparison",
  "visual_diff",
])

function visualQaViewportKey(viewport: VisualQaViewport): string {
  const scale = viewport.device_scale_factor ?? 1
  return `${viewport.width}x${viewport.height}@${scale}`
}

function visualQaViewportKeySet(viewports: readonly VisualQaViewport[]): Set<string> {
  return new Set(viewports.map((viewport) => visualQaViewportKey(viewport)))
}

function collectVisualQaViewportKeys(report: VisualReview): Set<string> {
  const keys = new Set<string>()
  const add = (viewport?: VisualQaViewport): void => {
    if (viewport) keys.add(visualQaViewportKey(viewport))
  }
  for (const item of report.check_items) for (const viewport of item.viewports) add(viewport)
  for (const row of report.coverage) for (const viewport of row.viewports) add(viewport)
  for (const row of report.evidence) add(row.viewport)
  for (const row of report.problem_dom_regions) add(row.viewport)
  return keys
}

function visualQaEvidenceRowsForViewport(input: {
  report: VisualReview
  checkIDs: ReadonlySet<string>
  viewportKey: string
}): VisualQaEvidence[] {
  return input.report.evidence.filter((row) => {
    if (!row.viewport) return false
    if (visualQaViewportKey(row.viewport) !== input.viewportKey) return false
    if (!VISUAL_QA_SCREENSHOT_BEARING_EVIDENCE_TYPES.has(row.type)) return false
    return row.check_ids.some((checkID) => input.checkIDs.has(checkID))
  })
}

function visualQaMultiViewportAlignmentIssues(report: VisualReview): string[] {
  const viewportKeys = collectVisualQaViewportKeys(report)
  if (viewportKeys.size <= 1) return []
  const alignmentChecks = report.check_items.filter(
    (item) => item.category === VISUAL_QA_MULTI_VIEWPORT_ALIGNMENT_CATEGORY,
  )
  if (alignmentChecks.length === 0) {
    return [
      `visual QA report covers ${viewportKeys.size} distinct viewports but has no registered check_item with category=${VISUAL_QA_MULTI_VIEWPORT_ALIGNMENT_CATEGORY}.`,
    ]
  }
  const alignmentCheckIDs = new Set(alignmentChecks.map((item) => item.id))
  const alignmentCheckViewportKeys = visualQaViewportKeySet(alignmentChecks.flatMap((item) => item.viewports))
  const alignmentCheckViewportCount = alignmentCheckViewportKeys.size
  const alignmentCoverageRows = report.coverage.filter(
    (row) =>
      row.check_ids.some((checkID) => alignmentCheckIDs.has(checkID)) &&
      visualQaViewportKeySet(row.viewports).size >= 2,
  )
  const hasAlignmentCoverage = alignmentCoverageRows.length > 0
  const issues: string[] = []
  if (alignmentCheckViewportCount < 2) {
    issues.push(
      `multi-viewport alignment check_item must list at least two distinct viewports when the report covers ${viewportKeys.size}.`,
    )
  }
  if (!hasAlignmentCoverage) {
    issues.push("multi-viewport alignment check_item has no coverage row spanning at least two distinct viewports.")
  }
  const scopedViewportKeys = new Set<string>([
    ...alignmentCheckViewportKeys,
    ...alignmentCoverageRows.flatMap((row) => [...visualQaViewportKeySet(row.viewports)]),
  ])
  for (const viewportKey of [...scopedViewportKeys].sort()) {
    const evidenceRows = visualQaEvidenceRowsForViewport({ report, checkIDs: alignmentCheckIDs, viewportKey })
    if (evidenceRows.length === 0) {
      issues.push(
        `multi-viewport alignment check_item lacks screenshot-bearing evidence for viewport ${viewportKey}; layout-geometry is diagnostic only and cannot satisfy cross-viewport visual acceptance.`,
      )
    }
  }
  return issues
}

async function visualQaToolResultAcceptanceIssues(
  report: VisualReview,
  context: VisualQaOutputToolContext,
): Promise<string[]> {
  const issues: string[] = []
  const readable = new Map<string, Promise<void>>()
  const verifyReadable = (locator: ArtifactReadLocator, label: string): Promise<void> => {
    const key = visualQaArtifactLocatorKey(locator)
    const existing = readable.get(key)
    if (existing) return existing
    const check = assertVisualQaArtifactReadable({
      taskID: context.taskID,
      locator,
      label,
    })
    readable.set(key, check)
    return check
  }
  const allLocatorRows: Array<{ label: string; locator: ArtifactReadLocator }> = [
    ...report.check_items.flatMap((row) => [
      ...row.source_refs.map((locator) => ({ label: `check_item "${row.id}" source`, locator })),
      ...row.evidence_refs.map((locator) => ({ label: `check_item "${row.id}" evidence`, locator })),
    ]),
    ...report.coverage.flatMap((row, index) => [
      ...row.source_refs.map((locator) => ({ label: `coverage "${row.region}#${index + 1}" source`, locator })),
      ...row.evidence_refs.map((locator) => ({
        label: `coverage "${row.region}#${index + 1}" evidence`,
        locator,
      })),
    ]),
    ...report.findings.flatMap((row) => [
      ...row.source_refs.map((locator) => ({ label: `finding "${row.id}" source`, locator })),
      ...row.evidence_refs.map((locator) => ({ label: `finding "${row.id}" evidence`, locator })),
    ]),
    ...report.production_blockers.flatMap((row) => [
      ...row.source_refs.map((locator) => ({ label: `production_blocker "${row.id}" source`, locator })),
      ...row.evidence_refs.map((locator) => ({ label: `production_blocker "${row.id}" evidence`, locator })),
    ]),
    ...report.unresolved_code_module_problems.flatMap((row) =>
      row.evidence_refs.map((locator) => ({
        label: `unresolved_code_module_problem "${row.id}" evidence`,
        locator,
      })),
    ),
    ...report.problem_dom_regions.flatMap((row) => [
      ...row.evidence_refs.map((locator) => ({ label: `problem_dom_region "${row.id}" evidence`, locator })),
      ...row.annotated_evidence_refs.map((locator) => ({
        label: `problem_dom_region "${row.id}" annotated evidence`,
        locator,
      })),
    ]),
    ...report.reference_parity.reference_comparison_evidence_refs.map((locator) => ({
      label: "reference parity comparison evidence",
      locator,
    })),
  ]
  for (const { label, locator } of allLocatorRows) {
    try {
      await verifyReadable(locator, label)
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      issues.push(`${label} locator ${formatVisualQaArtifactLocator(locator)} is invalid: ${detail}`)
    }
  }
  for (const row of report.evidence) {
    try {
      await assertVisualQaEvidence({
        taskID: context.taskID,
        type: row.type,
        locator: row.ref,
        requirePassed: report.accepted === true,
      })
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause)
      issues.push(
        `visual QA ${row.type} evidence locator ${formatVisualQaArtifactLocator(row.ref)} is invalid: ${detail}`,
      )
    }
  }
  return [...new Set(issues)]
}

function visualQaCheckGraphIssues(report: VisualReview, context: VisualQaOutputToolContext): string[] {
  const issues: string[] = []
  if (report.check_items.length === 0) {
    issues.push("visual QA report has no registered check_items; register each inspected region/problem first.")
    return issues
  }
  const checkByID = new Map(report.check_items.map((item) => [item.id, item]))
  const unresolvedCheckIDs = report.check_items
    .filter((item) => item.status === "failed" || item.status === "inconclusive")
    .map((item) => item.id)
  if (report.accepted && unresolvedCheckIDs.length > 0) {
    issues.push(`accepted=true was recorded with failed/inconclusive check_items: ${unresolvedCheckIDs.join(", ")}.`)
  }
  const checkRows: Array<{ label: string; id: string; checkIDs: string[] }> = [
    ...report.coverage.map((row, index) => ({
      label: "coverage",
      id: `${row.region || "row"}#${index + 1}`,
      checkIDs: row.check_ids,
    })),
    ...report.evidence.map((row) => ({
      label: "evidence",
      id: formatVisualQaArtifactLocator(row.ref),
      checkIDs: row.check_ids,
    })),
    ...report.findings.map((row) => ({ label: "finding", id: row.id, checkIDs: row.check_ids })),
    ...report.production_blockers.map((row) => ({
      label: "production_blocker",
      id: row.id,
      checkIDs: row.check_ids,
    })),
    ...report.problem_dom_regions.map((row) => ({
      label: "problem_dom_region",
      id: row.id,
      checkIDs: row.check_ids,
    })),
    ...report.unresolved_code_module_problems.map((row) => ({
      label: "unresolved_code_module_problem",
      id: row.id,
      checkIDs: row.check_ids,
    })),
  ]
  for (const row of checkRows) issues.push(...unknownCheckIDs(report, row.label, row.id, row.checkIDs))
  issues.push(...visualQaEvidenceRefIssues(report))
  for (const blocker of report.production_blockers) {
    const linked = blocker.check_ids.map((checkID) => checkByID.get(checkID)).filter((item) => item !== undefined)
    if (linked.length > 0 && linked.every((item) => item.status === "passed")) {
      issues.push(
        `production_blocker "${blocker.id}" references only passed check_items; blockers require a failed or inconclusive check.`,
      )
    }
  }
  issues.push(...visualQaMultiViewportAlignmentIssues(report))
  const requiredRegions = new Set(context.requiredReferenceRegions ?? [])
  if (context.referenceParityRequired === true) {
    for (const key of requiredRegions) {
      const hasCheck = report.check_items.some((item) => item.reference_region_key === key)
      if (!hasCheck) {
        issues.push(
          `reference parity required region ${key} has no registered check_item with reference_region_key=${key}.`,
        )
      }
    }
  }
  return issues
}

async function summarizeVisualReviewFeedback(
  report: VisualReview,
  context: VisualQaOutputToolContext,
): Promise<{ blockers: string[]; advisories: string[] }> {
  const blockers: string[] = [...visualReviewConsistencyFindings(report), ...visualQaCheckGraphIssues(report, context)]
  blockers.push(...(await visualQaToolResultAcceptanceIssues(report, context)))
  const advisories: string[] = []
  const openBlocking = visualQaOpenBlockingFindings(report)
  if (!report.accepted && report.production_blockers.length === 0 && openBlocking.length === 0) {
    blockers.push("accepted=false was recorded without production_blockers or open critical/major findings.")
  }
  const referenceParityRequired = context.referenceParityRequired === true
  blockers.push(
    ...visualQaReferenceRegionAuthorityIssues(report, referenceParityRequired, context.requiredReferenceRegions ?? []),
  )
  if (referenceParityRequired) {
    const rawReferenceComparisonRefs = report.reference_parity.reference_comparison_evidence_refs
    const requiredRegions = new Set(context.requiredReferenceRegions ?? [])
    const requiredRegionKeys = [...requiredRegions].sort()
    if (report.accepted && requiredRegionKeys.length === 0) {
      blockers.push("accepted=true was recorded for required reference parity without required reference regions.")
    }
    if (report.accepted && rawReferenceComparisonRefs.length === 0) {
      blockers.push(
        "accepted=true was recorded for required reference parity without reference_comparison_evidence_refs.",
      )
    }
    if (report.accepted && report.reference_parity.missing_regions.length > 0) {
      blockers.push(
        `accepted=true was recorded with reference_parity.missing_regions: ${report.reference_parity.missing_regions.join(", ")}.`,
      )
    }
    if (report.accepted && report.reference_parity.blocker_ids.length > 0) {
      blockers.push(
        `accepted=true was recorded with reference_parity.blocker_ids: ${report.reference_parity.blocker_ids.join(", ")}.`,
      )
    }
    if (report.accepted && rawReferenceComparisonRefs.length > 0) {
      const validEvidence: Array<{ regionID?: string; viewportID: string }> = []
      for (const locator of rawReferenceComparisonRefs) {
        try {
          const evidence = await assertVisualQaEvidence({
            taskID: context.taskID,
            type: "reference_comparison",
            locator,
            requirePassed: true,
          })
          if (evidence) validEvidence.push(evidence)
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : String(cause)
          blockers.push(
            `recorded reference comparison locator ${formatVisualQaArtifactLocator(locator)} is invalid: ${detail}`,
          )
        }
      }
      if (validEvidence.length === 0) {
        blockers.push(
          "no recorded reference comparison locator resolved to readable passed reference-comparison evidence.",
        )
      }
      for (const key of requiredRegionKeys) {
        const parsed = parseVisualQaReferenceRegionKey(key)
        if ("issue" in parsed) {
          blockers.push(parsed.issue)
          continue
        }
        const matched = validEvidence.some(
          (evidence) => evidence.regionID === parsed.regionID && evidence.viewportID === parsed.viewportID,
        )
        if (!matched) {
          blockers.push(
            `recorded review lacks readable passed reference-comparison evidence for ${parsed.regionID}@${parsed.viewportID}.`,
          )
        }
      }
    }
    if (!report.accepted && report.reference_parity.blocker_ids.length > 0) {
      const blockerIDs = new Set(report.production_blockers.map((blocker) => blocker.id))
      const unknown = report.reference_parity.blocker_ids.filter((id) => !blockerIDs.has(id))
      if (unknown.length > 0) {
        blockers.push(`reference_parity.blocker_ids references unknown production blockers: ${unknown.join(", ")}.`)
      }
    }
  }
  if (report.unresolved_code_module_problems.length > 0) {
    const blockerIDs = new Set(report.production_blockers.map((blocker) => blocker.id))
    const unknown = report.unresolved_code_module_problems.flatMap((problem) =>
      problem.blocker_ids.filter((id) => !blockerIDs.has(id)),
    )
    if (report.production_blockers.length === 0) {
      blockers.push("unresolved_code_module_problems were recorded without production_blockers.")
    }
    if (unknown.length > 0) {
      blockers.push(
        `unresolved_code_module_problems.blocker_ids references unknown production blockers: ${unknown.join(", ")}.`,
      )
    }
  }
  return { blockers, advisories }
}

function snapshotVisualQaReview(collector: VisualQaCollector): VisualReview {
  return VisualReviewSchema.parse({
    ...(collector.judgment
      ? {
          accepted: collector.judgment.accepted,
          summary: collector.judgment.summary,
        }
      : {}),
    check_items: collector.check_items,
    coverage: collector.coverage,
    findings: collector.findings,
    production_blockers: collector.production_blockers,
    unresolved_code_module_problems: collector.unresolved_code_module_problems,
    problem_dom_regions: collector.problem_dom_regions,
    evidence: collector.evidence,
    reference_parity: collector.reference_parity,
    open_questions: collector.open_questions,
    fact_check_items: collector.fact_check_items,
  })
}

export function createVisualQaOutputTools(context: VisualQaOutputToolContext = {}) {
  let collector = emptyCollector()
  const tools = {
    register_visual_qa_check_item: tool({
      description:
        "Register one concrete Visual QA check item before reporting coverage, evidence, findings, blockers, DOM regions, unresolved code-module problems, or a current acceptance judgment. Initial check registration may leave evidence_refs empty; evidence support comes from registered evidence rows tied to the check ID or from registered evidence_refs on the item. Every review row must reference registered check item IDs.",
      inputSchema: VisualQaCheckItemSchema,
      execute: async (raw) => {
        const item = VisualQaCheckItemSchema.parse(raw)
        const locatorIssues = await visualQaLocatorInputIssues({
          taskID: context.taskID,
          rows: pairedLocatorRows({
            label: `check_item "${item.id}"`,
            sourceRefs: item.source_refs,
            evidenceRefs: item.evidence_refs,
          }),
        })
        if (locatorIssues.length > 0) {
          return `Error: visual QA check_item evidence is invalid: ${locatorIssues.join("; ")}`
        }
        const status = upsertByID(collector.check_items, item)
        return `OK: visual QA check_item "${item.id}" ${status} (${collector.check_items.length} total)`
      },
    }),
    register_visual_qa_coverage: tool({
      description: "Register one Visual QA coverage row tied to registered check_ids.",
      inputSchema: VisualQaCoverageSchema,
      execute: async (raw) => {
        const row = VisualQaCoverageSchema.parse(raw)
        const locatorIssues = await visualQaLocatorInputIssues({
          taskID: context.taskID,
          rows: pairedLocatorRows({
            label: `coverage "${row.region}"`,
            sourceRefs: row.source_refs,
            evidenceRefs: row.evidence_refs,
          }),
        })
        if (locatorIssues.length > 0) {
          return `Error: visual QA coverage evidence is invalid: ${locatorIssues.join("; ")}`
        }
        collector.coverage.push(row)
        return `OK: visual QA coverage "${row.region}" registered (${collector.coverage.length} total)`
      },
    }),
    register_visual_qa_evidence: tool({
      description:
        "Register one fresh Visual QA evidence item tied to registered check_ids. ref must be an exact artifact_read locator from the current Task catalog. Screenshot-bearing evidence must resolve to a matching Browser Preview envelope whose operation, status, resource roles, and resource digests are readable now.",
      inputSchema: VisualQaEvidenceSchema,
      execute: async (raw) => {
        const row = VisualQaEvidenceSchema.parse(raw)
        try {
          await assertVisualQaEvidence({
            taskID: context.taskID,
            type: row.type,
            locator: row.ref,
            requirePassed: false,
          })
        } catch (cause) {
          const detail = cause instanceof Error ? cause.message : String(cause)
          return `Error: visual QA evidence locator ${formatVisualQaArtifactLocator(row.ref)} is invalid: ${detail}`
        }
        collector.evidence.push(row)
        return `OK: visual QA evidence ${formatVisualQaArtifactLocator(row.ref)} registered (${collector.evidence.length} total)`
      },
    }),
    register_visual_qa_finding: tool({
      description: "Register one Visual QA finding tied to registered check_ids.",
      inputSchema: VisualQaFindingSchema,
      execute: async (raw) => {
        const row = VisualQaFindingSchema.parse(raw)
        const locatorIssues = await visualQaLocatorInputIssues({
          taskID: context.taskID,
          rows: pairedLocatorRows({
            label: `finding "${row.id}"`,
            sourceRefs: row.source_refs,
            evidenceRefs: row.evidence_refs,
          }),
        })
        if (locatorIssues.length > 0) {
          return `Error: visual QA finding evidence is invalid: ${locatorIssues.join("; ")}`
        }
        const status = upsertByID(collector.findings, row)
        return `OK: visual QA finding "${row.id}" ${status} (${collector.findings.length} total)`
      },
    }),
    register_visual_qa_production_blocker: tool({
      description:
        "Register one production blocker tied to registered failed or inconclusive check_ids. Do not register blockers without a concrete check item.",
      inputSchema: VisualQaProductionBlockerSchema,
      execute: async (raw) => {
        const row = VisualQaProductionBlockerSchema.parse(raw)
        const locatorIssues = await visualQaLocatorInputIssues({
          taskID: context.taskID,
          rows: pairedLocatorRows({
            label: `production_blocker "${row.id}"`,
            sourceRefs: row.source_refs,
            evidenceRefs: row.evidence_refs,
          }),
        })
        if (locatorIssues.length > 0) {
          return `Error: visual QA production_blocker evidence is invalid: ${locatorIssues.join("; ")}`
        }
        const status = upsertByID(collector.production_blockers, row)
        return `OK: visual QA production_blocker "${row.id}" ${status} (${collector.production_blockers.length} total)`
      },
    }),
    register_visual_qa_problem_dom_region: tool({
      description: "Register one DOM-localized visual problem region tied to registered check_ids and blocker_ids.",
      inputSchema: VisualQaProblemDomRegionSchema,
      execute: async (raw) => {
        const parsed = VisualQaProblemDomRegionSchema.parse(raw)
        const locatorIssues = await visualQaLocatorInputIssues({
          taskID: context.taskID,
          rows: pairedLocatorRows({
            label: `problem_dom_region "${parsed.id}"`,
            evidenceRefs: parsed.evidence_refs,
          }),
        })
        if (locatorIssues.length > 0) {
          return `Error: visual QA problem_dom_region evidence is invalid: ${locatorIssues.join("; ")}`
        }
        const annotation = await annotateVisualQaProblemDomRegion({
          taskID: context.taskID,
          projectRoot: context.projectRoot,
          projectID: context.projectID,
          region: { ...parsed, annotated_evidence_refs: [] },
        })
        if (annotation.error) {
          return `Error: ${annotation.error}${
            annotation.diagnostics.length > 0 ? ` Diagnostics: ${annotation.diagnostics.join("; ")}` : ""
          }`
        }
        const row = {
          ...parsed,
          annotated_evidence_refs: annotation.annotatedEvidenceRefs,
        }
        const status = upsertByID(collector.problem_dom_regions, row)
        const annotationText =
          row.annotated_evidence_refs.length > 0
            ? `; annotated_evidence_refs=${row.annotated_evidence_refs.join(", ")}`
            : annotation.diagnostics.length > 0
              ? `; annotation_diagnostics=${annotation.diagnostics.join("; ")}`
              : ""
        return `OK: visual QA problem_dom_region "${row.id}" ${status} (${collector.problem_dom_regions.length} total)${annotationText}`
      },
    }),
    register_visual_qa_unresolved_code_module_problem: tool({
      description:
        "Register one unresolved code module problem tied to registered check_ids and production blocker IDs.",
      inputSchema: VisualQaUnresolvedCodeModuleProblemSchema,
      execute: async (raw) => {
        const row = VisualQaUnresolvedCodeModuleProblemSchema.parse(raw)
        const locatorIssues = await visualQaLocatorInputIssues({
          taskID: context.taskID,
          rows: pairedLocatorRows({
            label: `unresolved_code_module_problem "${row.id}"`,
            evidenceRefs: row.evidence_refs,
          }),
        })
        if (locatorIssues.length > 0) {
          return `Error: visual QA unresolved_code_module_problem evidence is invalid: ${locatorIssues.join("; ")}`
        }
        const status = upsertByID(collector.unresolved_code_module_problems, row)
        return `OK: visual QA unresolved_code_module_problem "${row.id}" ${status} (${collector.unresolved_code_module_problems.length} total)`
      },
    }),
    register_visual_qa_open_question: tool({
      description: "Register one open question that prevents stronger Visual QA certainty.",
      inputSchema: z.object({ question: z.string().min(1) }).strict(),
      execute: async ({ question }) => {
        collector.open_questions.push(question)
        return `OK: visual QA open question registered (${collector.open_questions.length} total)`
      },
    }),
    register_visual_qa_fact_check_item: tool({
      description: "Register one factual claim that Visual QA could not verify in-session.",
      inputSchema: FactCheckItemSchema,
      execute: async (raw) => {
        const item = FactCheckItemSchema.parse(raw)
        collector.fact_check_items.push(item)
        return `OK: visual QA fact_check_item registered (${collector.fact_check_items.length} total)`
      },
    }),
    set_visual_qa_reference_parity: tool({
      description:
        "Set the Visual QA reference parity summary after registering per-region check items. Required regions must also have check_items with matching reference_region_key.",
      inputSchema: VisualQaReferenceParitySchema,
      execute: async (raw) => {
        const parsed = VisualQaReferenceParitySchema.safeParse(raw)
        if (!parsed.success) {
          return `Error: visual QA reference_parity is invalid: ${parsed.error.message}`
        }
        const canonicalRequired = context.referenceParityRequired === true
        const authorityIssues = visualQaReferenceRegionAuthorityIssues(
          { reference_parity: parsed.data },
          canonicalRequired,
          context.requiredReferenceRegions ?? [],
        )
        if (authorityIssues.length > 0) {
          return `Error: visual QA reference_parity does not match canonical context: ${authorityIssues.join("; ")}`
        }
        for (const locator of parsed.data.reference_comparison_evidence_refs) {
          try {
            await assertVisualQaEvidence({
              taskID: context.taskID,
              type: "reference_comparison",
              locator,
              requirePassed: false,
            })
          } catch (cause) {
            const detail = cause instanceof Error ? cause.message : String(cause)
            return `Error: visual QA reference comparison locator ${formatVisualQaArtifactLocator(locator)} is invalid: ${detail}`
          }
        }
        collector.reference_parity = parsed.data
        return `OK: visual QA reference_parity set (required=${collector.reference_parity.required}, regions=${collector.reference_parity.required_regions.length})`
      },
    }),
    update_visual_qa_judgment: tool({
      description:
        "Record or revise the reviewer's current accepted judgment and concise summary. This is an optional reviewer fact, not a finalizer: registered checks, evidence, findings, blockers, and questions remain valid whether or not a judgment is recorded, and later registrations may refine the review.",
      inputSchema: z.object({ accepted: z.boolean(), summary: z.string().min(1) }).strict(),
      execute: async (judgment) => {
        const report = snapshotVisualQaReview({ ...collector, judgment })
        const checkGraphIssues = visualQaCheckGraphIssues(report, context)
        const feedback = await summarizeVisualReviewFeedback(report, context)
        collector.judgment = judgment
        const blockerText = feedback.blockers.length > 0 ? ` Findings: ${feedback.blockers.join("; ")}` : ""
        const advisoryText = feedback.advisories.length > 0 ? ` Advisories: ${feedback.advisories.join("; ")}` : ""
        const graphText = checkGraphIssues.length > 0 ? ` Graph findings: ${checkGraphIssues.join("; ")}` : ""
        return `RECORDED: reviewer judgment updated (accepted=${judgment.accepted}).${graphText}${blockerText}${advisoryText}`
      },
    }),
  }

  return {
    tools,
    getCollector: () => collector,
    async snapshotReview() {
      const review = snapshotVisualQaReview(collector)
      const feedback = await summarizeVisualReviewFeedback(review, context)
      return {
        review,
        completenessFindings: [
          ...visualReviewConsistencyFindings(review),
          ...visualQaCheckGraphIssues(review, context),
          ...feedback.blockers,
        ],
        advisories: feedback.advisories,
      }
    },
    reset() {
      collector = emptyCollector()
      return collector
    },
  }
}

function compactRecord(input: Record<string, string>, max = 320): string {
  return compactText(
    Object.entries(input)
      .map(([key, value]) => `${key}=${value}`)
      .join(", "),
    max,
  )
}

function compactText(input: string, max: number): string {
  const normalized = input.replace(/\s+/g, " ").trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(0, max - 3)).trimEnd()}...`
}
