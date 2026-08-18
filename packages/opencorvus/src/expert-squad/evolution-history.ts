import path from "node:path"
import {
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  EvolutionArtifactSchemas,
  EvolutionCampaignDetailRequestSchema,
  EvolutionCampaignDetailResponseSchema,
  EvolutionCampaignHistoryRecordSchema,
  EvolutionHistoryListQuerySchema,
  EvolutionHistoryListResponseSchema,
  EvolutionInstallableTargetSchema,
  canonicalEvolutionJSON,
  evolutionComparisonContext,
  type EvolutionCampaignDetailResponse,
  type EvolutionCampaignHistoryRecord,
  type EvolutionHistoryListResponse,
} from "@opencorvus-ai/plugin"
import { requireEngineArtifactByLocator } from "@/artifact-catalog"
import {
  EngineArtifactCatalogRevisionTable,
  EngineArtifactTable,
  EngineArtifactVersionTable,
  EngineTaskTable,
} from "@/engine/engine.sql"
import { Instance } from "@/project/instance"
import { Database, and, desc, eq, inArray, isNull, lte, max } from "@/storage/db"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import { ExpertSquadPackageLocations } from "./locations"
import { ExpertSquadRegistry } from "./registry"
import { evolutionMutationConfirmationText } from "./evolution-mutation"

type InstallationScope = "project" | "global"
type Partition = "current" | "historical"
type HistoryQuery = ReturnType<typeof EvolutionHistoryListQuerySchema.parse>
type EngineLocator = ReturnType<typeof EngineArtifactLocatorSchema.parse>
type Envelope = ReturnType<typeof EngineArtifactEnvelopeSchema.parse>
type ArtifactType = keyof typeof EvolutionArtifactSchemas
type Campaign = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/campaign-spec"]["parse"]>
type Candidate = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/candidate-revision"]["parse"]>
type Run = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/run-evidence-bundle"]["parse"]>
type Evaluation = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/evaluation-result"]["parse"]>
type Review = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/integrity-review"]["parse"]>
type Comparison = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/comparison-recommendation"]["parse"]>
type Receipt = ReturnType<(typeof EvolutionArtifactSchemas)["evolution-lab/promotion-receipt"]["parse"]>

export const EvolutionHistoryAuthorityError = NamedError.create(
  "EvolutionHistoryAuthorityError",
  z
    .object({
      code: z.literal("EVOLUTION_HISTORY_FOREIGN_PROJECT"),
      message: z.string().min(1),
      task_id: z.string().min(1),
      expected_project_id: z.string().min(1),
    })
    .strict(),
)

interface CatalogRow {
  artifactID: string
  taskID: string
  sessionID: string
  artifactType: ArtifactType
  payloadSHA256: string
  catalogRevision: number
  timeCreated: number
  timeUpdated: number
  partition: Partition
}

interface FrozenArtifact<T = unknown> {
  row: ReturnType<typeof requireEngineArtifactByLocator>
  catalog: CatalogRow
  envelope: Envelope
  locator: EngineLocator
  payload?: T
  payloadDiagnostic?: string
}

interface FrozenRead {
  artifacts: FrozenArtifact[]
  byExactIdentity: Map<string, FrozenArtifact>
  integrityIssues: Array<{
    code: "UNLINKED_INVALID_ARTIFACT"
    task_id: string
    root_session_id: string
    locator: EngineLocator
    catalog_artifact_type: ArtifactType
    diagnostic: string
  }>
}

interface ComparisonGraph {
  comparison: FrozenArtifact<Comparison>
  runs: FrozenArtifact<Run>[]
  evaluations: FrozenArtifact<Evaluation>[]
  reviews: FrozenArtifact<Review>[]
  graphIssues: unknown[]
}

function diagnostic(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function sameIdentity(left: unknown, right: unknown) {
  return canonicalEvolutionJSON(left) === canonicalEvolutionJSON(right)
}

function sourceIncludes(envelope: Envelope, locator: EngineLocator) {
  return envelope.source_artifact_locators.some((source) => sameIdentity(source, locator))
}

function targetForQuery(query: Pick<HistoryQuery, "namespace" | "id" | "installationScope">) {
  return EvolutionInstallableTargetSchema.parse(
    query.installationScope === "project"
      ? {
          scope: "project",
          project_id: Instance.project.id,
          project_directory: Instance.project.worktree,
          namespace: query.namespace,
          id: query.id,
        }
      : {
          scope: "global",
          project_id: null,
          project_directory: null,
          namespace: query.namespace,
          id: query.id,
        },
  )
}

async function installedRevision(query: Pick<HistoryQuery, "namespace" | "id" | "installationScope">) {
  const location = ExpertSquadPackageLocations.resolve(query.installationScope, Instance.project.worktree)
  const root = path.join(location.packagesRoot, query.namespace, query.id)
  const loaded = await ExpertSquadRegistry.loadPackage(root)
  if (loaded.namespace !== query.namespace || loaded.id !== query.id || !loaded.version)
    throw new Error("Evolution history target must equal one exact installed versioned package")
  return {
    namespace: loaded.namespace,
    id: loaded.id,
    version: loaded.version,
    package_digest: loaded.packageDigest,
  }
}

async function authority(query: HistoryQuery) {
  return {
    project_id: Instance.project.id,
    project_directory: Instance.project.worktree,
    target: targetForQuery(query),
    installed_revision: await installedRevision(query),
  }
}

function catalogLocator(row: CatalogRow) {
  return EngineArtifactLocatorSchema.parse({
    source: "engine_artifact",
    artifact_id: row.artifactID,
    catalog_revision: row.catalogRevision,
    expected_sha256: row.payloadSHA256,
  })
}

function exactKey(taskID: string, locator: EngineLocator) {
  return `${taskID}\n${canonicalEvolutionJSON(locator)}`
}

function artifactIdentity(artifact: FrozenArtifact) {
  return {
    task_id: artifact.catalog.taskID,
    root_session_id: artifact.catalog.sessionID,
    locator: artifact.locator,
    artifact_type: artifact.envelope.artifact_type,
    schema_version: 1 as const,
    producer: artifact.envelope.producer,
    time_created: artifact.row.time_created,
    time_updated: artifact.row.time_updated,
    partition: artifact.catalog.partition,
  }
}

function requireEvolutionProducer(envelope: Envelope) {
  if (envelope.artifact_type === "evolution-lab/promotion-receipt") {
    if (envelope.producer.owner_kind !== "core" || envelope.producer.component_id !== "expert-squad-package-manager")
      throw new Error("Evolution history receipt must be produced by the Core package manager")
    return
  }
  if (
    (envelope.producer.owner_kind !== "projected-scheduler" && envelope.producer.owner_kind !== "projected-worker") ||
    envelope.producer.expert_squad_id !== "evolution-lab"
  )
    throw new Error(`Evolution history Artifact ${envelope.artifact_type} must be produced by Evolution Lab`)
}

function currentRows(db: Database.TxOrDb, revisionUpper: number): CatalogRow[] {
  return db
    .select({
      artifactID: EngineArtifactTable.id,
      taskID: EngineArtifactTable.task_id,
      sessionID: EngineTaskTable.session_id,
      artifactType: EngineArtifactTable.catalog_artifact_type,
      payloadSHA256: EngineArtifactTable.payload_sha256,
      catalogRevision: EngineArtifactTable.catalog_revision,
      timeCreated: EngineArtifactTable.time_created,
      timeUpdated: EngineArtifactTable.time_updated,
    })
    .from(EngineArtifactTable)
    .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactTable.task_id))
    .where(
      and(
        eq(EngineTaskTable.project_id, Instance.project.id),
        eq(EngineArtifactTable.kind, "expert_output"),
        inArray(EngineArtifactTable.catalog_artifact_type, Object.keys(EvolutionArtifactSchemas)),
        isNull(EngineArtifactTable.catalog_import_source_task_id),
        lte(EngineArtifactTable.catalog_revision, revisionUpper),
      ),
    )
    .orderBy(desc(EngineArtifactTable.catalog_revision))
    .all()
    .map((row) => {
      if (!row.sessionID || !row.artifactType) throw new Error("Evolution history Artifact requires exact Task Session and type")
      return {
        ...row,
        sessionID: row.sessionID,
        artifactType: row.artifactType as ArtifactType,
        partition: "current" as const,
      }
    })
}

function historicalRows(db: Database.TxOrDb, revisionUpper: number): CatalogRow[] {
  return db
    .select({
      artifactID: EngineArtifactVersionTable.artifact_id,
      taskID: EngineArtifactVersionTable.task_id,
      sessionID: EngineTaskTable.session_id,
      artifactType: EngineArtifactVersionTable.catalog_artifact_type,
      payloadSHA256: EngineArtifactVersionTable.payload_sha256,
      catalogRevision: EngineArtifactVersionTable.catalog_revision,
      timeCreated: EngineArtifactVersionTable.time_created,
      timeUpdated: EngineArtifactVersionTable.time_updated,
    })
    .from(EngineArtifactVersionTable)
    .innerJoin(EngineTaskTable, eq(EngineTaskTable.id, EngineArtifactVersionTable.task_id))
    .where(
      and(
        eq(EngineTaskTable.project_id, Instance.project.id),
        eq(EngineArtifactVersionTable.kind, "expert_output"),
        inArray(EngineArtifactVersionTable.catalog_artifact_type, Object.keys(EvolutionArtifactSchemas)),
        isNull(EngineArtifactVersionTable.catalog_import_source_task_id),
        lte(EngineArtifactVersionTable.catalog_revision, revisionUpper),
      ),
    )
    .orderBy(desc(EngineArtifactVersionTable.catalog_revision))
    .all()
    .map((row) => {
      if (!row.sessionID || !row.artifactType) throw new Error("Evolution history Artifact requires exact Task Session and type")
      return {
        ...row,
        sessionID: row.sessionID,
        artifactType: row.artifactType as ArtifactType,
        partition: "historical" as const,
      }
    })
}

function frozenRead(db: Database.TxOrDb, revisionUpper: number): FrozenRead {
  const rows = [...currentRows(db, revisionUpper), ...historicalRows(db, revisionUpper)].toSorted(
    (left, right) => right.catalogRevision - left.catalogRevision,
  )
  const artifacts: FrozenArtifact[] = []
  const integrityIssues: FrozenRead["integrityIssues"] = []
  for (const catalog of rows) {
    const locator = catalogLocator(catalog)
    const row = requireEngineArtifactByLocator({ db, taskID: catalog.taskID, locator })
    try {
      const envelope = EngineArtifactEnvelopeSchema.parse(row.payload)
      if (envelope.schema_version !== 1 || envelope.artifact_type !== catalog.artifactType)
        throw new Error("Envelope identity differs from the exact Catalog Artifact identity")
      requireEvolutionProducer(envelope)
      const parsed = EvolutionArtifactSchemas[catalog.artifactType].safeParse(envelope.payload)
      artifacts.push({
        row,
        catalog,
        envelope,
        locator,
        ...(parsed.success ? { payload: parsed.data } : { payloadDiagnostic: parsed.error.message }),
      })
    } catch (error) {
      integrityIssues.push({
        code: "UNLINKED_INVALID_ARTIFACT",
        task_id: catalog.taskID,
        root_session_id: catalog.sessionID,
        locator,
        catalog_artifact_type: catalog.artifactType,
        diagnostic: diagnostic(error),
      })
    }
  }
  return {
    artifacts,
    byExactIdentity: new Map(artifacts.map((artifact) => [exactKey(artifact.catalog.taskID, artifact.locator), artifact])),
    integrityIssues,
  }
}

function typedArtifact<T>(artifact: FrozenArtifact, type: ArtifactType): FrozenArtifact<T> | undefined {
  return artifact.envelope.artifact_type === type && artifact.payload !== undefined
    ? (artifact as FrozenArtifact<T>)
    : undefined
}

function invalidPayloadIssue(artifact: FrozenArtifact) {
  return {
    code: "INVALID_ARTIFACT_PAYLOAD" as const,
    artifact: artifactIdentity(artifact),
    diagnostic: artifact.payloadDiagnostic ?? "Artifact payload is unavailable",
  }
}

function directArtifacts(read: FrozenRead, owner: FrozenArtifact) {
  const artifacts: FrozenArtifact[] = []
  const issues: unknown[] = []
  for (const source of owner.envelope.source_artifact_locators) {
    const locator = EngineArtifactLocatorSchema.safeParse(source)
    if (!locator.success) continue
    const artifact = read.byExactIdentity.get(exactKey(owner.catalog.taskID, locator.data))
    if (artifact) artifacts.push(artifact)
    else
      issues.push({
        code: "MISSING_EXACT_SOURCE" as const,
        owner: artifactIdentity(owner),
        missing_locator: locator.data,
      })
  }
  return { artifacts, issues }
}

function receiptsForComparison(input: {
  comparison: FrozenArtifact<Comparison>
  campaign: FrozenArtifact<Campaign>
  candidate: FrozenArtifact<Candidate>
  receipts: FrozenArtifact<Receipt>[]
}) {
  const selected = new Map<string, FrozenArtifact<Receipt>>()
  const issues: unknown[] = []
  const requiredPromotionEvidence = [input.campaign.locator, input.candidate.locator, input.comparison.locator]
  const reachable = new Set([canonicalEvolutionJSON(input.comparison.locator)])
  let changed = true
  while (changed) {
    changed = false
    for (const artifact of input.receipts) {
      if (artifact.catalog.taskID !== input.comparison.catalog.taskID) continue
      const receipt = artifact.payload!
      const key = canonicalEvolutionJSON(artifact.locator)
      if (selected.has(key) || !receipt.evidence.some((locator) => reachable.has(canonicalEvolutionJSON(locator)))) continue
      const validEvidence =
        receipt.operation === "promotion"
          ? sameIdentity(
              receipt.evidence.map((locator) => canonicalEvolutionJSON(locator)).toSorted(),
              requiredPromotionEvidence.map((locator) => canonicalEvolutionJSON(locator)).toSorted(),
            )
          : receipt.evidence.length === 1 && reachable.has(canonicalEvolutionJSON(receipt.evidence[0]))
      if (!validEvidence) {
        issues.push({
          code: "RECEIPT_EVIDENCE_MISMATCH" as const,
          receipt: artifactIdentity(artifact),
          evidence: receipt.evidence,
          diagnostic: "Mutation receipt evidence does not equal the exact promotion or restoration predecessor set",
        })
        continue
      }
      selected.set(key, artifact)
      reachable.add(key)
      changed = true
    }
  }
  return {
    receipts: [...selected.values()].toSorted((left, right) => left.row.time_created - right.row.time_created),
    issues,
  }
}

function comparisonGraph(read: FrozenRead, comparison: FrozenArtifact<Comparison>): ComparisonGraph {
  const direct = directArtifacts(read, comparison)
  const runs: FrozenArtifact<Run>[] = []
  const evaluations: FrozenArtifact<Evaluation>[] = []
  const reviews: FrozenArtifact<Review>[] = []
  const graphIssues = [...direct.issues]
  for (const artifact of direct.artifacts) {
    if (artifact.envelope.artifact_type === "evolution-lab/run-evidence-bundle") {
      const run = typedArtifact<Run>(artifact, "evolution-lab/run-evidence-bundle")
      if (run) runs.push(run)
      else graphIssues.push(invalidPayloadIssue(artifact))
    }
    if (artifact.envelope.artifact_type === "evolution-lab/evaluation-result") {
      const evaluation = typedArtifact<Evaluation>(artifact, "evolution-lab/evaluation-result")
      if (evaluation) evaluations.push(evaluation)
      else graphIssues.push(invalidPayloadIssue(artifact))
    }
    if (artifact.envelope.artifact_type === "evolution-lab/integrity-review") {
      const review = typedArtifact<Review>(artifact, "evolution-lab/integrity-review")
      if (review) reviews.push(review)
      else graphIssues.push(invalidPayloadIssue(artifact))
    }
  }
  return { comparison, runs, evaluations, reviews, graphIssues }
}

function completeness(campaign: Campaign, graph: ComparisonGraph) {
  const expectedSlots = campaign.cases.length * campaign.repetitions * 2
  const scorerResults = graph.evaluations.flatMap((evaluation) => evaluation.payload!.scorers)
  return {
    expected_slots: expectedSlots,
    present_runs: graph.runs.length,
    present_evaluations: graph.evaluations.length,
    expected_scorer_results: expectedSlots * campaign.scorers.length,
    measured_scorer_results: scorerResults.filter((scorer) => scorer.status === "measured").length,
    unavailable_scorer_results: scorerResults.filter((scorer) => scorer.status === "unavailable").length,
    reviewed_integrity_slots: graph.reviews.filter((review) => review.payload!.status === "reviewed").length,
    required_unavailable_dimensions: graph.comparison.payload!.required_unavailable_dimensions,
  }
}

function buildComparison(input: {
  graph: ComparisonGraph
  campaign: FrozenArtifact<Campaign>
  candidate: FrozenArtifact<Candidate>
  receipts: FrozenArtifact<Receipt>[]
  installedDigest: string
  target: ReturnType<typeof EvolutionInstallableTargetSchema.parse>
}) {
  const comparison = input.graph.comparison.payload!
  const candidate = input.candidate.payload!
  const campaign = input.campaign.payload!
  const graphIssues = [...input.graph.graphIssues]
  if (
    !sameIdentity(campaign.baseline_revision, comparison.baseline_revision) ||
    !sameIdentity(candidate.parent_revision, comparison.baseline_revision) ||
    !sameIdentity(candidate.candidate_revision, comparison.candidate_revision)
  )
    graphIssues.push({
      code: "REVISION_IDENTITY_MISMATCH" as const,
      owner: artifactIdentity(input.graph.comparison),
      related_locators: [input.campaign.locator, input.candidate.locator],
      diagnostic: "Comparison baseline/candidate identities differ from its exact Campaign and Candidate sources",
    })
  const receiptGraph = receiptsForComparison({
    comparison: input.graph.comparison,
    campaign: input.campaign,
    candidate: input.candidate,
    receipts: input.receipts,
  })
  graphIssues.push(...receiptGraph.issues)
  const promotionReady =
    graphIssues.length === 0 &&
    input.installedDigest === campaign.baseline_revision.package_digest &&
    comparison.recommendation === "promote" &&
    comparison.required_unavailable_dimensions.length === 0
  const evidence = [input.campaign.locator, input.candidate.locator, input.graph.comparison.locator]
  const promotionIntent = promotionReady
    ? {
        operation: "promotion" as const,
        confirmation_text: evolutionMutationConfirmationText({
          projectID: Instance.project.id,
          target: input.target,
          beforeDigest: campaign.baseline_revision.package_digest,
          afterDigest: candidate.candidate_revision.package_digest,
          evidenceSHA256s: evidence.map((locator) => locator.expected_sha256),
          operation: "promotion",
        }),
        request: {
          operation: "promotion" as const,
          campaignSpecLocator: input.campaign.locator,
          candidateRevisionLocator: input.candidate.locator,
          comparisonResultLocator: input.graph.comparison.locator,
          expectedCurrentPackageDigest: campaign.baseline_revision.package_digest,
        },
      }
    : null
  const restorationIntents = receiptGraph.receipts.flatMap((artifact) => {
    const receipt = artifact.payload!
    return receipt.after_digest === input.installedDigest && sameIdentity(receipt.target, input.target)
      ? [
          {
            operation: "restoration" as const,
            confirmation_text: evolutionMutationConfirmationText({
              projectID: Instance.project.id,
              target: input.target,
              beforeDigest: receipt.after_digest,
              afterDigest: receipt.before_digest,
              evidenceSHA256s: [artifact.locator.expected_sha256],
              operation: "restoration",
            }),
            request: {
              operation: "restoration" as const,
              priorReceiptLocator: artifact.locator,
              restorePackageDigest: receipt.before_digest,
              expectedCurrentPackageDigest: receipt.after_digest,
            },
          },
        ]
      : []
  })
  return {
    artifact: artifactIdentity(input.graph.comparison),
    baseline_revision: comparison.baseline_revision,
    candidate_revision: comparison.candidate_revision,
    paired_deltas: comparison.paired_deltas,
    cost_delta: comparison.cost_delta,
    token_delta: comparison.token_delta,
    activity_duration_ms_delta: comparison.activity_duration_ms_delta,
    outcome_rates: comparison.outcome_rates,
    aggregate_score: comparison.aggregate_score,
    regressions: comparison.regressions,
    unavailable_dimensions: comparison.unavailable_dimensions,
    required_unavailable_dimensions: comparison.required_unavailable_dimensions,
    unknowns: comparison.unknowns,
    visual_review: comparison.visual_review,
    reward_hacking_review: comparison.reward_hacking_review,
    confidence: comparison.confidence,
    recommendation: comparison.recommendation,
    completeness: completeness(campaign, input.graph),
    receipts: receiptGraph.receipts.map((artifact) => ({ artifact: artifactIdentity(artifact), receipt: artifact.payload! })),
    promotion_intent: promotionIntent,
    restoration_intents: restorationIntents,
    graph_issues: graphIssues,
  }
}

function buildCampaignRecord(input: {
  read: FrozenRead
  campaign: FrozenArtifact<Campaign>
  receipts: FrozenArtifact<Receipt>[]
  installedDigest: string
  target: ReturnType<typeof EvolutionInstallableTargetSchema.parse>
}): EvolutionCampaignHistoryRecord {
  const campaign = input.campaign.payload!
  const campaignIssues: unknown[] = []
  const candidateArtifacts = input.read.artifacts.filter(
    (artifact) =>
      artifact.catalog.taskID === input.campaign.catalog.taskID &&
      artifact.envelope.artifact_type === "evolution-lab/candidate-revision" &&
      sourceIncludes(artifact.envelope, input.campaign.locator),
  )
  const candidates = candidateArtifacts.flatMap((artifact) => {
    const candidate = typedArtifact<Candidate>(artifact, "evolution-lab/candidate-revision")
    if (!candidate) {
      campaignIssues.push(invalidPayloadIssue(artifact))
      return []
    }
    const candidateIssues: unknown[] = []
    if (
      !sameIdentity(candidate.payload!.development_campaign_locator, input.campaign.locator) ||
      !sameIdentity(candidate.payload!.parent_revision, campaign.baseline_revision)
    )
      candidateIssues.push({
        code: "REVISION_IDENTITY_MISMATCH" as const,
        owner: artifactIdentity(candidate),
        related_locators: [input.campaign.locator],
        diagnostic: "Candidate development Campaign or parent revision differs from its exact Campaign source",
      })
    const related = input.read.artifacts.filter(
      (relatedArtifact) =>
        relatedArtifact.catalog.taskID === candidate.catalog.taskID &&
        sourceIncludes(relatedArtifact.envelope, input.campaign.locator) &&
        sourceIncludes(relatedArtifact.envelope, candidate.locator),
    )
    const runArtifacts = related.flatMap((item) => {
      const value = typedArtifact<Run>(item, "evolution-lab/run-evidence-bundle")
      if (!value && item.envelope.artifact_type === "evolution-lab/run-evidence-bundle")
        candidateIssues.push(invalidPayloadIssue(item))
      return value ? [value] : []
    })
    const evaluationArtifacts = related.flatMap((item) => {
      const value = typedArtifact<Evaluation>(item, "evolution-lab/evaluation-result")
      if (!value && item.envelope.artifact_type === "evolution-lab/evaluation-result")
        candidateIssues.push(invalidPayloadIssue(item))
      return value ? [value] : []
    })
    const comparisonArtifacts = related.flatMap((item) => {
      const value = typedArtifact<Comparison>(item, "evolution-lab/comparison-recommendation")
      if (!value && item.envelope.artifact_type === "evolution-lab/comparison-recommendation")
        candidateIssues.push(invalidPayloadIssue(item))
      return value ? [value] : []
    })
    const relatedArtifacts = related.filter(
      (item) =>
        item.payload !== undefined &&
        item.envelope.artifact_type !== "evolution-lab/run-evidence-bundle" &&
        item.envelope.artifact_type !== "evolution-lab/evaluation-result" &&
        item.envelope.artifact_type !== "evolution-lab/integrity-review" &&
        item.envelope.artifact_type !== "evolution-lab/comparison-recommendation",
    )
    return [
      {
        artifact: artifactIdentity(candidate),
        parent_revision: candidate.payload!.parent_revision,
        candidate_revision: candidate.payload!.candidate_revision,
        hypothesis: candidate.payload!.hypothesis,
        changed_paths: candidate.payload!.changed_paths,
        diff_sha256: candidate.payload!.diff_sha256,
        comparisons: comparisonArtifacts.map((comparison) =>
          buildComparison({
            graph: comparisonGraph(input.read, comparison),
            campaign: input.campaign,
            candidate,
            receipts: input.receipts,
            installedDigest: input.installedDigest,
            target: input.target,
          }),
        ),
        runs: runArtifacts.map(artifactIdentity),
        evaluations: evaluationArtifacts.map(artifactIdentity),
        related_artifacts: relatedArtifacts.map(artifactIdentity),
        graph_issues: candidateIssues,
      },
    ]
  })
  const campaignDirect = directArtifacts(input.read, input.campaign)
  campaignIssues.push(...campaignDirect.issues)
  const relatedArtifacts = campaignDirect.artifacts.filter(
    (artifact) =>
      artifact.payload !== undefined &&
      artifact.envelope.artifact_type !== "evolution-lab/candidate-revision",
  )
  return EvolutionCampaignHistoryRecordSchema.parse({
    campaign: {
      artifact: artifactIdentity(input.campaign),
      target: campaign.target,
      baseline_revision: campaign.baseline_revision,
      candidate_hypothesis: campaign.candidate_hypothesis,
      trial_execution: campaign.trial_execution,
    },
    context: evolutionComparisonContext(campaign),
    related_artifacts: relatedArtifacts.map(artifactIdentity),
    candidates,
    graph_issues: campaignIssues,
  })
}

function currentCatalogRevision(db: Database.TxOrDb) {
  return db.select({ revision: max(EngineArtifactCatalogRevisionTable.revision) }).from(EngineArtifactCatalogRevisionTable).get()
    ?.revision ?? 0
}

function receiptArtifacts(read: FrozenRead) {
  return read.artifacts.flatMap((artifact) => {
    const receipt = typedArtifact<Receipt>(artifact, "evolution-lab/promotion-receipt")
    return receipt ? [receipt] : []
  })
}

function campaignArtifacts(read: FrozenRead, target: ReturnType<typeof EvolutionInstallableTargetSchema.parse>) {
  return read.artifacts.flatMap((artifact) => {
    const campaign = typedArtifact<Campaign>(artifact, "evolution-lab/campaign-spec")
    return campaign && sameIdentity(campaign.payload!.target, target) ? [campaign] : []
  })
}

function integrityIssuesForTarget(
  read: FrozenRead,
  target: ReturnType<typeof EvolutionInstallableTargetSchema.parse>,
) {
  const campaigns = campaignArtifacts(read, target)
  const campaignKeys = new Set(campaigns.map((campaign) => exactKey(campaign.catalog.taskID, campaign.locator)))
  const reachable = new Set(campaignKeys)
  const comparisons: Array<{
    campaign: FrozenArtifact<Campaign>
    candidate: FrozenArtifact<Candidate>
    comparison: FrozenArtifact<Comparison>
  }> = []
  for (const campaign of campaigns) {
    for (const artifact of directArtifacts(read, campaign).artifacts) {
      reachable.add(exactKey(artifact.catalog.taskID, artifact.locator))
    }
    for (const artifact of read.artifacts) {
      if (artifact.catalog.taskID !== campaign.catalog.taskID) continue
      const candidate = typedArtifact<Candidate>(artifact, "evolution-lab/candidate-revision")
      if (
        !candidate ||
        !sameIdentity(candidate.payload!.development_campaign_locator, campaign.locator) ||
        !sourceIncludes(candidate.envelope, campaign.locator)
      )
        continue
      reachable.add(exactKey(candidate.catalog.taskID, candidate.locator))
      for (const related of read.artifacts) {
        if (
          related.catalog.taskID !== campaign.catalog.taskID ||
          !sourceIncludes(related.envelope, campaign.locator) ||
          !sourceIncludes(related.envelope, candidate.locator)
        )
          continue
        reachable.add(exactKey(related.catalog.taskID, related.locator))
        const comparison = typedArtifact<Comparison>(related, "evolution-lab/comparison-recommendation")
        if (comparison) comparisons.push({ campaign, candidate, comparison })
      }
    }
  }
  const reachableEvaluations = read.artifacts.flatMap((artifact) =>
    reachable.has(exactKey(artifact.catalog.taskID, artifact.locator)) &&
    artifact.envelope.artifact_type === "evolution-lab/evaluation-result"
      ? [artifact.locator]
      : [],
  )
  for (const artifact of read.artifacts) {
    const review = typedArtifact<Review>(artifact, "evolution-lab/integrity-review")
    if (
      review &&
      reachableEvaluations.some((locator) => sameIdentity(review.payload!.evaluation_result_locator, locator))
    )
      reachable.add(exactKey(artifact.catalog.taskID, artifact.locator))
  }
  const receipts = receiptArtifacts(read)
  for (const comparison of comparisons) {
    for (const receipt of receiptsForComparison({ ...comparison, receipts }).receipts) {
      reachable.add(exactKey(receipt.catalog.taskID, receipt.locator))
    }
  }
  const targetCampaignLocators = campaigns.map((campaign) => campaign.locator)
  const candidateTargetsCampaign = (candidate: FrozenArtifact<Candidate>) =>
    campaigns.some(
      (campaign) =>
        campaign.catalog.taskID === candidate.catalog.taskID &&
        sameIdentity(candidate.payload!.development_campaign_locator, campaign.locator),
    )
  const targetCandidates = read.artifacts.flatMap((artifact) => {
    const candidate = typedArtifact<Candidate>(artifact, "evolution-lab/candidate-revision")
    return candidate && candidateTargetsCampaign(candidate) ? [candidate] : []
  })
  const targetEvaluationLocators = read.artifacts.flatMap((artifact) => {
    const evaluation = typedArtifact<Evaluation>(artifact, "evolution-lab/evaluation-result")
    return evaluation &&
      targetCampaignLocators.some((locator) => sameIdentity(evaluation.payload!.campaign_spec_locator, locator))
      ? [evaluation.locator]
      : []
  })
  const targetRelevant = (artifact: FrozenArtifact) => {
    const candidate = typedArtifact<Candidate>(artifact, "evolution-lab/candidate-revision")
    if (candidate) return candidateTargetsCampaign(candidate)
    const comparison = typedArtifact<Comparison>(artifact, "evolution-lab/comparison-recommendation")
    if (comparison)
      return (
        campaigns.some(
          (campaign) =>
            campaign.catalog.taskID === comparison.catalog.taskID && sourceIncludes(comparison.envelope, campaign.locator),
        ) ||
        targetCandidates.some(
          (candidateArtifact) =>
            candidateArtifact.catalog.taskID === comparison.catalog.taskID &&
            sourceIncludes(comparison.envelope, candidateArtifact.locator),
        )
      )
    const receipt = typedArtifact<Receipt>(artifact, "evolution-lab/promotion-receipt")
    if (receipt) return sameIdentity(receipt.payload!.target, target)
    const evaluation = typedArtifact<Evaluation>(artifact, "evolution-lab/evaluation-result")
    if (evaluation)
      return targetCampaignLocators.some((locator) => sameIdentity(evaluation.payload!.campaign_spec_locator, locator))
    const review = typedArtifact<Review>(artifact, "evolution-lab/integrity-review")
    if (review)
      return targetEvaluationLocators.some((locator) =>
        sameIdentity(review.payload!.evaluation_result_locator, locator),
      )
    const run = typedArtifact<Run>(artifact, "evolution-lab/run-evidence-bundle")
    if (run) return targetCampaignLocators.some((locator) => sourceIncludes(run.envelope, locator))
    return false
  }
  const unlinked = read.artifacts.flatMap((artifact) =>
    targetRelevant(artifact) && !reachable.has(exactKey(artifact.catalog.taskID, artifact.locator))
      ? [
          {
            code: "UNLINKED_EVOLUTION_ARTIFACT" as const,
            artifact: artifactIdentity(artifact),
            diagnostic: "Valid Evolution Artifact is not reachable from the exact Campaign evidence graph",
          },
        ]
      : [],
  )
  return [...read.integrityIssues, ...unlinked]
}

export async function readEvolutionHistory(rawQuery: unknown): Promise<EvolutionHistoryListResponse> {
  const query = EvolutionHistoryListQuerySchema.parse(rawQuery)
  const historyAuthority = await authority(query)
  return Database.transaction((db) => {
    const observedRevision = currentCatalogRevision(db)
    const revisionUpper = query.catalogRevisionUpper ?? observedRevision
    if (revisionUpper > observedRevision) throw new Error("Evolution history cursor exceeds the current Catalog revision")
    const read = frozenRead(db, revisionUpper)
    const before = query.beforeCatalogRevision ?? Number.MAX_SAFE_INTEGER
    const matching = campaignArtifacts(read, historyAuthority.target).filter(
      (campaign) => campaign.locator.catalog_revision < before,
    )
    const page = matching.slice(0, query.limit + 1)
    const selected = page.slice(0, query.limit)
    const receipts = receiptArtifacts(read)
    const records = selected.map((campaign) =>
      buildCampaignRecord({
        read,
        campaign,
        receipts,
        installedDigest: historyAuthority.installed_revision.package_digest,
        target: historyAuthority.target,
      }),
    )
    const last = selected.at(-1)
    return EvolutionHistoryListResponseSchema.parse({
      authority: historyAuthority,
      catalog_revision_upper: revisionUpper,
      records,
      integrity_issues: integrityIssuesForTarget(read, historyAuthority.target),
      next_cursor:
        page.length > selected.length && last
          ? {
              catalog_revision_upper: revisionUpper,
              before_catalog_revision: last.locator.catalog_revision,
            }
          : null,
    })
  })
}

function slotKey(caseID: string, arm: "baseline" | "candidate", repetition: number) {
  return `${caseID}:${arm}:${repetition}`
}

function detailSlots(input: {
  campaign: FrozenArtifact<Campaign>
  candidate: FrozenArtifact<Candidate>
  graph: ComparisonGraph
}) {
  const campaign = input.campaign.payload!
  const candidate = input.candidate.payload!
  const runs = new Map(input.graph.runs.map((run) => [slotKey(run.payload!.case_id, run.payload!.arm, run.payload!.repetition), run]))
  const evaluations = new Map(
    input.graph.evaluations.map((evaluation) => [
      slotKey(evaluation.payload!.case_id, evaluation.payload!.arm, evaluation.payload!.repetition),
      evaluation,
    ]),
  )
  const reviews = new Map(
    input.graph.reviews.map((review) => [
      slotKey(review.payload!.case_id, review.payload!.arm, review.payload!.repetition),
      review,
    ]),
  )
  return campaign.cases.flatMap((caseID) =>
    Array.from({ length: campaign.repetitions }, (_, repetition) =>
      (["baseline", "candidate"] as const).map((arm) => {
        const key = slotKey(caseID, arm, repetition)
        const run = runs.get(key)
        const evaluation = evaluations.get(key)
        const review = reviews.get(key)
        return {
          case_id: caseID,
          arm,
          repetition,
          expected_revision_digest:
            arm === "baseline" ? campaign.baseline_revision.package_digest : candidate.candidate_revision.package_digest,
          run: run ? artifactIdentity(run) : null,
          evaluation: evaluation ? artifactIdentity(evaluation) : null,
          review: review ? artifactIdentity(review) : null,
          scorer_results: campaign.scorers.map((scorer) => {
            const result = evaluation?.payload!.scorers.find((candidateResult) => candidateResult.scorer_id === scorer.scorer_id)
            return result ?? { status: "missing" as const, scorer_id: scorer.scorer_id }
          }),
          integrity_review: review?.payload ?? null,
        }
      }),
    ).flat(),
  )
}

export async function readEvolutionCampaignDetail(rawInput: unknown): Promise<EvolutionCampaignDetailResponse> {
  const input = EvolutionCampaignDetailRequestSchema.parse(rawInput)
  const query = EvolutionHistoryListQuerySchema.parse({
    namespace: input.namespace,
    id: input.id,
    installationScope: input.installationScope,
    limit: 1,
  })
  const historyAuthority = await authority(query)
  return Database.transaction((db) => {
    if (input.catalogRevisionUpper > currentCatalogRevision(db))
      throw new Error("Evolution history detail revision exceeds the current Catalog revision")
    const read = frozenRead(db, input.catalogRevisionUpper)
    const campaignArtifact = read.byExactIdentity.get(exactKey(input.campaignTaskID, input.campaignLocator))
    if (!campaignArtifact)
      throw new EvolutionHistoryAuthorityError({
        code: "EVOLUTION_HISTORY_FOREIGN_PROJECT",
        message: "Exact Campaign Task is not owned by the current Project",
        task_id: input.campaignTaskID,
        expected_project_id: Instance.project.id,
      })
    const campaign = typedArtifact<Campaign>(campaignArtifact, "evolution-lab/campaign-spec")
    if (!campaign || !sameIdentity(campaign.payload!.target, historyAuthority.target))
      throw new Error("Evolution history detail Campaign does not belong to the selected installed target")
    const candidateArtifact = read.byExactIdentity.get(exactKey(input.campaignTaskID, input.candidateLocator))
    const candidate = candidateArtifact
      ? typedArtifact<Candidate>(candidateArtifact, "evolution-lab/candidate-revision")
      : undefined
    if (
      !candidate ||
      !sourceIncludes(candidate.envelope, campaign.locator) ||
      !sameIdentity(candidate.payload!.development_campaign_locator, campaign.locator)
    )
      throw new Error("Evolution history detail Candidate does not belong to the exact Campaign graph")
    const comparisonArtifact = read.byExactIdentity.get(exactKey(input.campaignTaskID, input.comparisonLocator))
    const comparison = comparisonArtifact
      ? typedArtifact<Comparison>(comparisonArtifact, "evolution-lab/comparison-recommendation")
      : undefined
    if (!comparison || !sourceIncludes(comparison.envelope, campaign.locator) || !sourceIncludes(comparison.envelope, candidate.locator))
      throw new Error("Evolution history detail Comparison does not belong to the exact Campaign/Candidate graph")
    const graph = comparisonGraph(read, comparison)
    const record = buildCampaignRecord({
      read,
      campaign,
      receipts: receiptArtifacts(read),
      installedDigest: historyAuthority.installed_revision.package_digest,
      target: historyAuthority.target,
    })
    return EvolutionCampaignDetailResponseSchema.parse({
      authority: historyAuthority,
      catalog_revision_upper: input.catalogRevisionUpper,
      record,
      selected_candidate_locator: candidate.locator,
      selected_comparison_locator: comparison.locator,
      slots: detailSlots({ campaign, candidate, graph }),
      integrity_issues: integrityIssuesForTarget(read, historyAuthority.target),
    })
  })
}
