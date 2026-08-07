import {
  EngineArtifactEnvelopeSchema,
  EngineArtifactLocatorSchema,
  MetricEvaluationOutcomeSchema,
  TaskRunEvidenceBundleSchema,
  TaskArtifactResourceSetLocatorSchema,
  tool,
  type EngineArtifactLocator,
  type ToolContext,
} from "@opencorvus-ai/plugin"
import path from "node:path"
import { writeFile } from "node:fs/promises"
import {
  EvolutionArtifactSchemas,
  EvolutionMetricIdentityError,
  EvolutionMetricReceiptSchema,
  EvolutionTrialUnavailableError,
} from "../lib/evolution-lab/artifacts"

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

export default tool({
  description:
    "Execute the frozen campaign metric specifications against exact selected evidence and return measured or typed unavailable evidence.",
  args: {
    campaign_spec_locator: EngineArtifactLocatorSchema,
    candidate_revision_locator: EngineArtifactLocatorSchema.nullable(),
    run_evidence_locator: EngineArtifactLocatorSchema,
    iteration: tool.schema.number().int().nonnegative(),
    delivery_slice_revision_id: tool.schema.string().min(1).nullable(),
    visual_feedback_verification_artifact_locators: tool.schema.array(EngineArtifactLocatorSchema),
  },
  async execute(args, context) {
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
    const outcome = await context.host.metrics.evaluate({
      iteration: args.iteration,
      delivery_slice_revision_id: args.delivery_slice_revision_id,
      scorers: campaign.scorers,
      selected_evidence_locators: [args.run_evidence_locator],
      visual_feedback_verification_artifact_locators: args.visual_feedback_verification_artifact_locators,
    })
    const parsedOutcome = MetricEvaluationOutcomeSchema.parse(outcome)
    const measured = new Map(parsedOutcome.results.map((result) => [result.scorer_id, result]))
    const unavailable = new Map(parsedOutcome.unavailable.map((result) => [result.scorer_id, result]))
    const receipt = EvolutionMetricReceiptSchema.parse({
      campaign_spec_locator: args.campaign_spec_locator,
      candidate_revision_locator: args.candidate_revision_locator,
      run_evidence_locator: args.run_evidence_locator,
      case_id: run.case_id,
      arm: run.arm,
      repetition: run.repetition,
      trial_task_id: run.task_id,
      trial_revision_digest: run.revision_equality.installed,
      scorers: campaign.scorers.map((scorer) => {
        const result = measured.get(scorer.scorer_id)
        if (result) {
          if (result.raw_value === null) throw new Error(`Measured scorer ${scorer.scorer_id} has no raw value`)
          return {
            scorer_id: scorer.scorer_id,
            status: "measured" as const,
            value: result.raw_value,
            evidence: [{ source: "task_artifact_resource" as const, ref: result.evidence_ref }],
          }
        }
        const unavailableResult = unavailable.get(scorer.scorer_id)
        if (!unavailableResult) throw new Error(`Scorer ${scorer.scorer_id} has no exact metric outcome`)
        return {
          scorer_id: scorer.scorer_id,
          status: "unavailable" as const,
          reason: unavailableResult.reason_code,
          evidence: [{ source: "task_artifact_resource" as const, ref: unavailableResult.evidence_ref }],
        }
      }),
    })
    const stage = await context.host.taskArtifacts.stage({ trees: ["metric-evaluation"] })
    const receiptJSON = JSON.stringify(receipt)
    await writeFile(path.join(stage.treeDirectories["metric-evaluation"]!, "receipt.json"), receiptJSON)
    const publication = await context.host.taskArtifacts.publish(stage, {
      snapshot_kind: "engine_resource",
      files: [{ tree: "metric-evaluation", path: "receipt.json", media_type: "application/json" }],
    })
    const resource = publication.artifacts[0]!
    return JSON.stringify({
      receipt,
      resource_set: TaskArtifactResourceSetLocatorSchema.parse({
        snapshot: publication.snapshot,
        tree: "metric-evaluation",
      }),
      resource,
    })
  },
})
