import { afterAll, describe, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Config } from "../../src/config/config"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
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
import { ensureGitProjectMetadata } from "../../src/engine/git"
import { withTaskScopedPluginToolHost } from "../../src/tool/plugin-tool-host"
import type { TaskToolExecutionScope } from "../../src/tool/task-tool-execution-scope"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"
import {
  VIRAL_CONTENT_SCHEMA_VERSION,
  VIRAL_CONTENT_WORKFLOW_ID,
  ViralContentArtifactSchemas,
} from "@squads/viral-content/lib/viral-content/artifacts"
import publishViralContentArtifact from "@squads/viral-content/tools/publish-viral-content-artifact"

const packageRoot = path.resolve(import.meta.dir, "../../../..", "expert-squads", "builtin", "viral-content")
const skillRefs = ["viral-content/shared/acceptance", "viral-content/shared/method", "viral-content/shared/workflow"]
const publisherRef = "viral-content/shared/publish-viral-content-artifact"
const dependencies = {
  "viral-brief-strategist": [],
  "viral-audience-researcher": ["viral-brief-strategist"],
  "viral-trend-researcher": ["viral-brief-strategist"],
  "viral-concept-strategist": ["viral-audience-researcher", "viral-trend-researcher"],
  "viral-copy-producer": ["viral-concept-strategist"],
  "viral-content-reviewer": ["viral-copy-producer"],
  "viral-delivery-owner": ["viral-content-reviewer"],
} as const

afterAll(async () => {
  await resetMemoryDatabase()
})

const samples = {
  "viral-content/campaign-brief": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    campaign_name: "OpenCorvus launch",
    goal: "Explain evidence-backed Expert Squads",
    audience_hypotheses: ["Independent developers need verifiable delegation"],
    offer: "OpenCorvus desktop runtime",
    channels: ["blog", "linkedin"],
    constraints: ["No promised engagement"],
    evidence_questions: ["Which workflow outcomes are observable?"],
    success_hypotheses: ["Concrete Artifact evidence improves qualified reading"],
  },
  "viral-content/audience-dossier": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    segments: [
      { name: "Independent developers", need: "Reviewable agent work", evidence_urls: ["https://opencorvus.org/"] },
    ],
    tensions: ["Delegation speed versus evidence quality"],
    language_patterns: ["Show the work"],
    unknowns: ["Channel-specific baseline engagement"],
  },
  "viral-content/trend-dossier": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    observed_patterns: [
      {
        pattern: "Evidence-led product demonstrations",
        evidence_urls: ["https://opencorvus.org/"],
        observed_at: "2026-08-10",
      },
    ],
    lifecycle_assessment: "Current but requires product-specific proof",
    imitation_risks: ["Generic agent montage"],
    unknowns: ["Sustained channel performance"],
  },
  "viral-content/concept-set": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    concepts: [
      {
        id: "show-the-chain",
        hook: "Agents are easy; evidence is hard",
        promise: "Trace one Task to delivery",
        proof_points: ["Typed Artifacts"],
        distribution_hypothesis: "Concrete evidence earns saves",
        why_now: "Agent workflows are crowded",
      },
      {
        id: "parallel-with-proof",
        hook: "Parallel work without invisible handoffs",
        promise: "See explicit dependency joins",
        proof_points: ["Binding workflow"],
        distribution_hypothesis: "Architecture clarity earns qualified clicks",
        why_now: "Teams need reliable coordination",
      },
    ],
    selected_id: "show-the-chain",
    selection_rationale: "It maps directly to observable product evidence",
  },
  "viral-content/copy-pack": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    concept_id: "show-the-chain",
    title: "Agents are easy; evidence is hard",
    long_form_markdown: "# Agents are easy; evidence is hard\n\nOpenCorvus binds work to typed evidence.",
    short_variants: [
      { channel: "linkedin", copy: "Trace the work, not just the answer.", call_to_action: "Inspect OpenCorvus" },
    ],
    claim_source_map: [{ claim: "OpenCorvus uses Expert Squads", source_urls: ["https://opencorvus.org/"] }],
    disclosed_inferences: ["Evidence-led framing may improve qualified attention"],
    unresolved_claims: ["No engagement lift has been measured"],
  },
  "viral-content/review": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    verdict: "approved" as const,
    checks: [
      { area: "claim support", result: "pass" as const, finding: "The product claim has a source", correction: null },
    ],
    required_corrections: [],
    accepted_limitations: ["Engagement is unmeasured"],
    publication_guidance: "Publish as a hypothesis-led campaign",
  },
  "viral-content/delivery": {
    workflow_id: VIRAL_CONTENT_WORKFLOW_ID,
    campaign_name: "OpenCorvus launch",
    canonical_markdown_path: "artifacts/viral-content/campaign.md",
    canonical_json_path: "artifacts/viral-content/campaign.json",
    included_assets: ["campaign.md", "campaign.json"],
    copy_count: 2,
    review_resolution: ["All required checks passed"],
    release_boundary: "Text-led campaign only; no promised engagement",
  },
}

describe("Viral Content Expert Squad package", () => {
  test("loads the complete package and parses every current Artifact value", async () => {
    const loaded = await ExpertSquadRegistry.loadSourcePackage(packageRoot)
    expect(loaded.manifest).toMatchObject({
      schema_version: 2,
      namespace: "builtin",
      id: "viral-content",
      name: "Viral Content",
      version: "2026.08.30.1",
      product_pillars: ["work"],
    })
    expect(Object.keys(loaded.manifest.capability_projection.agents)).toEqual(Object.keys(dependencies))
    expect([...loaded.packageSkills.keys()]).toEqual(skillRefs)
    expect([...loaded.packageToolBundles.keys()]).toEqual([publisherRef])
    const workflow = loaded.manifest.capability_projection.virtual_workflows["evidence-backed-content-campaign"]!
    expect(Object.fromEntries(Object.entries(workflow.nodes).map(([id, node]) => [id, node.depends_on]))).toEqual(
      dependencies,
    )
    expect(workflow.nodes["viral-content-reviewer"]!.depends_on).toEqual(["viral-copy-producer"])
    expect(loaded.manifest.capability_projection.agents["viral-delivery-owner"]!.base_role).toBe("build")

    for (const [type, schema] of Object.entries(ViralContentArtifactSchemas)) {
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
        const config = Config.Info.parse({ prompt_profile: { active: "viral-content" } })
        const revision = await PromptProfileResolver.resolveActivePackageRevision({
          projectDirectory: project.path,
          config,
        })
        const schedulerCapability = await PromptProfileResolver.resolveSchedulerCapability({
          projectDirectory: project.path,
          config,
          packageRevision: revision,
        })
        expect(schedulerCapability.productionSkills.map((skill) => skill.ref)).toEqual(skillRefs)
        expect(Object.keys(schedulerCapability.virtualWorkflows)).toEqual(["evidence-backed-content-campaign"])
        for (const agentID of Object.keys(dependencies)) {
          const worker = await PromptProfileResolver.resolveWorkerCapability({
            projectDirectory: project.path,
            config,
            packageRevision: revision,
            agentID,
          })
          expect(worker.productionSkills.map((skill) => skill.ref)).toEqual(skillRefs)
          expect(worker.packageTools.map((tool) => tool.ref)).toEqual([publisherRef])
        }

        await ensureGitProjectMetadata()
        const session = Session.prepareRootNext({ kind: "root", directory: Instance.directory, title: "Viral content typed chain" })
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
        persistTask({
          taskID,
          rootSession: session,
          now: started,
          title: "Viral content typed chain",
          request: "Publish exact campaign evidence",
          productPillar: "work",
          source: "test",
          priority: "normal",
          metadata: {
            actor: "mission",
            mission: { id: `mission-${Identifier.uuid4First8()}`, session_id: Identifier.ascending("session") },
          },
          projectID: Instance.project.id,
          packageRevision: revision,
          executionCapsuleBinding: binding,
        })
        await Session.updateMessage({
          id: "message-viral-user",
          sessionID: session.id,
          role: "user",
          author: "user",
          time: { created: started },
          agent: "user",
          model: { providerID: "test", modelID: "test" },
        })
        const assistantMessage = await Session.updateMessage({
          id: "message-viral-publisher",
          sessionID: session.id,
          role: "assistant",
          author: "viral-audience-researcher",
          time: { created: started },
          parentID: "message-viral-user",
          modelID: "test",
          providerID: "test",
          agent: "viral-audience-researcher",
          path: { cwd: project.path, root: project.path },
          cost: 0,
          tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
        })
        await Session.updatePart({
          id: "step-viral-publisher",
          sessionID: session.id,
          messageID: assistantMessage.id,
          type: "step-start",
        })
        await Session.updatePart({
          id: "part-viral-publisher",
          sessionID: session.id,
          messageID: assistantMessage.id,
          type: "tool",
          callID: "call-viral-publisher",
          tool: publisherRef,
          state: { status: "running", input: {}, time: { start: started + 1 } },
        })
        const scope: TaskToolExecutionScope = {
          kind: "task",
          projectID: Instance.project.id,
          projectDirectory: project.path,
          taskID,
          taskRuntimeDirectory: ProjectRuntimePaths.taskRoot(project.path, taskID),
          sessionID: session.id,
          messageID: "message-viral-publisher",
          toolCallID: "call-viral-publisher",
          toolPartID: "part-viral-publisher",
          executionSurface: {},
          owner: {
            kind: "projected-worker",
            expertSquadID: "viral-content",
            packageRevision: revision,
            agentID: "viral-audience-researcher",
            projectionHash: "a".repeat(64),
            workerTurnDescriptorID: "descriptor-viral-publisher",
            workerTurnDescriptorHash: "b".repeat(64),
          },
        }

        await withTaskScopedPluginToolHost(scope, async (host) => {
          const publish = async (
            artifactType: keyof typeof samples,
            producer: string,
            sources: EngineArtifactLocator[] = [],
            resourceSet: ReturnType<typeof TaskArtifactResourceSetLocatorSchema.parse> | null = null,
          ) => {
            ;(scope.owner as { agentID: string }).agentID = producer
            return JSON.parse(
              await publishViralContentArtifact.execute(
                {
                  artifact: { artifact_type: artifactType, payload: samples[artifactType] } as never,
                  resource_set: resourceSet,
                  source_artifact_locators: sources,
                },
                { host, metadata: () => {} } as never,
              ),
            ) as { locator: EngineArtifactLocator; artifact_sha256: string }
          }

          const briefReceipt = await publish("viral-content/campaign-brief", "viral-brief-strategist")
          const audienceReceipt = await publish("viral-content/audience-dossier", "viral-audience-researcher", [
            briefReceipt.locator,
          ])
          const trendReceipt = await publish("viral-content/trend-dossier", "viral-trend-researcher", [
            briefReceipt.locator,
          ])
          const conceptReceipt = await publish("viral-content/concept-set", "viral-concept-strategist", [
            audienceReceipt.locator,
            trendReceipt.locator,
          ])
          const copyReceipt = await publish("viral-content/copy-pack", "viral-copy-producer", [conceptReceipt.locator])
          const reviewReceipt = await publish("viral-content/review", "viral-content-reviewer", [copyReceipt.locator])

          const audienceRead = await host.engineArtifacts.read({
            locator: audienceReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const envelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(audienceRead.chunk.text!))
          expect(envelope).toMatchObject({
            artifact_type: "viral-content/audience-dossier",
            schema_version: VIRAL_CONTENT_SCHEMA_VERSION,
            payload: samples["viral-content/audience-dossier"],
            source_artifact_locators: [briefReceipt.locator],
          })
          expect(audienceReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)

          const stage = await host.taskArtifacts.stage({ trees: ["viral-delivery"] })
          await writeFile(path.join(stage.treeDirectories["viral-delivery"]!, "campaign.md"), "# OpenCorvus launch\n")
          await writeFile(
            path.join(stage.treeDirectories["viral-delivery"]!, "campaign.json"),
            JSON.stringify(samples["viral-content/delivery"]),
          )
          const publication = await host.taskArtifacts.publish(stage, {
            snapshot_kind: "catalog",
            files: [
              { tree: "viral-delivery", path: "campaign.json", media_type: "application/json" },
              { tree: "viral-delivery", path: "campaign.md", media_type: "text/markdown" },
            ],
          })
          const resourceSet = TaskArtifactResourceSetLocatorSchema.parse({
            snapshot: publication.snapshot,
            tree: "viral-delivery",
          })
          const deliveryReceipt = await publish(
            "viral-content/delivery",
            "viral-delivery-owner",
            [
              briefReceipt.locator,
              audienceReceipt.locator,
              trendReceipt.locator,
              conceptReceipt.locator,
              copyReceipt.locator,
              reviewReceipt.locator,
            ],
            resourceSet,
          )
          const deliveryRead = await host.engineArtifacts.read({
            locator: deliveryReceipt.locator,
            byte_offset: 0,
            max_bytes: 65_536,
            delivery: "inline",
          })
          const deliveryEnvelope = EngineArtifactEnvelopeSchema.parse(JSON.parse(deliveryRead.chunk.text!))
          expect(deliveryReceipt.artifact_sha256).toMatch(/^[a-f0-9]{64}$/)
          expect(deliveryEnvelope.resources.map((resource) => resource.path)).toEqual(["campaign.json", "campaign.md"])
          const expectedDeliverySources = [
            briefReceipt.locator,
            audienceReceipt.locator,
            trendReceipt.locator,
            conceptReceipt.locator,
            copyReceipt.locator,
            reviewReceipt.locator,
          ]
          expect(
            [...deliveryEnvelope.source_artifact_locators].sort((left, right) =>
              left.artifact_id.localeCompare(right.artifact_id),
            ),
          ).toEqual(
            [...expectedDeliverySources].sort((left, right) => left.artifact_id.localeCompare(right.artifact_id)),
          )
        })
      },
    })
  }, 0)
})
