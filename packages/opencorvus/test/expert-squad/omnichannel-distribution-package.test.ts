import { afterAll, describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { persistQueuedTask } from "../../src/engine/pipeline"
import { ensureGitignore } from "../../src/engine/git"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import {
  EngineArtifactEnvelopeSchema,
  TaskArtifactResourceSetLocatorSchema,
  type EngineArtifactLocator,
} from "@opencorvus-ai/plugin"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { PromptProfileResolver } from "../../src/expert-squad/prompt-profile-resolver"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { ProjectRuntimePaths } from "../../src/project/runtime-paths"
import { Session } from "../../src/session"
import { withTaskScopedPluginToolHost } from "../../src/tool/plugin-tool-host"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import {
  OMNICHANNEL_SCHEMA_VERSION,
  OMNICHANNEL_WORKFLOW_ID,
  OmnichannelArtifactSchemas,
} from "../../../../expert-squads/builtin/omnichannel-distribution/lib/omnichannel-distribution/artifacts"
import publishOmnichannelArtifact from "../../../../expert-squads/builtin/omnichannel-distribution/tools/publish-omnichannel-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "omnichannel-distribution")
const skillRefs = [
  "omnichannel-distribution/shared/acceptance",
  "omnichannel-distribution/shared/method",
  "omnichannel-distribution/shared/workflow",
]
const publisherRef = "omnichannel-distribution/shared/publish-omnichannel-artifact"
const dependencies = {
  "distribution-brief-planner": [],
  "channel-spec-researcher": ["distribution-brief-planner"],
  "rights-compliance-analyst": ["distribution-brief-planner"],
  "channel-adaptation-producer": ["channel-spec-researcher", "rights-compliance-analyst"],
  "distribution-measurement-planner": ["channel-spec-researcher", "rights-compliance-analyst"],
  "distribution-plan-synthesizer": ["channel-adaptation-producer", "distribution-measurement-planner"],
  "distribution-readiness-reviewer": ["distribution-plan-synthesizer"],
  "omnichannel-delivery-owner": ["distribution-readiness-reviewer"],
} as const

afterAll(async () => {
  await resetMemoryDatabase()
})

const samples = {
  "omnichannel-distribution/campaign-brief": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    campaign_name: "OpenCorvus evidence campaign",
    source_summary: "Explain typed Artifact evidence and binding Expert Squad workflows",
    objective: "Prepare channel-ready educational content",
    audience: "Independent developers",
    target_channels: ["blog", "linkedin"],
    constraints: ["No external posting"],
  },
  "omnichannel-distribution/channel-spec-dossier": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    captured_at: "2026-08-10",
    channels: [
      { channel: "blog", format: "Markdown article", character_limit: null, required_fields: ["title", "body"], evidence_urls: ["https://www.markdownguide.org/basic-syntax/"] },
      { channel: "linkedin", format: "Professional post", character_limit: 3000, required_fields: ["body"], evidence_urls: ["https://www.linkedin.com/help/linkedin/"] },
    ],
    unknowns: ["Future platform format changes"],
  },
  "omnichannel-distribution/rights-compliance-matrix": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    rights_status: [{ asset_or_claim: "OpenCorvus product description", status: "cleared" as const, rationale: "Use the project's own public description" }],
    required_disclosures: ["No guaranteed productivity outcome"],
    approval_requirements: ["Confirm final brand wording"],
    jurisdiction_notes: ["No regulated offer is included"],
  },
  "omnichannel-distribution/channel-pack": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    versions: [
      { channel: "blog", headline: "Evidence-backed agent work", body: "A complete article body", call_to_action: "Inspect the workflow", asset_roles: ["product screenshot"], disclosures: ["No guaranteed outcome"] },
      { channel: "linkedin", headline: "Trace the work", body: "A concise professional post", call_to_action: "Read the evidence", asset_roles: ["product screenshot"], disclosures: ["No guaranteed outcome"] },
    ],
    source_claim_map: [{ claim: "OpenCorvus has Expert Squads", source_urls: ["https://opencorvus.org/"] }],
    adaptation_notes: ["The same campaign truth is preserved"],
  },
  "omnichannel-distribution/measurement-plan": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    channel_metrics: [
      { channel: "blog", primary_metric: "qualified reads", supporting_metrics: ["time on page"], observation_window: "14 days" },
      { channel: "linkedin", primary_metric: "qualified clicks", supporting_metrics: ["saves"], observation_window: "7 days" },
    ],
    utm_naming: "utm_source=<channel>&utm_campaign=opencorvus-evidence",
    attribution_caveats: ["Cross-device journeys may not join"],
    reporting_cadence: "Weekly",
  },
  "omnichannel-distribution/distribution-plan": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    launch_order: ["blog", "linkedin"],
    schedule_slots: [
      { channel: "blog", timing: "Day 1", rationale: "Create the canonical long-form source" },
      { channel: "linkedin", timing: "Day 2", rationale: "Link to the canonical source" },
    ],
    channel_package_count: 2,
    measurement_checkpoints: ["Day 7 review"],
    unresolved_blockers: [],
    external_posting: "not-performed" as const,
  },
  "omnichannel-distribution/readiness-review": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    verdict: "ready" as const,
    checks: [{ area: "channel coverage", result: "pass" as const, finding: "Both requested channels have complete packages", correction: null }],
    required_corrections: [],
    accepted_limitations: ["External posting is out of scope"],
    external_posting_boundary: "prepared-and-validated-only" as const,
  },
  "omnichannel-distribution/delivery": {
    workflow_id: OMNICHANNEL_WORKFLOW_ID,
    campaign_name: "OpenCorvus evidence campaign",
    canonical_manifest_path: "artifacts/omnichannel-distribution/manifest.json",
    canonical_schedule_path: "artifacts/omnichannel-distribution/schedule.csv",
    channel_directories: ["blog", "linkedin"],
    channel_count: 2,
    review_resolution: ["All readiness checks passed"],
    publish_mode: "prepared-not-posted" as const,
  },
}

describe("Omnichannel Distribution Expert Squad package", () => {
  test("loads the complete package and parses every current Artifact value", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(loaded.manifest).toMatchObject({
      schema_version: 1,
      namespace: "builtin",
      id: "omnichannel-distribution",
      name: "Omnichannel Distribution",
      version: "2026.08.10.1",
      product_pillars: ["work"],
    })
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(Object.keys(dependencies))
    expect([...loaded.packageSkills.keys()]).toEqual(skillRefs)
    expect([...loaded.packageToolBundles.keys()]).toEqual([publisherRef])
    const workflow = loaded.manifest.capability_projection.virtual_workflows["omnichannel-delivery-pack"]!
    expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual(dependencies)
    expect(workflow.nodes["distribution-readiness-reviewer"]!.depends_on).toEqual(["distribution-plan-synthesizer"])
    expect(loaded.manifest.capability_projection.agents["omnichannel-delivery-owner"]!.base_role).toBe("build")

    for (const [type, schema] of Object.entries(OmnichannelArtifactSchemas)) {
      expect(schema.parse(samples[type as keyof typeof samples])).toEqual(samples[type as keyof typeof samples])
    }
  }, 0)

  test("projects the package and publishes a typed producer-to-consumer chain", async () => {
    await using project = await memoryProject()
    await ExpertSquadPackageManager.importDirectory({
      projectDirectory: project.path,
      sourceDirectory: packageRoot,
      replace: false,
      installationScope: "project",
    })
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const config = Config.Info.parse({ prompt_profile: { active: "omnichannel-distribution" } })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({ projectDirectory: project.path, config })
        const schedulerCapability = await PromptProfileResolver.resolveSchedulerCapability({ projectDirectory: project.path, config, packageRevision: revision })
        expect(schedulerCapability.productionSkills.map((skill) => skill.ref)).toEqual(skillRefs)
        expect(Object.keys(schedulerCapability.virtualWorkflows)).toEqual(["omnichannel-delivery-pack"])
        for (const agentID of Object.keys(dependencies)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({ projectDirectory: project.path, config, packageRevision: revision, agentID })
          expect(worker.productionSkills.map((skill) => skill.ref)).toEqual(skillRefs)
          expect(worker.packageTools.map((tool) => tool.ref)).toEqual([publisherRef])
        }

        await ensureGitignore()
        const session = await Session.create({ kind: "root", title: "Omnichannel typed chain" })
        const taskID = Identifier.ascending("task")
        const started = Date.now()
        const binding = await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: Instance.directory,
          packageRevisionSHA256: revision.packageDigest,
          timeCreated: started,
        })
        persistQueuedTask({
          taskID,
          sessionID: session.id,
          now: started,
          title: "Omnichannel typed chain",
          request: "Publish exact distribution evidence",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: { actor: "mission", mission: { id: Identifier.ascending("mission"), session_id: Identifier.ascending("session") } },
          projectID: Instance.project.id,
          queue: true,
          packageRevision: revision,
          executionCapsuleBinding: binding,
        })
        await Session.updateMessage({
          id: "message-omnichannel-user",
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: started },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        await Session.updateMessage({
          id: "message-omnichannel-publisher",
          sessionID: session.id,
          role: "assistant",
          author: "channel-spec-researcher",
          time: { created: started, completed: started + 1 },
          parentID: "message-omnichannel-user",
          modelID: "test",
          providerID: "test",
          agent: "channel-spec-researcher",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
          finish: "stop",
        })
        const scope: TaskToolExecutionScope = {
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: "message-omnichannel-publisher",
          toolCallID: "call-omnichannel-publisher",
          toolPartID: "part-omnichannel-publisher",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "omnichannel-distribution",
            packageRevision: revision,
            agentID: "channel-spec-researcher",
            projectionHash: "c".repeat(64),
            workerTurnDescriptorID: "descriptor-omnichannel-publisher",
            workerTurnDescriptorHash: "d".repeat(64),
          },
        }

        await withTaskScopedPluginToolHost(scope, async (host) => {
          const publish = async (
            artifactType: keyof typeof samples,
            producer: keyof typeof dependencies,
            sources: EngineArtifactLocator[] = [],
            resourceSet: ReturnType<typeof TaskArtifactResourceSetLocatorSchema.parse> | null = null,
          ) => {
            ;(scope.owner as { agentID: string }).agentID = producer
            return JSON.parse(await publishOmnichannelArtifact.execute({
              artifact_type: artifactType,
              payload: samples[artifactType],
              resource_set: resourceSet,
              source_artifact_locators: sources,
            }, { host, metadata: () => {} } as never)) as { locator: EngineArtifactLocator; artifact_sha256: string }
          }

          const briefReceipt = await publish("omnichannel-distribution/campaign-brief", "distribution-brief-planner")
          const channelReceipt = await publish("omnichannel-distribution/channel-spec-dossier", "channel-spec-researcher", [briefReceipt.locator])
          const complianceReceipt = await publish("omnichannel-distribution/rights-compliance-matrix", "rights-compliance-analyst", [briefReceipt.locator])
          const channelPackReceipt = await publish("omnichannel-distribution/channel-pack", "channel-adaptation-producer", [channelReceipt.locator, complianceReceipt.locator])
          const measurementReceipt = await publish("omnichannel-distribution/measurement-plan", "distribution-measurement-planner", [channelReceipt.locator, complianceReceipt.locator])
          const planReceipt = await publish("omnichannel-distribution/distribution-plan", "distribution-plan-synthesizer", [channelPackReceipt.locator, measurementReceipt.locator])
          const reviewReceipt = await publish("omnichannel-distribution/readiness-review", "distribution-readiness-reviewer", [planReceipt.locator])
          const channelRead = await host.engineArtifacts.read({ locator: channelReceipt.locator, byte_offset: 0, max_bytes: 65_536, delivery: "inline" })
          const envelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(channelRead.chunk.text!))
          expect(envelope).toMatchObject({
            artifact_type: "omnichannel-distribution/channel-spec-dossier",
            schema_version: OMNICHANNEL_SCHEMA_VERSION,
            payload: samples["omnichannel-distribution/channel-spec-dossier"],
            source_artifact_locators: [briefReceipt.locator],
          })
          expect(channelReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)

          const stage = await host.taskArtifacts.stage({ trees: ["omnichannel-delivery"] })
          await writeFile(path.join(stage.treeDirectories["omnichannel-delivery"]!, "README.md"), "# Prepared distribution bundle\n")
          await writeFile(path.join(stage.treeDirectories["omnichannel-delivery"]!, "manifest.json"), JSON.stringify(samples["omnichannel-distribution/delivery"]))
          await writeFile(path.join(stage.treeDirectories["omnichannel-delivery"]!, "schedule.csv"), "channel,timing\nblog,Day 1\nlinkedin,Day 2\n")
          const publication = await host.taskArtifacts.publish(stage, {
            snapshot_kind: "catalog",
            files: [
              { tree: "omnichannel-delivery", path: "README.md", media_type: "text/markdown" },
              { tree: "omnichannel-delivery", path: "manifest.json", media_type: "application/json" },
              { tree: "omnichannel-delivery", path: "schedule.csv", media_type: "text/csv" },
            ],
          })
          const resourceSet = TaskArtifactResourceSetLocatorSchema.parse({ snapshot: publication.snapshot, tree: "omnichannel-delivery" })
          const deliverySources = [
            briefReceipt.locator,
            channelReceipt.locator,
            complianceReceipt.locator,
            channelPackReceipt.locator,
            measurementReceipt.locator,
            planReceipt.locator,
            reviewReceipt.locator,
          ]
          const deliveryReceipt = await publish("omnichannel-distribution/delivery", "omnichannel-delivery-owner", deliverySources, resourceSet)
          const deliveryRead = await host.engineArtifacts.read({ locator: deliveryReceipt.locator, byte_offset: 0, max_bytes: 65_536, delivery: "inline" })
          const deliveryEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(deliveryRead.chunk.text!))
          expect(deliveryReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)
          expect(deliveryEnvelope.resources.map((resource) => resource.path)).toEqual(["README.md", "manifest.json", "schedule.csv"])
          expect([...deliveryEnvelope.source_artifact_locators].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id))).toEqual(
            [...deliverySources].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)),
          )
        })
      },
    })
  }, 0)
})
