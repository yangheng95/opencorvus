import {
  EngineArtifactEnvelopeSchema,
  TaskRunEvidenceBundleSchema,
  MetricRecordedObservationSchema,
  type EngineArtifactLocator,
  type TaskArtifactRef,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import { EvolutionArtifactSchemas, EvolutionMetricIdentityError, EvolutionTrialUnavailableError } from "./artifacts"

async function readEvolutionArtifact(locator: EngineArtifactLocator, context: ToolContext, purpose: string) {
  let byteOffset = 0
  let text = ""
  for (;;) {
    const result = await context.host.engineArtifacts.read({
      locator,
      byte_offset: byteOffset,
      max_bytes: 65_536,
      delivery: "inline",
    })
    if (result.chunk.text === undefined) throw new Error("Campaign specification Artifact is not readable JSON text")
    text += result.chunk.text
    if (result.chunk.complete) break
    if (result.chunk.next_offset === null) throw new Error("Campaign specification read ended before completion")
    byteOffset = result.chunk.next_offset
  }
  await context.host.engineArtifacts.select({ locator, purpose })
  const envelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(text))
  if (envelope.schema_version !== 1) throw new Error("Metric execution requires an evolution-lab Artifact at ABI 1")
  return envelope
}

export async function readEvolutionMetricContext(args: {
  campaign_spec_locator: EngineArtifactLocator
  candidate_revision_locator: EngineArtifactLocator | null
  run_evidence_locator: EngineArtifactLocator
}, context: ToolContext) {
  const campaignEnvelope = await readEvolutionArtifact(
    args.campaign_spec_locator,
    context,
    "Frozen campaign and scorer specification",
  )
  if (campaignEnvelope.artifact_type !== "evolution-lab/campaign-spec")
    throw new Error("Metric execution requires one exact evolution-lab/campaign-spec@1 Artifact")
  const campaign = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse(campaignEnvelope.payload)
  if (campaign.trial_execution.status === "unavailable")
    throw new EvolutionTrialUnavailableError(campaign.trial_execution.reason_code)
  const runEnvelope = await readEvolutionArtifact(
    args.run_evidence_locator,
    context,
    "Exact immutable Trial identity and run evidence",
  )
  if (runEnvelope.artifact_type !== "evolution-lab/run-evidence-bundle")
    throw new Error("Metric execution requires one exact evolution-lab/run-evidence-bundle@1 Artifact")
  const run = EvolutionArtifactSchemas["evolution-lab/run-evidence-bundle"].parse(runEnvelope.payload)
  const candidate = args.candidate_revision_locator
    ? await readEvolutionArtifact(
        args.candidate_revision_locator,
        context,
        "Exact candidate package revision for Trial arm identity",
      )
    : null
  if (candidate && candidate.artifact_type !== "evolution-lab/candidate-revision")
    throw new Error("Candidate Trial requires one exact evolution-lab/candidate-revision@1 Artifact")
  const candidateRevision = candidate
    ? EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse(candidate.payload)
    : null
  const expectedTrialDigest =
    run.arm === "baseline"
      ? campaign.baseline_revision.package_digest
      : candidateRevision?.candidate_revision.package_digest
  if (run.arm === "candidate" && !candidateRevision)
    throw new EvolutionMetricIdentityError(
      "Candidate Trial metric execution requires the exact candidate revision Artifact",
    )
  if (run.revision_equality.installed !== expectedTrialDigest)
    throw new EvolutionMetricIdentityError(`${run.arm} Trial revision does not equal its frozen campaign revision`)
  if (
    candidateRevision &&
    (candidateRevision.parent_revision.namespace !== campaign.target.namespace ||
      candidateRevision.parent_revision.id !== campaign.target.id ||
      candidateRevision.parent_revision.package_digest !== campaign.baseline_revision.package_digest)
  )
    throw new EvolutionMetricIdentityError(
      "Candidate revision does not descend from the frozen campaign target and baseline",
    )
  if (
    run.workspace_digest !== campaign.workspace_digest ||
    run.environment_digest !== campaign.environment_digest ||
    run.model !== campaign.model ||
    run.repetition >= campaign.repetitions
  )
    throw new EvolutionMetricIdentityError("Trial execution identity differs from the frozen campaign inputs")
  const frozenCase = campaign.frozen_inputs.cases.find((item) => item.case_id === run.case_id)
  if (!frozenCase)
    throw new EvolutionMetricIdentityError(`Trial case ${run.case_id} is absent from the frozen campaign`)
  const collectorResource = runEnvelope.resources.find(
    (resource) => resource.sha256 === run.run_evidence_resource.sha256,
  )
  if (!collectorResource)
    throw new EvolutionMetricIdentityError("Run Artifact does not carry its exact collector resource")
  const collectorBundle = TaskRunEvidenceBundleSchema.parse(
    JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(await context.host.taskArtifacts.read(collectorResource)),
    ),
  )
  const trialResourceDigests = collectorBundle.task_artifacts.flatMap((artifact) =>
    artifact.trees.flatMap((tree) => tree.files.map((file) => file.sha256)),
  )
  if (!trialResourceDigests.includes(frozenCase.resource.sha256))
    throw new EvolutionMetricIdentityError("Trial evidence does not contain its exact frozen case resource")
  return { campaign, run, collectorResource }
}

export async function readRecordedMetricScorer(ref: TaskArtifactRef, context: ToolContext) {
  const observation = MetricRecordedObservationSchema.parse(await context.host.metrics.recorded({ evidence_ref: ref }))
  const evidence = [{ source: "task_artifact_resource" as const, ref: observation.evidence_ref }]
  const scorer = observation.outcome.status === "measured"
    ? { scorer_id: observation.scorer_id, status: "measured" as const, value: observation.outcome.value, evidence }
    : { scorer_id: observation.scorer_id, status: "unavailable" as const, reason: observation.outcome.reason_code, evidence }
  return { observation, scorer }
}
