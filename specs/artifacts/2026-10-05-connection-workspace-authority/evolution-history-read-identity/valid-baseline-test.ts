import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createHash } from "node:crypto"
import { writeExpertSquadPackage, type ExpertSquadPackageDefinition } from "@opencorvus-ai/sdk/expert-squad-authoring"
import {
  EngineArtifactEnvelopeSchema,
  EvolutionArtifactSchemas,
  EvolutionHistoryListResponseSchema,
  EvolutionCampaignDetailResponseSchema,
  canonicalEvolutionJSON,
} from "@opencorvus-ai/plugin"
import { deriveComparisonRecommendation } from "@squads/evolution-lab/lib/evolution-lab/comparison"
import { Server } from "../../src/server/server"
import { Instance, runOutsideInstanceContext } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import { ConfigPaths } from "../../src/config/paths"
import { ExpertSquadPackageLocations } from "../../src/expert-squad/locations"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"
import { ExpertSquadPackageManager } from "../../src/expert-squad/manager"
import { persistEstablishedTask } from "../fixture/engine-task"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { recordEngineArtifact } from "../../src/engine/artifact"
import { exactEngineArtifactLocator } from "../../src/artifact-catalog"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(async () => {
  Server.resetProjectRoutesAppForTest()
  await resetMemoryDatabase()
})
const targetIdentity = { namespace: "cold-history", id: "history-target", installationScope: "project" as const }
const model = "missing-evolution-provider/missing-evolution-model"
function definition(version: string): ExpertSquadPackageDefinition {
  return {
    manifest: {
      schema_version: 2,
      namespace: targetIdentity.namespace,
      id: targetIdentity.id,
      label: "Cold history target",
      description: "SDK-authored current history target.",
      version,
      product_pillars: ["code"],
      readme: "README.md",
      selector: {
        summary: "Cold history.",
        selection_guidance: "Inspect immutable campaign facts.",
        instructions: "selector.md",
      },
      capability_sets: {},
      capability_projection: {
        scheduler: { base_role: "orchestrator", capability_refs: [] },
        agents: {},
        virtual_workflows: {},
      },
    },
    files: { "README.md": `# History target ${version}\n`, "selector.md": "# Read history\n" },
  }
}
function packageRoot(directory: string) {
  return path.join(
    ExpertSquadPackageLocations.project(directory).packagesRoot,
    targetIdentity.namespace,
    targetIdentity.id,
  )
}
async function install(directory: string) {
  await writeExpertSquadPackage({ directory: packageRoot(directory), definition: definition("2026.10.07.1") })
  await ExpertSquadRegistry.invalidateAvailable()
}
async function missingConfig(directory: string) {
  const file = ConfigPaths.projectFile(directory)
  await fs.mkdir(path.dirname(file), { recursive: true })
  await fs.writeFile(file, JSON.stringify({ model }))
}
async function cold(directory: string, route: string, body?: unknown) {
  await Instance.disposeAll()
  Server.resetProjectRoutesAppForTest()
  const url = new URL(route, "http://opencorvus.test")
  url.searchParams.set("directory", directory)
  const response = await runOutsideInstanceContext(() =>
    Server.App().request(`${url.pathname}${url.search}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "x-opencorvus-directory": directory,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
  )
  return {
    method: body === undefined ? "GET" : "POST",
    path: `${url.pathname}${url.search}`,
    status: response.status,
    body: (await response.json()) as unknown,
  }
}
function historyPath(extra: Record<string, string> = {}) {
  return `/expert-squad/evolution-history?${new URLSearchParams({ ...targetIdentity, limit: "20", ...extra })}`
}
function safeReceipt(result: Awaited<ReturnType<typeof cold>>) {
  return {
    method: result.method,
    path: result.path,
    status: result.status,
    errorName:
      result.status >= 400 && result.body && typeof result.body === "object" && "name" in result.body
        ? result.body.name
        : null,
  }
}

async function graph(directory: string) {
  return Instance.provide({
    directory,
    fn: async () => {
      await install(directory)
      const baseline = await ExpertSquadRegistry.loadPackage(packageRoot(directory))
      const candidateRoot = path.join(directory, "candidate", targetIdentity.namespace, targetIdentity.id)
      await writeExpertSquadPackage({ directory: candidateRoot, definition: definition("2026.10.07.2") })
      const candidate = await ExpertSquadRegistry.loadPackage(candidateRoot)
      const installedEvolution = await ExpertSquadPackageManager.installPayloadPackage({ projectDirectory: directory, id: "evolution-lab", installationScope: "project" })
      const evolution = await ExpertSquadRegistry.loadPackage(installedEvolution.after.targetRoot)
      const session = Session.prepareRootNext({
        kind: "root",
        directory,
        title: "Cold persisted evolution graph",
        metadata: { configOverlay: { model } },
      })
      const taskID = Identifier.ascending("task")
      const now = Date.now()
      persistEstablishedTask({
        taskID,
        rootSession: session,
        now,
        title: session.title,
        request: "Read persisted evolution evidence.",
        productPillar: "code",
        source: "test",
        priority: "normal",
        metadata: {},
        projectID: Instance.project.id,
        packageRevision: {
          scope: "project",
          projectID: Instance.project.id,
          namespace: evolution.namespace,
          id: evolution.id,
          version: evolution.version!,
          packageDigest: evolution.packageDigest,
        },
        executionCapsuleBinding: await prepareTaskProcessBinding({
          mode: "native",
          taskID,
          projectID: Instance.project.id,
          rootDirectory: directory,
          packageRevisionSHA256: evolution.packageDigest,
          timeCreated: now,
        }),
      })
      const revision = (pkg: typeof baseline) => ({
        namespace: pkg.namespace,
        id: pkg.id,
        version: pkg.version!,
        package_digest: pkg.packageDigest,
      })
      const producer = {
        owner_kind: "projected-worker",
        expert_squad_id: evolution.id,
        package_revision: { scope: "project", project_id: Instance.project.id, ...revision(evolution) },
        agent_id: Object.keys(evolution.manifest.capability_projection.agents)[0],
        projection_hash: createHash("sha256")
          .update(canonicalEvolutionJSON(evolution.manifest.capability_projection))
          .digest("hex"),
        session_id: session.id,
        message_id: `fixture-message-${taskID}`,
        tool_call_id: "fixture-evolution-publication",
      }
      const resource = async (name: string, content: string) => {
        const file = path.join(directory, "frozen-inputs", name)
        await fs.mkdir(path.dirname(file), { recursive: true })
        await fs.writeFile(file, content)
        return {
          path: name,
          media_type: "application/json",
          bytes: Buffer.byteLength(content),
          sha256: createHash("sha256").update(content).digest("hex"),
        }
      }
      const dataset = await resource("dataset.json", '{"cases":["case-a"]}')
      const caseResource = await resource("case-a.json", '{"input":"owned fixture"}')
      const modelResource = await resource("model.json", '{"mode":"fixture-no-execution"}')
      const environment = await resource("environment.json", '{"scope":"owned"}')
      const workspace = await resource("workspace.json", '{"files":[]}')
      const permission = await resource("permission.json", '{"external":false}')
      const scorerResource = await resource("scorer.json", '{"scorer":"quality","unit":"score"}')
      const scorer = {
        scorer_id: "quality",
        scorer_revision: scorerResource.sha256,
        scope: "global",
        goal_id: null,
        description: "Fixture quality dimension",
        unit: "score",
        direction: "higher_better",
        target: 1,
        floor: 0,
        weight: 1,
        observation_class: "quality",
        evaluator_kind: "shell",
        evaluator_config: {
          scorer_revision: scorerResource.sha256,
          workspace_digest: workspace.sha256,
          executable: process.execPath,
          args: ["-e", "process.stdout.write('0')"],
          parse: "stdout_number",
          inactivity_timeout_ms: 1000,
        },
      }
      const publish = (
        type: string,
        payload: unknown,
        sources: ReturnType<typeof exactEngineArtifactLocator>[] = [],
      ) => {
        const artifactID = recordEngineArtifact({
          taskID,
          kind: "expert_output",
          label: type,
          payload: EngineArtifactEnvelopeSchema.parse({
            artifact_type: type,
            schema_version: 1,
            producer,
            payload,
            resources: [],
            observed_artifact_locators: sources,
            source_artifact_locators: sources,
          }),
        })
        return exactEngineArtifactLocator({ taskID, artifactID })
      }
      const campaignPayload = EvolutionArtifactSchemas["evolution-lab/campaign-spec"].parse({
        target: { scope: "project", project_id: Instance.project.id, project_directory: directory,
          namespace: targetIdentity.namespace, id: targetIdentity.id },
        baseline_revision: revision(baseline),
        candidate_version_policy: "increment version",
        candidate_hypothesis: "Observe immutable input only.",
        dataset_partition: "development",
        dataset_digest: dataset.sha256,
        cases: ["case-a"],
        scorer_digests: [scorerResource.sha256],
        scorers: [scorer],
        frozen_inputs: {
          dataset,
          cases: [{ case_id: "case-a", resource: caseResource }],
          model_configuration: modelResource,
          environment,
          workspace_template: workspace,
          permission_snapshot: permission,
          scorer_assets: [{ scorer_id: "quality", scorer_revision: scorerResource.sha256, resource: scorerResource }],
        },
        model: "fixture-no-execution",
        model_configuration_digest: modelResource.sha256,
        environment_digest: environment.sha256,
        workspace_digest: workspace.sha256,
        permission_snapshot_digest: permission.sha256,
        external_side_effect_policy: "no external effects",
        repetitions: 1,
        arm_order: ["baseline", "candidate"],
        statistics: "paired observations",
        budget: { max_runs: 2, max_cost: null },
        inactivity_timeout_ms: 1000,
        ui_rubric_digest: null,
        mutable_paths: ["README.md"],
        trial_execution: { status: "available", installation_scope: "project" },
      })
      const campaign = publish("evolution-lab/campaign-spec", campaignPayload)
      const parentReadme = await resource("parent-readme.json", JSON.stringify(baseline.readmeContent))
      const candidateReadme = await resource("candidate-readme.json", JSON.stringify(candidate.readmeContent))
      const diff = await resource(
        "diff.json",
        canonicalEvolutionJSON({ before: baseline.readmeContent, after: candidate.readmeContent }),
      )
      const candidatePayload = EvolutionArtifactSchemas["evolution-lab/candidate-revision"].parse({
        development_campaign_locator: campaign,
        feedback: null,
        parent_revision: revision(baseline),
        candidate_revision: revision(candidate),
        parent_resources: [parentReadme],
        candidate_resources: [candidateReadme],
        hypothesis: campaignPayload.candidate_hypothesis,
        changed_paths: ["README.md"],
        diff_sha256: diff.sha256,
        frozen_files: [],
        manager_receipt: { operation: "validated", ...revision(candidate) },
        provenance: [campaign],
      })
      const candidateLocator = publish("evolution-lab/candidate-revision", candidatePayload, [campaign])
      const comparisonPayload = deriveComparisonRecommendation({
        campaign: campaignPayload,
        campaignLocator: campaign,
        candidate: candidatePayload,
        candidateLocator,
        evaluations: [],
        reviews: [],
        runs: [],
      })
      const comparison = publish("evolution-lab/comparison-recommendation", comparisonPayload, [
        campaign,
        candidateLocator,
      ])
      return {
        taskID,
        sessionID: session.id,
        projectID: Instance.project.id,
        campaign,
        candidate: candidateLocator,
        comparison,
        recommendation: comparisonPayload.recommendation,
      }
    },
  })
}

test("cold empty history keeps real installed authority independent of missing execution model", async () => {
  await using project = await memoryProject("cold-empty-evolution")
  const sessionID = await Instance.provide({
    directory: project.path,
    fn: async () => {
      await install(project.path)
      return (await Session.create({ kind: "assistant" })).id
    },
  })
  await missingConfig(project.path)
  const history = await cold(project.path, historyPath())
  const runtime = await cold(project.path, `/session/${sessionID}/config`)
  console.log("cold-evolution-empty", JSON.stringify(safeReceipt(history)))
  expect(runtime).toMatchObject({
    status: 400,
    body: {
      name: "ProviderModelNotFoundError",
      data: { providerID: "missing-evolution-provider", modelID: "missing-evolution-model" },
    },
  })
  expect(history.status).toBe(200)
  expect(EvolutionHistoryListResponseSchema.parse(history.body)).toMatchObject({
    authority: {
      project_directory: project.path,
      installed_revision: { namespace: targetIdentity.namespace, id: targetIdentity.id, version: "2026.10.07.1" },
    },
    records: [],
  })
}, 60_000)

test("cold list and exact POST detail read persisted graph and retain upper/project errors", async () => {
  await using project = await memoryProject("cold-graph-evolution")
  await using foreign = await memoryProject("cold-foreign-evolution")
  const saved = await graph(project.path)
  await Instance.provide({ directory: foreign.path, fn: () => install(foreign.path) })
  await missingConfig(project.path)
  await missingConfig(foreign.path)
  const upper = saved.comparison.catalog_revision
  const detailInput = {
          namespace: targetIdentity.namespace,
          id: targetIdentity.id,
    campaignTaskID: saved.taskID,
    campaignLocator: saved.campaign,
    candidateLocator: saved.candidate,
    comparisonLocator: saved.comparison,
    catalogRevisionUpper: upper,
  }
  const history = await cold(project.path, historyPath())
  const detail = await cold(project.path, "/expert-squad/evolution-history/detail", detailInput)
  const futureList = await cold(
    project.path,
    historyPath({ catalogRevisionUpper: String(upper + 100), beforeCatalogRevision: String(upper + 1) }),
  )
  const futureDetail = await cold(project.path, "/expert-squad/evolution-history/detail", {
    ...detailInput,
    catalogRevisionUpper: upper + 100,
  })
  const foreignDetail = await cold(foreign.path, "/expert-squad/evolution-history/detail", detailInput)
  console.log(
    "cold-evolution-graph",
    JSON.stringify([history, detail, futureList, futureDetail, foreignDetail].map(safeReceipt)),
  )
  expect([history.status, detail.status]).toEqual([200, 200])
  const list = EvolutionHistoryListResponseSchema.parse(history.body)
  expect(list.records.map((record) => record.campaign.artifact.task_id)).toEqual([saved.taskID])
  const exact = EvolutionCampaignDetailResponseSchema.parse(detail.body)
  expect({ candidate: exact.selected_candidate_locator, comparison: exact.selected_comparison_locator }).toEqual({
    candidate: saved.candidate,
    comparison: saved.comparison,
  })
  for (const [result, message] of [
    [futureList, "Evolution history cursor exceeds the current Catalog revision"],
    [futureDetail, "Evolution history detail revision exceeds the current Catalog revision"],
  ] as const)
    expect(result).toMatchObject({ status: 400, body: { name: "ExpertSquadPackageError", data: { message } } })
  expect(foreignDetail).toMatchObject({
    status: 400,
    body: {
      name: "EvolutionHistoryAuthorityError",
      data: { code: "EVOLUTION_HISTORY_FOREIGN_PROJECT", task_id: saved.taskID },
    },
  })
}, 60_000)
