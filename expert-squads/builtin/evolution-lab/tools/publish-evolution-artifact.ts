import { createHash } from "node:crypto"
import {
  ArtifactReadLocatorSchema,
  EngineArtifactEnvelopeSchema,
  TaskArtifactResourceSetLocatorSchema,
  TaskRunEvidenceBundleSchema,
  canonicalTaskRunEvidenceJSON,
  canonicalWorkspaceTreeJSON,
  sameTaskArtifactRef,
  WorkspaceTreeSnapshotSchema,
  workspaceTreeDigest,
  tool,
  type EngineArtifactLocator,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import {
  EvolutionArtifactIntegrityError,
  EvolutionArtifactSchemas,
  EvolutionMetricReceiptSchema,
  EvolutionPackagePublishableArtifactTypeSchema,
  parseEvolutionArtifact,
} from "../lib/evolution-lab/artifacts"
import { compareCandidateIntegrity } from "../lib/evolution-lab/candidate-integrity"
import { deriveComparisonRecommendation } from "../lib/evolution-lab/comparison"

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

function sameResourceIdentity(
  resource: { path: string; media_type: string; bytes: number; sha256: string },
  identity: { path: string; media_type: string; bytes: number; sha256: string },
) {
  return sameJSON(resourceIdentity(resource), identity)
}

function canonicalResourceIdentitySet(
  resources: readonly { path: string; media_type: string; bytes: number; sha256: string }[],
) {
  return resources.map((resource) => JSON.stringify(resourceIdentity(resource))).toSorted()
}

async function readEngineArtifactEnvelope(locator: EngineArtifactLocator, context: ToolContext) {
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
  await context.host.engineArtifacts.select({ locator, purpose: "Exact candidate development campaign" })
  return EngineArtifactEnvelopeSchema.parse(JSON.parse(text))
}

function requireEvolutionWorkerProducer(
  envelope: ReturnType<typeof EngineArtifactEnvelopeSchema.parse>,
  agentID: string,
) {
  if (
    envelope.producer.owner_kind !== "projected-worker" ||
    envelope.producer.expert_squad_id !== "evolution-lab" ||
    envelope.producer.package_revision.id !== "evolution-lab" ||
    envelope.producer.agent_id !== agentID
  )
    throw new EvolutionArtifactIntegrityError(
      `${envelope.artifact_type} must be produced by Evolution Lab worker ${agentID}`,
    )
}

export default tool({
  description: "Validate and publish one strict evolution-lab Artifact ABI value with exact sources and resources.",
  args: {
    artifact_type: EvolutionPackagePublishableArtifactTypeSchema,
    payload: tool.schema.unknown(),
    resource_set: TaskArtifactResourceSetLocatorSchema.nullable(),
    parent_resource_set: TaskArtifactResourceSetLocatorSchema.optional(),
    source_artifact_locators: tool.schema.array(ArtifactReadLocatorSchema),
  },
  async execute(args, context) {
    const payload = parseEvolutionArtifact(args.artifact_type, args.payload)
    if (
      (args.artifact_type === "evolution-lab/campaign-spec" ||
        args.artifact_type === "evolution-lab/candidate-revision" ||
        args.artifact_type === "evolution-lab/evaluation-result") &&
      !args.resource_set
    )
      throw new EvolutionArtifactIntegrityError(`${args.artifact_type} requires its exact immutable resource set`)
    if (args.artifact_type === "evolution-lab/run-evidence-bundle" && !args.resource_set) {
      throw new EvolutionArtifactIntegrityError(
        "run-evidence-bundle requires the exact immutable collector resource set",
      )
    }
    let resources = args.resource_set ? await context.host.taskArtifacts.resources(args.resource_set) : []
    if (args.artifact_type === "evolution-lab/campaign-spec") {
      const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(payload)
      const frozen = campaign.frozen_inputs
      const expectedResources = [
        frozen.dataset,
        ...frozen.cases.map((item) => item.resource),
        frozen.model_configuration,
        frozen.environment,
        frozen.workspace_template,
        frozen.permission_snapshot,
        ...frozen.scorer_assets.map((item) => item.resource),
      ]
      if (!sameJSON(canonicalResourceIdentitySet(resources), canonicalResourceIdentitySet(expectedResources)))
        throw new EvolutionArtifactIntegrityError(
          "campaign-spec resource set must equal every exact frozen campaign input",
        )
      const workspaceResource = resources.find((resource) => sameResourceIdentity(resource, frozen.workspace_template))
      if (!workspaceResource) throw new EvolutionArtifactIntegrityError("campaign workspace snapshot resource is missing")
      const workspaceText = new TextDecoder("utf-8", { fatal: true }).decode(
        await context.host.taskArtifacts.read(workspaceResource),
      )
      const workspaceSnapshot = WorkspaceTreeSnapshotSchema.parse(JSON.parse(workspaceText))
      if (canonicalWorkspaceTreeJSON(workspaceSnapshot) !== workspaceText) {
        throw new EvolutionArtifactIntegrityError("campaign workspace snapshot is not canonical JSON")
      }
      if (workspaceTreeDigest(workspaceSnapshot) !== campaign.workspace_digest) {
        throw new EvolutionArtifactIntegrityError("campaign workspace digest does not equal its immutable snapshot")
      }
    }
    if (args.artifact_type === "evolution-lab/candidate-revision") {
      const candidatePayload = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse(payload)
      if (
        !args.source_artifact_locators.some((locator) =>
          sameJSON(locator, candidatePayload.development_campaign_locator),
        )
      )
        throw new EvolutionArtifactIntegrityError(
          "candidate publication sources must include its exact development campaign",
        )
      const campaignEnvelope = await readEngineArtifactEnvelope(candidatePayload.development_campaign_locator, context)
      if (campaignEnvelope.artifact_type !== "evolution-lab/campaign-spec")
        throw new EvolutionArtifactIntegrityError(
          "candidate development campaign locator must identify a campaign-spec",
        )
      const developmentCampaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(
        campaignEnvelope.payload,
      )
      if (developmentCampaign.dataset_partition !== "development")
        throw new EvolutionArtifactIntegrityError("candidate authoring requires an exact development campaign")
      if (
        developmentCampaign.target.namespace !== candidatePayload.parent_revision.namespace ||
        developmentCampaign.target.id !== candidatePayload.parent_revision.id ||
        !sameJSON(developmentCampaign.baseline_revision, candidatePayload.parent_revision)
      )
        throw new EvolutionArtifactIntegrityError(
          "candidate parent revision must equal its exact development campaign target and baseline",
        )
      if (!args.parent_resource_set)
        throw new EvolutionArtifactIntegrityError("candidate publication requires the exact parent resource set")
      const parent = await context.host.expertSquadPackages.validateResourceSet({
        resource_set: args.parent_resource_set,
      })
      const parentResources = await context.host.taskArtifacts.resources(args.parent_resource_set)
      const candidate = await context.host.expertSquadPackages.validateResourceSet({
        resource_set: args.resource_set!,
      })
      const comparison = compareCandidateIntegrity(parent, candidate)
      const exactCandidateFacts = {
        parent_revision: {
          namespace: parent.namespace,
          id: parent.id,
          version: parent.version,
          package_digest: parent.package_digest,
        },
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
      }
      const claimedCandidateFacts = {
        parent_revision: candidatePayload.parent_revision,
        candidate_revision: candidatePayload.candidate_revision,
        parent_resources: candidatePayload.parent_resources,
        candidate_resources: candidatePayload.candidate_resources,
        changed_paths: candidatePayload.changed_paths,
        diff_sha256: candidatePayload.diff_sha256,
        frozen_files: candidatePayload.frozen_files,
        manager_receipt: candidatePayload.manager_receipt,
      }
      if (!sameJSON(exactCandidateFacts, claimedCandidateFacts))
        throw new EvolutionArtifactIntegrityError(
          "candidate-revision does not equal exact package validation and comparison facts",
        )
      resources = [...parentResources, ...resources]
    }
    if (args.artifact_type === "evolution-lab/evaluation-result") {
      const evaluation = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(payload)
      const receiptResource = resources.find((resource) =>
        sameResourceIdentity(resource, evaluation.metric_receipt_resource),
      )
      if (resources.length !== 1 || !receiptResource)
        throw new EvolutionArtifactIntegrityError(
          "evaluation-result resource set must contain its exact metric receipt",
        )
      const receiptBytes = await context.host.taskArtifacts.read(receiptResource)
      const receiptText = new TextDecoder("utf-8", { fatal: true }).decode(receiptBytes)
      const receipt = EvolutionMetricReceiptSchema.parse(JSON.parse(receiptText))
      if (JSON.stringify(receipt) !== receiptText)
        throw new EvolutionArtifactIntegrityError("metric evaluation receipt is not exact canonical JSON")
      if (
        !sameJSON(
          {
            campaign_spec_locator: evaluation.campaign_spec_locator,
            candidate_revision_locator: evaluation.candidate_revision_locator,
            run_evidence_locator: evaluation.run_evidence_locator,
            case_id: evaluation.case_id,
            arm: evaluation.arm,
            repetition: evaluation.repetition,
            trial_task_id: evaluation.trial_task_id,
            trial_revision_digest: evaluation.trial_revision_digest,
            scorers: evaluation.scorers,
          },
          {
            campaign_spec_locator: receipt.campaign_spec_locator,
            candidate_revision_locator: receipt.candidate_revision_locator,
            run_evidence_locator: receipt.run_evidence_locator,
            case_id: receipt.case_id,
            arm: receipt.arm,
            repetition: receipt.repetition,
            trial_task_id: receipt.trial_task_id,
            trial_revision_digest: receipt.trial_revision_digest,
            scorers: receipt.scorers,
          },
        )
      )
        throw new EvolutionArtifactIntegrityError(
          "evaluation-result identity and values must equal the exact metric receipt",
        )
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
    if (args.artifact_type === "evolution-lab/run-evidence-bundle") {
      const resourceIdentityClaim = (payload as { run_evidence_resource: ReturnType<typeof resourceIdentity> })
        .run_evidence_resource
      const resource = resources.find((candidate) => sameResourceIdentity(candidate, resourceIdentityClaim))
      if (resources.length !== 1 || !resource) {
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle resource set does not contain its exact collector resource",
        )
      }
      const bytes = await context.host.taskArtifacts.read(resource)
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
      const bundle = TaskRunEvidenceBundleSchema.parse(JSON.parse(text))
      if (canonicalTaskRunEvidenceJSON(bundle) !== text) {
        throw new EvolutionArtifactIntegrityError("run-evidence-bundle resource is not exact canonical JSON")
      }
      const recollected = await context.host.taskRuns.collect({
        taskID: bundle.task.id,
        terminalOccurrence: bundle.terminal_occurrence,
        selectedMessageLocators: bundle.messages.map((message) => message.locator),
      })
      if (canonicalTaskRunEvidenceJSON(recollected) !== text)
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle does not equal a fresh collection of authoritative Task facts",
        )
      const { canonical_sha256: recordedCanonicalSHA256, ...semantic } = bundle
      const derivedCanonicalSHA256 = createHash("sha256").update(canonicalTaskRunEvidenceJSON(semantic)).digest("hex")
      const runPayload = payload as {
        run_evidence_sha256: string
        workspace_digest: string
        task_id: string
        terminal_time: number
      }
      const claimedRevisions = (
        payload as {
          revision_equality: {
            installed: string
            expected: string
            task_binding: string
            workflow_binding: string
            runtime_snapshot: string
          }
        }
      ).revision_equality
      const runtimeDigests = bundle.revision_facts.runtime_snapshot_digests
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
      if (
        derivedCanonicalSHA256 !== recordedCanonicalSHA256 ||
        resource.sha256 !== runPayload.run_evidence_sha256 ||
        bundle.workspace_checkpoint.initial_tree_sha256 !== runPayload.workspace_digest ||
        bundle.task.id !== runPayload.task_id ||
        terminalTime !== runPayload.terminal_time ||
        (payload as { outcome: string }).outcome !== outcome ||
        (payload as { activity_duration_ms: number | null }).activity_duration_ms !== activityDuration ||
        bundle.revision_facts.workflow_binding_digest === null ||
        bundle.revision_facts.creation_expected_digest === null ||
        runtimeDigests.length === 0 ||
        runtimeDigests.some((digest) => digest !== runtimeDigests[0]) ||
        claimedRevisions.installed !== bundle.revision_facts.installed_resolved_digest ||
        claimedRevisions.expected !== bundle.revision_facts.creation_expected_digest ||
        claimedRevisions.task_binding !== bundle.revision_facts.task_binding_digest ||
        claimedRevisions.workflow_binding !== bundle.revision_facts.workflow_binding_digest ||
        claimedRevisions.runtime_snapshot !== runtimeDigests[0]
      ) {
        throw new EvolutionArtifactIntegrityError(
          "run-evidence-bundle does not match its canonical collector and package revision facts",
        )
      }
    }
    if (args.artifact_type === "evolution-lab/comparison-recommendation") {
      const claimed = EvolutionArtifactSchemas["evolution-lab/comparison-recommendation"].parse(payload)
      if (args.source_artifact_locators.some((locator) => locator.source !== "engine_artifact"))
        throw new EvolutionArtifactIntegrityError("comparison sources must all be exact Engine Artifact locators")
      const envelopes = await Promise.all(
        args.source_artifact_locators
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
      for (const item of envelopes) {
        if (item.envelope.artifact_type === "evolution-lab/evaluation-result") {
          requireEvolutionWorkerProducer(item.envelope, "evolution-security-integrity-reviewer")
          const evaluation = EvolutionArtifactSchemas["evolution-lab/evaluation-result"].parse(item.envelope.payload)
          const sourceKeys = new Set(item.envelope.source_artifact_locators.map((locator) => JSON.stringify(locator)))
          for (const finding of evaluation.integrity_review?.findings ?? [])
            for (const locator of finding.evidence)
              if (!sourceKeys.has(JSON.stringify(locator)))
                throw new EvolutionArtifactIntegrityError(
                  "reviewed evaluation finding evidence must be an exact direct source of that Artifact",
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
      const runs = envelopes
        .filter((item) => item.envelope.artifact_type === "evolution-lab/run-evidence-bundle")
        .map((item) => ({
          locator: item.locator,
          value: EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse(item.envelope.payload),
        }))
      const exact = deriveComparisonRecommendation({
        campaign: EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(campaigns[0]!.envelope.payload),
        campaignLocator: campaigns[0]!.locator,
        candidate: EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse(candidates[0]!.envelope.payload),
        candidateLocator: candidates[0]!.locator,
        evaluations,
        runs,
      })
      if (!sameJSON(exact, claimed))
        throw new EvolutionArtifactIntegrityError(
          "comparison-recommendation must equal the deterministic Campaign, Candidate, run, and evaluation matrix",
        )
    }
    const publication = await context.host.engineArtifacts.publish({
      artifact_type: args.artifact_type,
      schema_version: 1,
      label: args.artifact_type,
      payload,
      resources,
      source_artifact_locators: args.source_artifact_locators,
    })
    return JSON.stringify({
      artifact_type: args.artifact_type,
      schema_version: 1,
      locator: publication.locator,
      artifact_sha256: publication.sha256,
    })
  },
})
