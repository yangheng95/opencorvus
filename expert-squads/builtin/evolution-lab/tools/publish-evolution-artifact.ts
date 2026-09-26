import {
  ArtifactReadLocatorSchema,
  ArtifactSchemaLimits,
  EngineArtifactEnvelopeSchema,
  engineArtifactSourceChain,
  EngineArtifactLocatorSchema,
  TaskArtifactResourceSetLocatorSchema,
  TaskRunEvidenceBundleSchema,
  canonicalTaskRunEvidenceJSON,
  canonicalWorkspaceTreeJSON,
  sameTaskArtifactRef,
  WorkspaceTreeSnapshotSchema,
  workspaceTreeDigest,
  MetricScorerAuthoringSpecSchema,
  metricScorerSpecFromAuthoring,
  tool,
  type ArtifactReadLocator,
  type EngineArtifactLocator,
  type TaskArtifactRef,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import {
  EvolutionArtifactIntegrityError,
  EvolutionArtifactSchemas,
  EvolutionCampaignPublishInputSchema,
  EvolutionCandidateRevisionPublishInputSchema,
  EvolutionComparisonRecommendationPublishInputSchema,
  EvolutionEvaluationResultPublishInputSchema,
  EvolutionMetricReceiptSchema,
  EvolutionPackagePublishableArtifactInputSchema,
  EvolutionRunEvidencePublishInputSchema,
  expandEvolutionMeasurementAliases,
  parseEvolutionArtifact,
} from "../lib/evolution-lab/artifacts"
import { candidateMutableTextPaths, compareCandidateIntegrity } from "../lib/evolution-lab/candidate-integrity"
import { deriveComparisonRecommendation } from "../lib/evolution-lab/comparison"
import { readEvolutionMetricContext, readRecordedMetricScorer } from "../lib/evolution-lab/metric-context"

function sameJSON(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function resourceIdentity(resource: { path: string; media_type: string; bytes: number; sha256: string }) {
  return {
    path: resource.path,
    media_type: resource.media_type,
    bytes: resource.bytes,
    sha256: resource.sha256,
  }
}

function canonicalResourceIdentitySet(
  resources: readonly { path: string; media_type: string; bytes: number; sha256: string }[],
) {
  return resources.map((resource) => JSON.stringify(resourceIdentity(resource))).toSorted()
}

const CampaignModelConfigurationSchema = tool.schema
  .object({
    schema_version: tool.schema.literal(1),
    provider_id: tool.schema.string().min(1),
    model_id: tool.schema.string().min(1),
    streaming: tool.schema.literal(true),
    retries: tool.schema.number().int().nonnegative(),
    inactivity_timeout_ms: tool.schema.number().int().positive(),
    max_evidence_bytes: tool.schema.number().int().positive(),
  })
  .strict()

// Campaign scorer assets are validated by the canonical authoring schema, so
// the kind set here can never fall behind what the executor runs. The Host
// stamps scorer_revision from the published asset bytes.
const CampaignScorerAssetSchema = MetricScorerAuthoringSpecSchema

async function readJSONResource(resource: TaskArtifactRef, context: ToolContext) {
  if (resource.media_type !== "application/json")
    throw new EvolutionArtifactIntegrityError(`Campaign resource ${resource.path} must be application/json`)
  const bytes = await context.host.taskArtifacts.read(resource)
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  try {
    return JSON.parse(text) as unknown
  } catch (cause) {
    throw new EvolutionArtifactIntegrityError(`Campaign resource ${resource.path} is not valid JSON`, { cause })
  }
}

function exactResourceByPath(resources: readonly TaskArtifactRef[], resourcePath: string, role: string) {
  const matches = resources.filter((resource) => resource.path === resourcePath)
  if (matches.length !== 1)
    throw new EvolutionArtifactIntegrityError(
      `Campaign ${role} path ${resourcePath} must identify exactly one immutable resource`,
    )
  return matches[0]!
}

async function readEngineArtifactEnvelope(
  locator: EngineArtifactLocator,
  context: ToolContext,
  purpose = "Exact Evolution Artifact predecessor",
  select = true,
) {
  let offset = 0
  let text = ""
  for (;;) {
    const result = await context.host.engineArtifacts.read({
      locator,
      byte_offset: offset,
      max_bytes: 65_536,
      delivery: "inline",
    })
    if (result.chunk.text === undefined)
      throw new EvolutionArtifactIntegrityError("Evolution predecessor Artifact is not readable JSON text")
    text += result.chunk.text
    if (result.chunk.complete) break
    if (result.chunk.next_offset === null)
      throw new EvolutionArtifactIntegrityError("Evolution predecessor Artifact ended before completion")
    offset = result.chunk.next_offset
  }
  if (select) await context.host.engineArtifacts.select({ locator, purpose })
  return EngineArtifactEnvelopeSchema.parse(JSON.parse(text))
}

type ComparisonEvidence = {
  locator: EngineArtifactLocator
  envelope: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>
}

async function discoverComparisonEvidence(selected: readonly ComparisonEvidence[], context: ToolContext) {
  const catalog: ComparisonEvidence[] = []
  let cursor: string | undefined
  do {
    const page = await context.host.engineArtifacts.search({
      sources: ["engine_artifact"],
      artifact_types: [
        "evolution-lab/run-evidence-bundle",
        "evolution-lab/evaluation-result",
        "evolution-lab/integrity-review",
      ],
      version_scope: "current",
      sort: "oldest",
      limit: ArtifactSchemaLimits.maxSearchLimit,
      ...(cursor ? { cursor } : {}),
    })
    if (!page.catalog_complete || page.provider_errors.length > 0)
      throw new EvolutionArtifactIntegrityError(
        `Comparison evidence catalog is incomplete; retry discovery: ${JSON.stringify(page.provider_errors)}`,
      )
    for (const entry of page.entries) {
      if (entry.locator.source !== "engine_artifact")
        throw new EvolutionArtifactIntegrityError("Comparison evidence catalog entry must identify an Engine Artifact")
      const envelope = await readEngineArtifactEnvelope(
        entry.locator,
        context,
        "Comparison evidence catalog observation",
        false,
      )
      catalog.push({ locator: entry.locator, envelope })
    }
    cursor = page.next_cursor ?? undefined
  } while (cursor)
  // All three families share one catalog upper bound and membership. Later
  // Reviews of these same measured facts are rechecked by the mutation commit.
  const measurements = expandEvolutionMeasurementAliases(selected, catalog)
  for (const item of measurements)
    await context.host.engineArtifacts.select({
      locator: item.locator,
      purpose: "Complete publication aliases of the selected measured fact",
    })
  const evaluations = new Set(
    measurements
      .filter((item) => item.envelope.artifact_type === "evolution-lab/evaluation-result")
      .map((item) => JSON.stringify(item.locator)),
  )
  const reviews: ComparisonEvidence[] = []
  for (const { locator, envelope } of catalog) {
    if (envelope.artifact_type !== "evolution-lab/integrity-review") continue
    const correlation = tool.schema
      .object({ evaluation_result_locator: ArtifactReadLocatorSchema })
      .safeParse(envelope.payload)
    if (!correlation.success) {
      if (envelope.source_artifact_locators.some((locator) => evaluations.has(JSON.stringify(locator))))
        throw new EvolutionArtifactIntegrityError(
          "A Review sourced from the selected Evaluation has no valid evaluation identity",
        )
      continue
    }
    if (!evaluations.has(JSON.stringify(correlation.data.evaluation_result_locator))) continue
    EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(envelope.payload)
    await context.host.engineArtifacts.select({
      locator,
      purpose: "Complete independent Review evidence for the selected evaluation",
    })
    reviews.push({ locator, envelope })
  }
  return [...measurements, ...reviews]
}

export function requireEvolutionWorkerProducer(
  envelope: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>,
  agentID: string,
) {
  const chain = envelope.producer.owner_kind === "mission" ? engineArtifactSourceChain(envelope) : []
  const producer = chain.length ? chain.at(-1)!.source_producer : envelope.producer
  if (
    producer?.owner_kind !== "projected-worker" ||
    producer.expert_squad_id !== "evolution-lab" ||
    producer.package_revision.id !== "evolution-lab" ||
    producer.agent_id !== agentID
  )
    throw new EvolutionArtifactIntegrityError(
      `${envelope.artifact_type} must be produced by Evolution Lab worker ${agentID}`,
    )
}

function attributionIdentifiesOpportunity(input: {
  attribution: { owner_evidence: readonly ArtifactReadLocator[] }
  attributionEnvelope: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>
  opportunityEnvelope: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>
  opportunityLocator: EngineArtifactLocator
}) {
  if (input.attribution.owner_evidence.some((locator) => sameJSON(locator, input.opportunityLocator))) return true
  const opportunityLineage = engineArtifactSourceChain(input.opportunityEnvelope).at(-1)
  const attributionLineage = engineArtifactSourceChain(input.attributionEnvelope).at(-1)
  if (
    !opportunityLineage ||
    !attributionLineage ||
    opportunityLineage.source_task_id !== attributionLineage.source_task_id
  )
    return false
  const originalOpportunityLocator = opportunityLineage.source_locator
  return (
    attributionLineage.source_provenance.source_artifact_locators.length === 1 &&
    sameJSON(attributionLineage.source_provenance.source_artifact_locators[0], originalOpportunityLocator) &&
    input.attribution.owner_evidence.some((locator) => sameJSON(locator, originalOpportunityLocator))
  )
}

export const evolutionArtifactOwner = {
  "evolution-lab/opportunity": "evolution-observer",
  "evolution-lab/failure-attribution": "evolution-failure-analyst",
  "evolution-lab/campaign-spec": "evolution-experiment-planner",
  "evolution-lab/candidate-revision": "evolution-candidate-author",
  "evolution-lab/run-evidence-bundle": "evolution-evaluator",
  "evolution-lab/evaluation-result": "evolution-evaluator",
  "evolution-lab/integrity-review": "evolution-safety-auditor",
  "evolution-lab/comparison-recommendation": "evolution-recommendation-owner",
} as const

export function assertEvolutionArtifactOwner(artifactType: keyof typeof evolutionArtifactOwner, agentID: string) {
  const expectedAgent = evolutionArtifactOwner[artifactType]
  if (agentID !== expectedAgent)
    throw new EvolutionArtifactIntegrityError(
      `${artifactType} must be published by Evolution Lab worker ${expectedAgent}`,
    )
}

const evolutionPublicationControls = {
  resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
  parent_resource_set: TaskArtifactResourceSetLocatorSchema.optional(),
  source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
}

const evolutionPublicationBranches = EvolutionPackagePublishableArtifactInputSchema.options.map((branch) =>
  branch.extend(evolutionPublicationControls),
)
// `.map` widens the branch tuple to a plain array; the discriminated union
// constructor needs the non-empty tuple shape back. The source union is
// non-empty by construction, so the assertion restates a fact zod cannot see.
type EvolutionPublicationBranch = (typeof evolutionPublicationBranches)[number]
const EvolutionPackagePublicationArtifactInputSchema = tool.schema.discriminatedUnion(
  "artifact_type",
  evolutionPublicationBranches as [EvolutionPublicationBranch, ...EvolutionPublicationBranch[]],
)

/**
 * Which artifact types cannot be published without their immutable resource
 * set, and what that set is called in the refusal. Four types used to be
 * spread across a three-way `||` chain plus a separate `if` with its own
 * wording; a fifth would have joined one of them by guesswork.
 */
const REQUIRED_RESOURCE_SET_BY_ARTIFACT_TYPE: Partial<Record<string, string>> = {
  "evolution-lab/campaign-spec": "its exact immutable resource set",
  "evolution-lab/candidate-revision": "its exact immutable resource set",
  "evolution-lab/evaluation-result": "its exact immutable resource set",
  "evolution-lab/run-evidence-bundle": "the exact immutable collector resource set",
}

export default tool({
  description:
    "Validate and publish one strict evolution-lab Artifact ABI value. Pass exactly one top-level artifact object; its selected branch contains the correlated payload, resource set, optional parent resource set, and exact source locators.",
  args: {
    artifact: EvolutionPackagePublicationArtifactInputSchema.describe(
      "One correlated publication: select one artifact_type branch and provide that branch's exact payload, resource_set, optional parent_resource_set, and source_artifact_locators inside this object.",
    ),
  },
  async execute(args, context) {
    const publication = args.artifact
    const artifact_type = publication.artifact_type
    assertEvolutionArtifactOwner(artifact_type, context.agent)
    const requiredResourceSet = REQUIRED_RESOURCE_SET_BY_ARTIFACT_TYPE[artifact_type]
    if (requiredResourceSet && !publication.resource_set)
      throw new EvolutionArtifactIntegrityError(`${artifact_type} requires ${requiredResourceSet}`)
    let resources = publication.resource_set ? await context.host.taskArtifacts.resources(publication.resource_set) : []
    // Reassigned by branches whose payload the Host derives rather than accepts.
    let payload =
      artifact_type === "evolution-lab/failure-attribution"
        ? await (async () => {
            const attribution = EvolutionArtifactSchemas["evolution-lab/failure-attribution"].parse(publication.payload)
            if (
              publication.source_artifact_locators.length !== 1 ||
              publication.source_artifact_locators[0]?.source !== "engine_artifact"
            )
              throw new EvolutionArtifactIntegrityError(
                "failure-attribution requires exactly one opportunity Engine Artifact source",
              )
            const opportunityLocator = publication.source_artifact_locators[0]
            const opportunityEnvelope = await readEngineArtifactEnvelope(
              opportunityLocator,
              context,
              "Exact opportunity predecessor for causal attribution",
            )
            if (opportunityEnvelope.artifact_type !== "evolution-lab/opportunity")
              throw new EvolutionArtifactIntegrityError(
                "failure-attribution source must identify an evolution-lab/opportunity Artifact",
              )
            requireEvolutionWorkerProducer(opportunityEnvelope, "evolution-observer")
            EvolutionArtifactSchemas["evolution-lab/opportunity"].parse(opportunityEnvelope.payload)
            if (!attribution.owner_evidence.some((locator) => sameJSON(locator, opportunityLocator)))
              throw new EvolutionArtifactIntegrityError(
                "failure-attribution owner evidence must identify its exact opportunity source",
              )
            return attribution
          })()
        : artifact_type === "evolution-lab/campaign-spec"
          ? await (async () => {
              const campaignInput = EvolutionCampaignPublishInputSchema.parse(publication.payload)
              if (publication.source_artifact_locators.some((locator) => locator.source !== "engine_artifact"))
                throw new EvolutionArtifactIntegrityError(
                  "campaign-spec sources must be exact Engine Artifact locators",
                )
              const sources = await Promise.all(
                publication.source_artifact_locators
                  .filter((locator): locator is EngineArtifactLocator => locator.source === "engine_artifact")
                  .map(async (locator) => ({ locator, envelope: await readEngineArtifactEnvelope(locator, context) })),
              )
              const opportunities = sources.filter(
                (item) => item.envelope.artifact_type === "evolution-lab/opportunity",
              )
              const attributions = sources.filter(
                (item) => item.envelope.artifact_type === "evolution-lab/failure-attribution",
              )
              if (sources.length !== 2 || opportunities.length !== 1 || attributions.length !== 1)
                throw new EvolutionArtifactIntegrityError(
                  "campaign-spec requires exactly one opportunity and one failure-attribution source",
                )
              requireEvolutionWorkerProducer(opportunities[0]!.envelope, "evolution-observer")
              requireEvolutionWorkerProducer(attributions[0]!.envelope, "evolution-failure-analyst")
              const opportunity = EvolutionArtifactSchemas["evolution-lab/opportunity"].parse(
                opportunities[0]!.envelope.payload,
              )
              const attribution = EvolutionArtifactSchemas["evolution-lab/failure-attribution"].parse(
                attributions[0]!.envelope.payload,
              )
              if (
                !attributionIdentifiesOpportunity({
                  attribution,
                  attributionEnvelope: attributions[0]!.envelope,
                  opportunityEnvelope: opportunities[0]!.envelope,
                  opportunityLocator: opportunities[0]!.locator,
                })
              )
                throw new EvolutionArtifactIntegrityError(
                  "campaign failure-attribution must directly identify its exact opportunity source",
                )

              const roles = campaignInput.resource_roles
              const dataset = exactResourceByPath(resources, roles.dataset_path, "dataset")
              const cases = roles.cases.map((item) => ({
                case_id: item.case_id,
                resource: exactResourceByPath(resources, item.resource_path, `case ${item.case_id}`),
              }))
              const modelConfiguration = exactResourceByPath(
                resources,
                roles.model_configuration_path,
                "model configuration",
              )
              const environment = exactResourceByPath(resources, roles.environment_path, "environment")
              const workspaceTemplate = exactResourceByPath(
                resources,
                roles.workspace_template_path,
                "workspace template",
              )
              const permissionSnapshot = exactResourceByPath(
                resources,
                roles.permission_snapshot_path,
                "permission snapshot",
              )
              const scorerAssets = await Promise.all(
                roles.scorer_assets.map(async (item) => {
                  const resource = exactResourceByPath(resources, item.resource_path, `scorer ${item.scorer_id}`)
                  const asset = CampaignScorerAssetSchema.parse(await readJSONResource(resource, context))
                  if (asset.scorer_id !== item.scorer_id)
                    throw new EvolutionArtifactIntegrityError(
                      `Campaign scorer role ${item.scorer_id} does not match asset ${asset.scorer_id}`,
                    )
                  return { scorer_id: item.scorer_id, resource, asset }
                }),
              )
              const expectedResources = [
                dataset,
                ...cases.map((item) => item.resource),
                modelConfiguration,
                environment,
                workspaceTemplate,
                permissionSnapshot,
                ...scorerAssets.map((item) => item.resource),
              ]
              if (!sameJSON(canonicalResourceIdentitySet(resources), canonicalResourceIdentitySet(expectedResources)))
                throw new EvolutionArtifactIntegrityError(
                  "campaign-spec resource set must equal every exact frozen campaign input",
                )
              const workspaceText = new TextDecoder("utf-8", { fatal: true }).decode(
                await context.host.taskArtifacts.read(workspaceTemplate),
              )
              const workspaceSnapshot = WorkspaceTreeSnapshotSchema.parse(JSON.parse(workspaceText))
              if (canonicalWorkspaceTreeJSON(workspaceSnapshot) !== workspaceText) {
                throw new EvolutionArtifactIntegrityError("campaign workspace snapshot is not canonical JSON")
              }
              const model = CampaignModelConfigurationSchema.parse(await readJSONResource(modelConfiguration, context))
              // One expansion point: the Host stamps the frozen revision from the
              // published asset bytes and fixes campaign-global placement. Adding a
              // scorer kind touches the canonical declaration only.
              const scorers = scorerAssets.map(({ resource, asset }) =>
                metricScorerSpecFromAuthoring(asset, {
                  scorer_revision: resource.sha256,
                  scope: "global",
                  goal_id: null,
                }),
              )
              const frozen = {
                dataset: resourceIdentity(dataset),
                cases: cases.map((item) => ({
                  case_id: item.case_id,
                  resource: resourceIdentity(item.resource),
                })),
                model_configuration: resourceIdentity(modelConfiguration),
                environment: resourceIdentity(environment),
                workspace_template: resourceIdentity(workspaceTemplate),
                permission_snapshot: resourceIdentity(permissionSnapshot),
                scorer_assets: scorerAssets.map((item) => ({
                  scorer_id: item.scorer_id,
                  scorer_revision: item.resource.sha256,
                  resource: resourceIdentity(item.resource),
                })),
              }
              const trialExecution =
                opportunity.target.scope === "built_in"
                  ? ({ status: "unavailable", reason_code: "product_release_required" } as const)
                  : ({ status: "available", installation_scope: opportunity.target.scope } as const)
              const baselinePackage = await context.host.expertSquadPackages.inspectRevision({
                revision: { package_digest: opportunity.current_revision.package_digest },
              })
              return EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse({
                target: opportunity.target,
                baseline_revision: opportunity.current_revision,
                candidate_version_policy: campaignInput.candidate_version_policy,
                candidate_hypothesis: campaignInput.candidate_hypothesis,
                dataset_partition: campaignInput.dataset_partition,
                dataset_digest: dataset.sha256,
                cases: cases.map((item) => item.case_id),
                scorer_digests: scorerAssets.map((item) => item.resource.sha256),
                scorers,
                frozen_inputs: frozen,
                model: `${model.provider_id}/${model.model_id}`,
                model_configuration_digest: modelConfiguration.sha256,
                environment_digest: environment.sha256,
                workspace_digest: workspaceTreeDigest(workspaceSnapshot),
                permission_snapshot_digest: permissionSnapshot.sha256,
                external_side_effect_policy: campaignInput.external_side_effect_policy,
                repetitions: campaignInput.repetitions,
                arm_order: campaignInput.arm_order,
                statistics: campaignInput.statistics,
                budget: campaignInput.budget,
                inactivity_timeout_ms: model.inactivity_timeout_ms,
                ui_rubric_digest:
                  scorerAssets.find((item) => item.asset.evaluator_kind === "judge")?.resource.sha256 ?? null,
                mutable_paths: candidateMutableTextPaths(baselinePackage),
                trial_execution: trialExecution,
              })
            })()
          : artifact_type === "evolution-lab/candidate-revision"
            ? EvolutionCandidateRevisionPublishInputSchema.parse(publication.payload)
            : artifact_type === "evolution-lab/evaluation-result"
              ? EvolutionEvaluationResultPublishInputSchema.parse(publication.payload)
              : artifact_type === "evolution-lab/run-evidence-bundle"
                ? EvolutionRunEvidencePublishInputSchema.parse(publication.payload)
                : artifact_type === "evolution-lab/comparison-recommendation"
                  ? EvolutionComparisonRecommendationPublishInputSchema.parse(publication.payload)
                  : parseEvolutionArtifact(artifact_type, publication.payload)
    if (artifact_type === "evolution-lab/candidate-revision") {
      const candidatePayload = EvolutionCandidateRevisionPublishInputSchema.parse(payload)
      const campaignLocator = candidatePayload.development_campaign_locator
      if (
        campaignLocator &&
        !publication.source_artifact_locators.some((locator) => sameJSON(locator, campaignLocator))
      )
        throw new EvolutionArtifactIntegrityError(
          "candidate publication sources must include its exact development campaign",
        )
      const developmentCampaign = campaignLocator
        ? await (async () => {
            const campaignEnvelope = await readEngineArtifactEnvelope(campaignLocator, context)
            if (campaignEnvelope.artifact_type !== "evolution-lab/campaign-spec")
              throw new EvolutionArtifactIntegrityError(
                "candidate development campaign locator must identify a campaign-spec",
              )
            const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(campaignEnvelope.payload)
            if (campaign.dataset_partition !== "development")
              throw new EvolutionArtifactIntegrityError("candidate authoring requires an exact development campaign")
            return campaign
          })()
        : undefined
      if (!publication.parent_resource_set)
        throw new EvolutionArtifactIntegrityError("candidate publication requires the exact parent resource set")
      const parent = await context.host.expertSquadPackages.validateResourceSet({
        resource_set: publication.parent_resource_set,
      })
      // The parent revision is proven from the supplied parent resource set,
      // not from a claim about it, so this compares the Campaign against the
      // package the author actually authored from.
      const parentRevision = {
        namespace: parent.namespace,
        id: parent.id,
        version: parent.version,
        package_digest: parent.package_digest,
      }
      if (
        developmentCampaign &&
        (developmentCampaign.target.namespace !== parentRevision.namespace ||
          developmentCampaign.target.id !== parentRevision.id ||
          !sameJSON(developmentCampaign.baseline_revision, parentRevision))
      )
        throw new EvolutionArtifactIntegrityError(
          "candidate parent revision must equal its exact development campaign target and baseline",
        )
      const parentResources = await context.host.taskArtifacts.resources(publication.parent_resource_set)
      const candidate = await context.host.expertSquadPackages.validateResourceSet({
        resource_set: publication.resource_set!,
      })
      const comparison = compareCandidateIntegrity(parent, candidate)
      if (developmentCampaign && !sameJSON(developmentCampaign.mutable_paths, comparison.mutable_paths))
        throw new EvolutionArtifactIntegrityError(
          "candidate parent mutable path closure must equal its exact development campaign",
        )
      // Every identity, manifest, and digest below is derived from the two
      // resource sets this publisher just validated. It stamps them rather than
      // asking the author to restate them: a restated digest is a second source
      // for one fact, and transcribing dozens of them byte-for-byte is a
      // failure mode, not a verification.
      payload = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
        development_campaign_locator: candidatePayload.development_campaign_locator,
        feedback: candidatePayload.feedback,
        hypothesis: candidatePayload.hypothesis,
        provenance: candidatePayload.provenance,
        parent_revision: parentRevision,
        candidate_revision: {
          namespace: candidate.namespace,
          id: candidate.id,
          version: candidate.version,
          package_digest: candidate.package_digest,
        },
        parent_resources: parentResources.map(resourceIdentity),
        candidate_resources: resources.map(resourceIdentity),
        changed_paths: comparison.changed_paths,
        diff_sha256: comparison.diff_sha256,
        frozen_files: comparison.frozen_files,
        manager_receipt: {
          operation: "validated",
          namespace: candidate.namespace,
          id: candidate.id,
          version: candidate.version,
          package_digest: candidate.package_digest,
        },
      })
      resources = [...parentResources, ...resources]
    }
    if (artifact_type === "evolution-lab/evaluation-result") {
      const receiptResource = resources[0]
      if (resources.length !== 1 || !receiptResource)
        throw new EvolutionArtifactIntegrityError(
          "evaluation-result resource set must contain its exact metric receipt",
        )
      const receiptBytes = await context.host.taskArtifacts.read(receiptResource)
      const receiptText = new TextDecoder("utf-8", { fatal: true }).decode(receiptBytes)
      const receipt = EvolutionMetricReceiptSchema.parse(JSON.parse(receiptText))
      if (JSON.stringify(receipt) !== receiptText)
        throw new EvolutionArtifactIntegrityError("metric evaluation receipt is not exact canonical JSON")
      const binding = await readEvolutionMetricContext({
        campaign_spec_locator: EngineArtifactLocatorSchema.parse(receipt.campaign_spec_locator),
        candidate_revision_locator: receipt.candidate_revision_locator
          ? EngineArtifactLocatorSchema.parse(receipt.candidate_revision_locator) : null,
        run_evidence_locator: EngineArtifactLocatorSchema.parse(receipt.run_evidence_locator),
      }, context)
      const { run, campaign, collectorResource } = binding
      if (receipt.case_id !== run.case_id || receipt.arm !== run.arm || receipt.repetition !== run.repetition ||
          receipt.trial_task_id !== run.task_id || receipt.trial_revision_digest !== run.revision_equality.installed) {
        throw new EvolutionArtifactIntegrityError("Metric receipt does not identify its exact Trial run and slot")
      }
      if (!sameJSON(receipt.scorers.map((item) => item.scorer_id).toSorted(),
        campaign.scorers.map((item) => item.scorer_id).toSorted())) {
        throw new EvolutionArtifactIntegrityError("Metric receipt must contain the complete frozen scorer set")
      }
      const verified = await Promise.all(receipt.scorers.map(async (scorer) => {
        const evidence = scorer.evidence[0]
        if (scorer.evidence.length !== 1 || evidence?.source !== "task_artifact_resource")
          throw new EvolutionArtifactIntegrityError(`Metric receipt scorer ${scorer.scorer_id} requires one recorded attempt`)
        const recorded = await readRecordedMetricScorer(evidence.ref, context)
        const definition = campaign.scorers.find((item) => item.scorer_id === scorer.scorer_id)!
        if (recorded.observation.trial_task_id !== run.task_id ||
            !sameTaskArtifactRef(recorded.observation.subject, collectorResource) ||
            recorded.observation.scorer_revision !== definition.scorer_revision ||
            !sameJSON(recorded.scorer, scorer)) {
          throw new EvolutionArtifactIntegrityError(`Metric receipt scorer ${scorer.scorer_id} differs from its recorded observation`)
        }
        return recorded
      }))
      const origins = verified.map(({ observation }) => ({
        task_id: observation.task_id, producer: observation.producer, iteration: observation.iteration,
      }))
      if (origins.some((origin) => !sameJSON(origin, origins[0]))) {
        throw new EvolutionArtifactIntegrityError(
          "Metric receipt combines observations from different Tool invocations or iterations",
        )
      }
      // Immutable JSON is a transport, not measurement authority. Exact native
      // result rows and their attempts own each scorer fact.
      payload = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse({
        campaign_spec_locator: receipt.campaign_spec_locator,
        candidate_revision_locator: receipt.candidate_revision_locator,
        run_evidence_locator: receipt.run_evidence_locator,
        case_id: receipt.case_id,
        arm: receipt.arm,
        repetition: receipt.repetition,
        trial_task_id: receipt.trial_task_id,
        trial_revision_digest: receipt.trial_revision_digest,
        scorers: verified.map(({ scorer }) => scorer),
        metric_receipt_resource: resourceIdentity(receiptResource),
      })
      const scorerResources = receipt.scorers.flatMap((scorer) =>
        scorer.evidence.flatMap((locator) => (locator.source === "task_artifact_resource" ? [locator.ref] : [])),
      )
      resources = [
        ...resources,
        ...scorerResources.filter(
          (candidate) => !resources.some((resource) => sameTaskArtifactRef(resource, candidate)),
        ),
      ]
    }
    if (artifact_type === "evolution-lab/run-evidence-bundle") {
      // The Evaluator names the slot; every other field is stamped here from
      // the facts that own it. Nothing it could restate would verify anything.
      const slot = EvolutionRunEvidencePublishInputSchema.parse(payload)
      const campaignLocator = publication.source_artifact_locators[0]
      if (publication.source_artifact_locators.length !== 1 || campaignLocator?.source !== "engine_artifact")
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle requires exactly one source: the exact campaign-spec Engine Artifact whose slot this Trial fills",
        )
      const campaignEnvelope = await readEngineArtifactEnvelope(
        campaignLocator,
        context,
        "Frozen Campaign whose slot this Trial run fills",
      )
      if (campaignEnvelope.artifact_type !== "evolution-lab/campaign-spec")
        throw new EvolutionArtifactIntegrityError(
          `run-evidence-bundle source must identify an evolution-lab/campaign-spec Artifact; received ${campaignEnvelope.artifact_type}`,
        )
      requireEvolutionWorkerProducer(campaignEnvelope, "evolution-experiment-planner")
      const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(campaignEnvelope.payload)
      const resource = resources[0]
      if (resources.length !== 1 || !resource || resource.media_type !== "application/json")
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle resource set must contain exactly the one JSON resource published by collect-run-evidence",
        )
      const bytes = await context.host.taskArtifacts.read(resource)
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      const bundle = TaskRunEvidenceBundleSchema.parse(JSON.parse(text))
      if (canonicalTaskRunEvidenceJSON(bundle) !== text) {
        throw new EvolutionArtifactIntegrityError("run-evidence-bundle resource is not exact canonical JSON")
      }
      const recollected = await context.host.taskRuns.collect({
        taskID: bundle.task.id,
        terminalOccurrence: bundle.terminal_occurrence,
        selectedMessageLocators: bundle.messages
          .filter((message) => message.body !== undefined)
          .map((message) => message.locator),
      })
      if (canonicalTaskRunEvidenceJSON(recollected) !== text)
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle resource no longer equals a fresh collection of authoritative Task facts " +
            `(resource canonical_sha256 ${bundle.canonical_sha256}, fresh canonical_sha256 ${recollected.canonical_sha256}); ` +
            "collect this run again and publish the new collector resource",
        )
      const usage = bundle.usage
      const model = usage.models.length === 1 ? usage.models[0] : undefined
      if (!model)
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle requires the Trial's Provider usage ledger to record exactly one model; " +
            `expected: one model, received: ${JSON.stringify(usage.models)}. ` +
            "This Trial is not a single-model Campaign run, so its slot has no publishable run evidence.",
        )
      const facts = bundle.revision_facts
      const runtimeDigests = [...new Set(facts.runtime_snapshot_digests)]
      const revisionFacts = {
        installed: facts.installed_resolved_digest,
        expected: facts.creation_expected_digest,
        task_binding: facts.task_binding_digest,
        workflow_binding: facts.workflow_binding_digest,
        runtime_snapshot: runtimeDigests,
      }
      const revision = facts.installed_resolved_digest
      if (
        facts.creation_expected_digest !== revision ||
        facts.task_binding_digest !== revision ||
        facts.workflow_binding_digest !== revision ||
        runtimeDigests.length !== 1 ||
        runtimeDigests[0] !== revision
      )
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle requires one Trial package revision across installed, expected, Task binding, " +
            `workflow binding, and every runtime snapshot; received: ${JSON.stringify(revisionFacts)}`,
        )
      const terminalTime =
        bundle.terminal_occurrence.status === "inactive"
          ? bundle.terminal_occurrence.last_activity.time_updated
          : bundle.terminal_occurrence.status === "awaiting_interaction"
            ? bundle.terminal_occurrence.time_created
            : bundle.terminal_occurrence.lifecycle.timeCompleted
      const outcome =
        bundle.terminal_occurrence.status === "completed"
          ? "success"
          : bundle.terminal_occurrence.status === "failed" || bundle.terminal_occurrence.status === "cancelled"
            ? "failure"
            : "unavailable"
      const activityDuration =
        bundle.task.time_started === null || terminalTime < bundle.task.time_started
          ? null
          : terminalTime - bundle.task.time_started
      payload = EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse({
        case_id: slot.case_id,
        arm: slot.arm,
        repetition: slot.repetition,
        workspace_digest: bundle.workspace_checkpoint.initial_tree_sha256,
        run_evidence_sha256: resource.sha256,
        run_evidence_resource: resourceIdentity(resource),
        task_id: bundle.task.id,
        terminal_time: terminalTime,
        model,
        environment_digest: campaign.environment_digest,
        token_usage: usage.token_usage,
        cost: usage.cost,
        last_activity_at: new Date(terminalTime).toISOString(),
        outcome,
        activity_duration_ms: activityDuration,
        revision_equality: {
          installed: revision,
          expected: revision,
          task_binding: revision,
          workflow_binding: revision,
          runtime_snapshot: revision,
        },
      })
    }
    if (artifact_type === "evolution-lab/integrity-review") {
      const review = EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(payload)
      const evaluationLocator = review.evaluation_result_locator
      if (evaluationLocator.source !== "engine_artifact")
        throw new EvolutionArtifactIntegrityError(
          "integrity-review must review an exact Engine Artifact evaluation result",
        )
      if (!publication.source_artifact_locators.some((locator) => sameJSON(locator, evaluationLocator)))
        throw new EvolutionArtifactIntegrityError(
          "integrity-review must directly source the exact evaluation result it reviews",
        )
      const evaluationEnvelope = await readEngineArtifactEnvelope(
        evaluationLocator,
        context,
        "Exact evaluation result under independent integrity review",
      )
      if (evaluationEnvelope.artifact_type !== "evolution-lab/evaluation-result")
        throw new EvolutionArtifactIntegrityError(
          "integrity-review source must identify an evolution-lab/evaluation-result Artifact",
        )
      requireEvolutionWorkerProducer(evaluationEnvelope, "evolution-evaluator")
      const evaluation = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(evaluationEnvelope.payload)
      if (
        review.case_id !== evaluation.case_id ||
        review.arm !== evaluation.arm ||
        review.repetition !== evaluation.repetition
      )
        throw new EvolutionArtifactIntegrityError(
          "integrity-review slot identity must equal its exact evaluation result",
        )
      const sourceKeys = new Set(publication.source_artifact_locators.map((locator) => JSON.stringify(locator)))
      for (const locator of review.revision?.supersedes ?? []) {
        if (!sourceKeys.has(JSON.stringify(locator)))
          throw new EvolutionArtifactIntegrityError(
            "Review revision must directly source every explicitly superseded Review",
          )
        const parentEnvelope = await readEngineArtifactEnvelope(locator, context, "Exact Review being superseded")
        if (parentEnvelope.artifact_type !== "evolution-lab/integrity-review")
          throw new EvolutionArtifactIntegrityError("Review revision predecessor must be an integrity-review")
        requireEvolutionWorkerProducer(parentEnvelope, "evolution-safety-auditor")
        const parent = EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(parentEnvelope.payload)
        if (
          !sameJSON(parent.evaluation_result_locator, evaluationLocator) ||
          parent.case_id !== review.case_id ||
          parent.arm !== review.arm ||
          parent.repetition !== review.repetition
        )
          throw new EvolutionArtifactIntegrityError(
            "Review revision predecessor must review the same exact Evaluation and slot",
          )
      }
      for (const finding of review.findings)
        for (const locator of finding.evidence)
          if (!sourceKeys.has(JSON.stringify(locator)))
            throw new EvolutionArtifactIntegrityError(
              "integrity review finding evidence must be an exact direct source of that Artifact",
            )
    }
    if (artifact_type === "evolution-lab/comparison-recommendation") {
      if (publication.source_artifact_locators.some((locator) => locator.source !== "engine_artifact"))
        throw new EvolutionArtifactIntegrityError("comparison sources must all be exact Engine Artifact locators")
      const envelopes = await Promise.all(
        publication.source_artifact_locators
          .filter((locator): locator is EngineArtifactLocator => locator.source === "engine_artifact")
          .map(async (locator) => ({ locator, envelope: await readEngineArtifactEnvelope(locator, context) })),
      )
      const campaigns = envelopes.filter((item) => item.envelope.artifact_type === "evolution-lab/campaign-spec")
      const candidates = envelopes.filter((item) => item.envelope.artifact_type === "evolution-lab/candidate-revision")
      const supportedTypes = new Set([
        "evolution-lab/campaign-spec",
        "evolution-lab/candidate-revision",
        "evolution-lab/evaluation-result",
        "evolution-lab/run-evidence-bundle",
      ])
      if (envelopes.some((item) => !supportedTypes.has(item.envelope.artifact_type)))
        throw new EvolutionArtifactIntegrityError("comparison sources contain an undeclared Artifact type")
      if (campaigns.length !== 1 || candidates.length !== 1)
        throw new EvolutionArtifactIntegrityError(
          "comparison requires exactly one campaign-spec and one candidate-revision source",
        )
      requireEvolutionWorkerProducer(campaigns[0]!.envelope, "evolution-experiment-planner")
      requireEvolutionWorkerProducer(candidates[0]!.envelope, "evolution-candidate-author")
      const evidence = await discoverComparisonEvidence(envelopes, context)
      envelopes.splice(0, envelopes.length, ...campaigns, ...candidates, ...evidence)
      for (const item of envelopes) {
        if (item.envelope.artifact_type === "evolution-lab/evaluation-result")
          requireEvolutionWorkerProducer(item.envelope, "evolution-evaluator")
        if (item.envelope.artifact_type === "evolution-lab/integrity-review") {
          requireEvolutionWorkerProducer(item.envelope, "evolution-safety-auditor")
          const review = EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(item.envelope.payload)
          const sourceKeys = new Set(item.envelope.source_artifact_locators.map((locator) => JSON.stringify(locator)))
          for (const locator of review.revision?.supersedes ?? [])
            if (!sourceKeys.has(JSON.stringify(locator)))
              throw new EvolutionArtifactIntegrityError(
                "Review revision must directly source every explicitly superseded Review",
              )
          for (const finding of review.findings)
            for (const locator of finding.evidence)
              if (!sourceKeys.has(JSON.stringify(locator)))
                throw new EvolutionArtifactIntegrityError(
                  "integrity review finding evidence must be an exact direct source of that Artifact",
                )
        }
        if (item.envelope.artifact_type === "evolution-lab/run-evidence-bundle")
          requireEvolutionWorkerProducer(item.envelope, "evolution-evaluator")
      }
      const evaluations = envelopes
        .filter((item) => item.envelope.artifact_type === "evolution-lab/evaluation-result")
        .map((item) => ({
          locator: item.locator,
          value: EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(item.envelope.payload),
        }))
      const reviews = envelopes
        .filter((item) => item.envelope.artifact_type === "evolution-lab/integrity-review")
        .map((item) => ({
          locator: item.locator,
          value: EvolutionArtifactSchemas["evolution-lab/integrity-review"].parse(item.envelope.payload),
        }))
      const runs = envelopes
        .filter((item) => item.envelope.artifact_type === "evolution-lab/run-evidence-bundle")
        .map((item) => ({
          locator: item.locator,
          value: EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse(item.envelope.payload),
        }))
      payload = deriveComparisonRecommendation({
        campaign: EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(campaigns[0]!.envelope.payload),
        campaignLocator: campaigns[0]!.locator,
        candidate: EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse(candidates[0]!.envelope.payload),
        candidateLocator: candidates[0]!.locator,
        evaluations,
        reviews,
        runs,
      })
    }
    const receipt = await context.host.engineArtifacts.publish({
      artifact_type,
      schema_version: 1,
      label: artifact_type,
      payload,
      resources,
    })
    return JSON.stringify({
      artifact_type,
      schema_version: 1,
      locator: receipt.locator,
      artifact_sha256: receipt.sha256,
    })
  },
})
