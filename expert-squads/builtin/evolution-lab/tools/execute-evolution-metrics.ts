import {
  EngineArtifactLocatorSchema,
  MetricEvaluationOutcomeSchema,
  TaskArtifactResourceSetLocatorSchema,
  tool,
} from "@opencorvus-ai/plugin"
import path from "node:path"
import { writeFile } from "node:fs/promises"
import { EvolutionMetricReceiptSchema } from "../lib/evolution-lab/artifacts"
import { readEvolutionMetricContext, readRecordedMetricScorer } from "../lib/evolution-lab/metric-context"

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
    const { campaign, run, collectorResource } = await readEvolutionMetricContext(args, context)
    // The collector bundle is the measured Trial: shell scorers run in its
    // terminal committed workspace, and a judge reads its canonical bytes with
    // the selected Message bodies. The Run Artifact, which names the arm, is
    // never scorer input.
    const outcome = await context.host.metrics.evaluate({
      iteration: args.iteration,
      delivery_slice_revision_id: args.delivery_slice_revision_id,
      scorers: campaign.scorers,
      subject: collectorResource,
      selected_evidence_locators: [{ source: "task_artifact_resource", ref: collectorResource }],
      visual_feedback_verification_artifact_locators: args.visual_feedback_verification_artifact_locators,
    })
    const parsedOutcome = MetricEvaluationOutcomeSchema.parse(outcome)
    const observations = await Promise.all(parsedOutcome.results.map((result) => readRecordedMetricScorer(result.evidence_ref, context)))
    const recorded = new Map(observations.map(({ scorer }) => [scorer.scorer_id, scorer]))
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
        const result = recorded.get(scorer.scorer_id)
        if (!result) throw new Error(`Scorer ${scorer.scorer_id} has no exact recorded metric outcome`)
        return result
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
