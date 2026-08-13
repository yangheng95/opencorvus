import { createHash, randomBytes } from "node:crypto"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Database as SQLite } from "bun:sqlite"
import { InteractiveArtifactRecord } from "../src/interactive-artifact/schema"
import { resolveOpenCorvusRuntimePaths } from "@opencorvus-ai/util/runtime-paths"
import { canonicalWorkspaceTreeJSON, workspaceTreeDigest } from "@opencorvus-ai/plugin"
import {
  assertRandomEvolutionCampaignContract,
  observeActivityDeadline,
  missionCollectionRoute,
  missionAbortRequest,
  settleOperationWithinDeadline,
  settleFailureAfterBoundedAbort,
  selectRandomEvolutionTarget,
  summarizeEvolutionRequests,
  summarizeEvolutionEvidence,
  positiveIntegerSetting,
  recommendationInteractiveArtifactIDs,
  summarizeArtifactFailureTransitions,
  summarizeConversationFailureTransitions,
  evolutionTargetLineageInstructions,
  taskRoute,
  type ActivityDeadline,
  type EvolutionArtifactFact,
  type MarketEntry,
  type RandomSelection,
  type EvolutionRequestFact,
  isolatedProviderHandoff,
} from "./expert-squad-evolution-e2e-support"

const MODEL = process.env.EXPERT_SQUAD_EVOLUTION_MODEL?.trim() || "openai/gpt-5.6-luna"
const [PROVIDER_ID, MODEL_ID] = MODEL.split("/", 2)
if (!PROVIDER_ID || !MODEL_ID) throw new Error("EXPERT_SQUAD_EVOLUTION_MODEL must use provider/model format")
const SCORER_CRITERIA = [
  "Evaluate only the selected terminal Trial evidence for the synthetic case.",
  "Reward a correct decision-ready response that covers every case acceptance item, preserves evidence provenance,",
  "states assumptions and unknowns, and gives usable bounded next actions without inventing facts.",
  "Do not reward references to arm, score, candidate lineage, or Evolution Lab.",
].join(" ")

const POLL_INTERVAL_MS = positiveIntegerSetting(
  process.env.EXPERT_SQUAD_EVOLUTION_POLL_MS,
  2_000,
  "EXPERT_SQUAD_EVOLUTION_POLL_MS",
)
const INACTIVITY_WINDOW_MS = positiveIntegerSetting(
  process.env.EXPERT_SQUAD_EVOLUTION_INACTIVITY_MS,
  600_000,
  "EXPERT_SQUAD_EVOLUTION_INACTIVITY_MS",
)
const USER_ACTION_TIMEOUT_MS = positiveIntegerSetting(
  process.env.EXPERT_SQUAD_EVOLUTION_USER_ACTION_MS,
  1_800_000,
  "EXPERT_SQUAD_EVOLUTION_USER_ACTION_MS",
)
const FAILURE_ABORT_TIMEOUT_MS = positiveIntegerSetting(
  process.env.EXPERT_SQUAD_EVOLUTION_FAILURE_ABORT_MS,
  15_000,
  "EXPERT_SQUAD_EVOLUTION_FAILURE_ABORT_MS",
)
const RESOURCE_SETTLEMENT_TIMEOUT_MS = positiveIntegerSetting(
  process.env.EXPERT_SQUAD_EVOLUTION_RESOURCE_SETTLEMENT_MS,
  120_000,
  "EXPERT_SQUAD_EVOLUTION_RESOURCE_SETTLEMENT_MS",
)
const USER_DRIVEN = process.env.EXPERT_SQUAD_EVOLUTION_USER_DRIVEN?.trim() === "1"
const runID = `random-evolution-${new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14)}-${randomBytes(5).toString("hex")}`
const requestedRunRoot = process.env.EXPERT_SQUAD_EVOLUTION_RUN_ROOT?.trim()
const runRoot = requestedRunRoot ? path.resolve(requestedRunRoot) : path.join(os.tmpdir(), `opencorvus-${runID}`)
const homeDirectory = path.join(runRoot, "home")
const projectDirectory = path.join(runRoot, "project")
const managedConfigDirectory = path.join(runRoot, "managed-config")
const controllerLogPath = path.join(runRoot, "controller.ndjson")
const resultPath = path.join(runRoot, "result.json")
const overlayBuildDirectory = path.join(runRoot, "overlay-ui")
const overlayManifestRelativePath = ".opencorvus-overlay-manifest.json"
const missionRequestPath = path.join(runRoot, "mission-request.md")
const renderReviewReceiptPath = path.join(runRoot, "render-review-complete.json")
const databasePath = path.join(homeDirectory, "data", "opencorvus.db")
const isolatedAuthPath = path.join(homeDirectory, "data", "auth.json")
const isolatedModelsPath = path.join(homeDirectory, "data", "models.json")
const COPY_GLOBAL_AUTH = process.env.EXPERT_SQUAD_EVOLUTION_COPY_GLOBAL_AUTH?.trim() === "1"
const PROVIDER_HANDOFF = isolatedProviderHandoff({
  copyAuth: COPY_GLOBAL_AUTH,
  copyModels: process.env.EXPERT_SQUAD_EVOLUTION_COPY_GLOBAL_MODELS?.trim() === "1",
})
const inheritedRuntimePaths = resolveOpenCorvusRuntimePaths({
  env: process.env,
  platform: process.platform,
  home: os.homedir(),
})
const globalAuthSourcePath = path.resolve(
  process.env.EXPERT_SQUAD_EVOLUTION_AUTH_SOURCE?.trim() || path.join(inheritedRuntimePaths.data, "auth.json"),
)
const globalModelsSourcePath = path.resolve(
  process.env.EXPERT_SQUAD_EVOLUTION_MODELS_SOURCE?.trim() || path.join(inheritedRuntimePaths.data, "models.json"),
)

type JsonObject = Record<string, unknown>
type MissionStatus = {
  status: "running" | "inactive"
  taskCounts: { total: number; running: number; inactive: number }
  tasks: Array<{
    taskID: string
    title: string
    lifecycleStatus: "queued" | "active" | "completed" | "failed" | "cancelled"
    error?: string
  }>
}

async function writeJSON(filePath: string, value: unknown) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function readArtifactFailureHistory() {
  const sqlite = new SQLite(databasePath, { readonly: true, strict: true })
  try {
    const rows = sqlite
      .query<
        {
          artifact_id: string
          task_id: string
          kind: string
          label: string
          payload: string
          catalog_revision: number
          time_updated: number
        },
        []
      >(
        `SELECT id AS artifact_id, task_id, kind, label, payload, catalog_revision, time_updated
         FROM engine_artifact
         UNION ALL
         SELECT artifact_id, task_id, kind, label, payload, catalog_revision, time_updated
         FROM engine_artifact_version
         ORDER BY catalog_revision`,
      )
      .all()
      .map((row) => ({ ...row, payload: JSON.parse(row.payload) as unknown }))
    return summarizeArtifactFailureTransitions(rows)
  } finally {
    sqlite.close()
  }
}

function readConversationFailureHistory() {
  const sqlite = new SQLite(databasePath, { readonly: true, strict: true })
  try {
    const rows = sqlite
      .query<
        {
          part_id: string
          message_id: string
          session_id: string
          time_created: number
          time_updated: number
          part_data: string
          message_data: string
        },
        []
      >(
        `SELECT p.id AS part_id, p.message_id, p.session_id, p.time_created, p.time_updated,
                p.data AS part_data, m.data AS message_data
         FROM part p
         JOIN message m ON m.id = p.message_id
         WHERE json_extract(p.data, '$.type') = 'tool'
           AND (
             json_extract(p.data, '$.state.status') IN ('pending', 'running', 'error')
             OR json_extract(m.data, '$.finish') = 'error'
           )
         ORDER BY p.time_created, p.id`,
      )
      .all()
      .map((row) => ({
        ...row,
        part_data: JSON.parse(row.part_data) as unknown,
        message_data: JSON.parse(row.message_data) as unknown,
      }))
    return summarizeConversationFailureTransitions(rows)
  } finally {
    sqlite.close()
  }
}

async function fileResourceIdentity(
  filePath: string,
  declaredPath: string,
  mediaType: "application/json" | "text/plain",
) {
  const bytes = await fs.readFile(filePath)
  return {
    path: declaredPath,
    media_type: mediaType,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  }
}

type CampaignResourceIdentity = Awaited<ReturnType<typeof fileResourceIdentity>>

type FrozenCampaignInputClosure = {
  dataset: CampaignResourceIdentity
  caseResource: CampaignResourceIdentity
  modelConfiguration: CampaignResourceIdentity
  environment: CampaignResourceIdentity
  workspaceTemplate: CampaignResourceIdentity
  workspaceDigest: string
  permissionSnapshot: CampaignResourceIdentity
  scorerAsset: CampaignResourceIdentity
  scorerRevision: string
}

async function writeCanonicalJSON(filePath: string, value: unknown) {
  const text = JSON.stringify(value)
  await fs.writeFile(filePath, text, "utf8")
  return text
}

async function appendEvent(type: string, detail: JsonObject) {
  const event = { time: new Date().toISOString(), type, ...detail }
  await fs.appendFile(controllerLogPath, `${JSON.stringify(event)}\n`, "utf8")
  console.log(`[${event.time}] ${type} ${JSON.stringify(detail)}`)
}

async function runCommand(command: string[], cwd: string) {
  const child = Bun.spawn(command, { cwd, stdout: "pipe", stderr: "pipe", env: Bun.env })
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  if (exitCode !== 0) {
    throw new Error(`${command.join(" ")} failed with ${exitCode}: ${(stderr || stdout).trim()}`)
  }
  return stdout.trim()
}

function boundedBody(value: string) {
  return value.length <= 4_000 ? value : `${value.slice(0, 4_000)}…`
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function recommendationProjection(envelope: JsonObject) {
  const payload = envelope.payload as JsonObject | undefined
  return {
    recommendation: payload?.recommendation,
    confidence: payload?.confidence,
    aggregate_score: payload?.aggregate_score,
    regressions: payload?.regressions,
    unavailable_dimensions: payload?.unavailable_dimensions,
    required_unavailable_dimensions: payload?.required_unavailable_dimensions,
    baseline_revision: payload?.baseline_revision,
    candidate_revision: payload?.candidate_revision,
    paired_deltas: payload?.paired_deltas,
    outcome_rates: payload?.outcome_rates,
    cost_delta: payload?.cost_delta,
    token_delta: payload?.token_delta,
    activity_duration_ms_delta: payload?.activity_duration_ms_delta,
  }
}

function campaignPrompt(input: {
  target: MarketEntry
  targetDigest: string
  targetSelectorSummary: string
  evolutionDigest: string
  productPillar: "code" | "work"
  projectID: string
  projectDirectory: string
  frozenInputs: FrozenCampaignInputClosure
}) {
  return [
    "This is an authorized automated end-to-end acceptance campaign for Expert Squad evolution.",
    `The randomly selected installed target is ${input.target.namespace}/${input.target.id}@${input.target.version}`,
    `with exact incumbent package digest ${input.targetDigest}.`,
    `Its declared purpose is: ${input.target.description}`,
    `Its selector summary is: ${input.targetSelectorSummary}`,
    `Evolution Lab is installed at exact digest ${input.evolutionDigest}.`,
    `The target's authoritative evolution identity is target.scope=project, project_id=${input.projectID},`,
    `project_directory=${input.projectDirectory}, namespace=${input.target.namespace}, id=${input.target.id}.`,
    ...evolutionTargetLineageInstructions(),
    `The immutable Mission product pillar is ${input.productPillar}.`,
    "The complete synthetic development Dataset has exactly one Case named synthetic-random-domain-v1.",
    "Use case/acceptance.json as the sole Dataset manifest and its declared case/input.md as the sole Case resource.",
    "Preserve those exact roles and bytes; do not create another Dataset manifest or reclassify either resource.",
    "The following is the authoritative complete frozen Campaign resource closure. In the candidate-preparation Task,",
    "read these exact project files and snapshot exactly this complete set before publishing the Campaign; package/*",
    "snapshot resources are incumbent package material and never substitute for these Campaign roles:",
    `- dataset=${JSON.stringify(input.frozenInputs.dataset)}`,
    `- case synthetic-random-domain-v1=${JSON.stringify(input.frozenInputs.caseResource)}`,
    `- model_configuration=${JSON.stringify(input.frozenInputs.modelConfiguration)}`,
    `- environment=${JSON.stringify(input.frozenInputs.environment)}`,
    `- workspace_template=${JSON.stringify(input.frozenInputs.workspaceTemplate)}`,
    `- workspace_digest=${input.frozenInputs.workspaceDigest}`,
    `- permission_snapshot=${JSON.stringify(input.frozenInputs.permissionSnapshot)}`,
    `- scorer_asset global-judge=${JSON.stringify(input.frozenInputs.scorerAsset)}`,
    `- scorer_revision=${input.frozenInputs.scorerRevision}`,
    "Make reasonable assumptions recorded in evidence. Do not ask questions and do not request permissions or approvals.",
    "Use required_only assurance. This campaign is non-UI, has no external side effects, and must not use production actions.",
    "Do not promote, restore, retry, or install the candidate. Finish with a non-executing experiment recommendation only.",
    "",
    "Coordinate the real production lifecycle through separate immutable fixed-profile Tasks:",
    `1. Create one diagnostic Task bound to promptProfile=${input.target.id} and expectedPackageDigest=${input.targetDigest}.`,
    "   Before dispatching any workflow node, the Task root orchestrator must use artifact_snapshot to publish exactly",
    "   case/acceptance.json and case/input.md from the immutable current project, then completely read and select both",
    "   resources so every projected worker can discover the exact frozen Case through the Task Artifact catalog.",
    "   It must execute the declared target workflow against that frozen synthetic Case and publish terminal domain evidence.",
    "2. Read the diagnostic Task's current terminal Completion Decision completely, then create a new Evolution Lab Task",
    "   with artifact_sources=[{authority:'completion_decision',source_task_id:<diagnostic Task ID>}]. The Host imports",
    "   that decision's complete deliverable_artifact_locators set; never copy or retype those locator IDs. Use workflow",
    "   evolution-opportunity-analysis. Visible worker outputs that are not declared deliverables are",
    "   evidence inside the source Task, not cross-Task import authority, and must not be added speculatively.",
    "   Complete both opportunity observation and causal attribution; names or terminal labels are not causal proof.",
    "3. Read the opportunity Task's current terminal Completion Decision completely and reference that completed Task",
    "   through artifact_sources authority=completion_decision in a new Evolution Lab Task using",
    "   evolution-candidate-preparation. Freeze exactly one development Case, one repetition, and an exact two-arm",
    "   run budget with max_runs=2 and max_cost=10 before authoring one",
    "   complete text-only candidate revision. Keep every tool, library, asset, scorer, Dataset, environment, permission,",
    "   and Evolution Lab byte frozen. Materialize the candidate in the immutable revision store without installing it.",
    "4. After the candidate digest exists, create exactly two evaluation Trial Tasks for the same frozen Case:",
    `   one baseline Task bound to ${input.target.id}/${input.targetDigest} and one candidate Task bound to the same`,
    "   manifest identity plus the exact candidate digest. Each Task must carry expectedPackageDigest explicitly.",
    "   Apart from arm revision and slot identity, model, environment, permissions, configuration, budget, workspace",
    "   template, Dataset bytes, request, and acceptance inputs must be identical. Do not reveal arm or score context to",
    "   either target Task.",
    "5. For the candidate and both Trial Tasks, completely read each current terminal Completion Decision and reference",
    "   each completed source Task through artifact_sources authority=completion_decision in a new Evolution Lab Task",
    "   using evolution-campaign-evaluation. Publish both run-evidence bundles, measured-or-typed-unavailable scorer",
    "   results, independent security/integrity review for every result, and one deterministic comparison recommendation.",
    "   The recommendation owner must then render that same strict recommendation as one document@1 decision report",
    "   and one chart@1 paired-delta visualization via publish_interactive_artifact. The document and chart are visible",
    "   renderings only; they must not invent or change decision facts, and the chart must label units and unavailable data.",
    "",
    "Freeze one required global judge scorer before any Trial with these exact semantics:",
    `- provider_id=${PROVIDER_ID}; model_id=${MODEL_ID}; streaming; retries=0; inactivity_timeout_ms=120000;`,
    "  max_evidence_bytes=65536; direction=higher_better; target=0.8; floor=0.6; weight=1; unit=ratio.",
    `- criteria: ${SCORER_CRITERIA}`,
    "- rubric: score 0 label unusable passes false anchor material requirements or evidence are absent;",
    "  score 0.5 label partial passes false anchor some requirements are met but the decision package is incomplete;",
    "  score 1 label accepted passes true anchor every acceptance item is evidenced and the result is decision-ready.",
    "Freeze the scorer revision as the SHA-256 of its exact canonical JSON configuration and keep it identical for both arms.",
    "Cost, token, activity duration, outcome, permission/side-effect, and unavailable facts must come from real run evidence.",
    "Required unavailable dimensions force aggregate_score=null and recommendation=inconclusive.",
    "",
    "Complete only after the comparison-recommendation Artifact is durably published and all Tasks are terminal.",
    "When creating a Task, omit panel.directory so the Host uses this Mission's immutable current project binding; never retype the project path into a panel call.",
  ].join("\n")
}

await fs.mkdir(runRoot, { recursive: false })
await Promise.all([
  fs.mkdir(projectDirectory, { recursive: true }),
  fs.mkdir(path.join(homeDirectory, "config"), { recursive: true }),
  fs.mkdir(path.join(homeDirectory, "data"), { recursive: true }),
  fs.mkdir(managedConfigDirectory, { recursive: true }),
])
for (const key of [
  "OPENCORVUS_API_KEY",
  "OPENCORVUS_CONFIG",
  "OPENCORVUS_CONFIG_CONTENT",
  "OPENCORVUS_CONFIG_DIR",
  "OPENCORVUS_DISABLE_PROJECT_CONFIG",
  "OPENCORVUS_EMBEDDED_DASHSCOPE_KEY",
  "OPENCORVUS_ENABLE_EXPERIMENTAL_MODELS",
  "OPENCORVUS_MODELS_PATH",
  "OPENCORVUS_MODELS_URL",
  "OPENCORVUS_PACKAGED_PLUGIN_DIR",
  "OPENCORVUS_SERVER_PASSWORD",
  "OPENCORVUS_SERVER_USERNAME",
]) {
  delete process.env[key]
}
process.env.OPENCORVUS_HOME = homeDirectory
process.env.OPENCORVUS_PROJECT_DIR = projectDirectory
process.env.OPENCORVUS_TEST_MANAGED_CONFIG_DIR = managedConfigDirectory
await writeJSON(path.join(homeDirectory, "config", "opencorvus.jsonc"), { model: MODEL, small_model: MODEL })
await fs.writeFile(
  path.join(projectDirectory, "README.md"),
  "# Isolated Expert Squad evolution acceptance project\n\nThis repository contains synthetic test inputs only.\n",
  "utf8",
)
await runCommand(["git", "init", "--initial-branch=main"], projectDirectory)
await runCommand(["git", "config", "user.name", "OpenCorvus Evolution E2E"], projectDirectory)
await runCommand(["git", "config", "user.email", "evolution-e2e@opencorvus.invalid"], projectDirectory)
await runCommand(["git", "add", "README.md"], projectDirectory)
await runCommand(["git", "commit", "-m", "test: initialize isolated evolution project"], projectDirectory)

const requests: EvolutionRequestFact[] = []
let server: ReturnType<typeof Bun.serve> | undefined
let allocatedPort: number | undefined
let pageURL: string | undefined
let selection: RandomSelection | undefined
let missionID: string | undefined
let missionSessionID: string | undefined
let latestStatus: MissionStatus | undefined
let installedTargetDigest: string | undefined
let installedEvolutionDigest: string | undefined
let productPillar: "code" | "work" | undefined
let abortMission: ((reason: string, signal: AbortSignal) => Promise<void>) | undefined
let disposeRuntime: (() => Promise<void>) | undefined
let isolatedAuthCopied = false
let modelCatalogReceipt: { bytes: number; sha256: string } | undefined
const resourceSettlementState = {
  runtimeDisposed: true,
  isolatedAuthRemoved: true,
}
let resourceSettlementOperation: Promise<typeof resourceSettlementState> | undefined
let resourceSettlementDeadlineOperation: ReturnType<typeof settleOperationWithinDeadline> | undefined

async function settleRunResources() {
  if (resourceSettlementOperation) return resourceSettlementOperation
  resourceSettlementState.runtimeDisposed = disposeRuntime === undefined
  resourceSettlementState.isolatedAuthRemoved = !isolatedAuthCopied
  resourceSettlementOperation = (async () => {
    const failures: unknown[] = []
    const settle = async (operation: () => Promise<void>, completed: () => void) => {
      try {
        await operation()
        completed()
      } catch (error) {
        failures.push(error)
      }
    }
    const operations: Promise<void>[] = []
    if (disposeRuntime) {
      const ownedDisposal = disposeRuntime
      operations.push(
        settle(ownedDisposal, () => {
          if (disposeRuntime === ownedDisposal) disposeRuntime = undefined
          resourceSettlementState.runtimeDisposed = true
        }),
      )
    }
    if (isolatedAuthCopied) {
      operations.push(
        settle(
          () => fs.rm(isolatedAuthPath),
          () => {
            isolatedAuthCopied = false
            resourceSettlementState.isolatedAuthRemoved = true
          },
        ),
      )
    }
    await Promise.all(operations)
    if (failures.length === 1) throw failures[0]
    if (failures.length > 1) throw new AggregateError(failures, "Evolution E2E resource settlement failed")
    return resourceSettlementState
  })()
  return resourceSettlementOperation
}

function settleRunResourcesWithinDeadline() {
  resourceSettlementDeadlineOperation ??= settleOperationWithinDeadline({
    operation: async () => {
      await settleRunResources()
    },
    timeoutMs: RESOURCE_SETTLEMENT_TIMEOUT_MS,
    label: "Evolution E2E resource settlement",
  })
  return resourceSettlementDeadlineOperation
}

try {
  if (PROVIDER_HANDOFF.models) {
    const source = await fs.stat(globalModelsSourcePath)
    if (!source.isFile()) throw new Error("Global OpenCorvus model catalog source must be a regular file")
    await fs.copyFile(globalModelsSourcePath, isolatedModelsPath)
    const sha256 = createHash("sha256")
      .update(await fs.readFile(isolatedModelsPath))
      .digest("hex")
    modelCatalogReceipt = { bytes: source.size, sha256 }
    await appendEvent("provider.models.staged", {
      source: "canonical-global-model-catalog",
      destination: "isolated-runtime-data",
      bytes: source.size,
      sha256,
    })
  }
  if (COPY_GLOBAL_AUTH) {
    const source = await fs.stat(globalAuthSourcePath)
    if (!source.isFile()) throw new Error("Global OpenCorvus auth source must be a regular file")
    await fs.copyFile(globalAuthSourcePath, isolatedAuthPath)
    await fs.chmod(isolatedAuthPath, 0o600)
    isolatedAuthCopied = true
    await appendEvent("provider.auth.staged", {
      providerID: PROVIDER_ID,
      source: "canonical-global-auth",
      destination: "isolated-runtime-data",
      bytes: source.size,
    })
  }
  const overlayDirectory = path.resolve(import.meta.dir, "..", "..", "overlay")
  await runCommand(
    ["bun", "run", "build:vite", "--", "--outDir", overlayBuildDirectory, "--manifest", overlayManifestRelativePath],
    overlayDirectory,
  )

  const [{ Server }, { freezeOverlayUiDirectory }, { declareNativeTaskProcessDeployment }, { Instance }, { Database }] =
    await Promise.all([
      import("../src/server/server"),
      import("../src/server/overlay-ui"),
      import("../src/runtime/task-process-deployment"),
      import("../src/project/instance"),
      import("../src/storage/db"),
    ])
  const overlayUiSource = freezeOverlayUiDirectory({
    directory: overlayBuildDirectory,
    manifestPath: overlayManifestRelativePath,
    requiredStaticDirectories: ["i18n", "licenses"],
  })
  await appendEvent("ui.compiled", {
    directory: overlayBuildDirectory,
    mode: "per-run-vite-production-assets",
    source_identity: overlayUiSource.identity,
    index_sha256: overlayUiSource.indexSHA256,
    manifest_sha256: overlayUiSource.manifestSHA256,
    asset_closure_sha256: overlayUiSource.assetClosureSHA256,
    asset_count: overlayUiSource.assetCount,
  })
  declareNativeTaskProcessDeployment()
  server = Server.listen({
    hostname: "127.0.0.1",
    port: 0,
    randomPort: true,
    overlayUiSource,
  })
  allocatedPort = server.port
  const origin = `http://127.0.0.1:${allocatedPort}`
  pageURL = `${origin}/ui/`
  disposeRuntime = async () => {
    const cleanupFailures: unknown[] = []
    try {
      await server?.stop(true)
    } catch (error) {
      cleanupFailures.push(error)
      try {
        await Instance.disposeAll()
      } catch (disposeError) {
        cleanupFailures.push(disposeError)
      }
    }
    try {
      Database.close()
    } catch (error) {
      cleanupFailures.push(error)
    }
    if (cleanupFailures.length === 1) throw cleanupFailures[0]
    if (cleanupFailures.length > 1) {
      throw new AggregateError(cleanupFailures, "Evolution E2E runtime cleanup failed")
    }
  }

  if (USER_DRIVEN) await appendEvent("ui.started", { pageURL, servingProcess: "isolated-dev-backend" })

  async function request(route: string, init: RequestInit = {}) {
    const started = Date.now()
    const headers = new Headers(init.headers)
    headers.set("x-opencorvus-directory", projectDirectory)
    headers.set("x-opencorvus-request-id", crypto.randomUUID())
    const response = await fetch(`${origin}${route}`, { ...init, headers })
    requests.push({ method: init.method ?? "GET", route, status: response.status, durationMs: Date.now() - started })
    return response
  }

  async function requestJSON(route: string, init: RequestInit = {}) {
    const response = await request(route, init)
    const text = await response.text()
    if (!response.ok)
      throw new Error(`${init.method ?? "GET"} ${route} returned ${response.status}: ${boundedBody(text)}`)
    return JSON.parse(text) as JsonObject
  }

  async function postJSON(route: string, body: JsonObject) {
    return requestJSON(route, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  async function waitForUserAction<T>(label: string, observe: () => Promise<T | undefined>) {
    const deadline = Date.now() + USER_ACTION_TIMEOUT_MS
    for (;;) {
      const observed = await observe()
      if (observed !== undefined) return observed
      if (Date.now() >= deadline) throw new Error(`Timed out waiting for real page action: ${label}`)
      await Bun.sleep(POLL_INTERVAL_MS)
    }
  }

  async function readArtifact(taskID: string, locator: Record<string, unknown>) {
    const chunks: Uint8Array[] = []
    let byteOffset = 0
    for (;;) {
      const response = await request(taskRoute(taskID, "artifact-read"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ locator, byte_offset: byteOffset, max_bytes: 65_536 }),
      })
      const text = await response.text()
      if (!response.ok) {
        throw new Error(`Artifact read for ${taskID} returned ${response.status}: ${boundedBody(text)}`)
      }
      const bytes = new TextEncoder().encode(text)
      chunks.push(bytes)
      byteOffset += bytes.byteLength
      if (response.headers.get("x-opencorvus-content-complete") === "1") break
      if (bytes.byteLength === 0) throw new Error(`Artifact read for ${taskID} made no byte progress`)
    }
    const combined = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.byteLength, 0))
    let offset = 0
    for (const chunk of chunks) {
      combined.set(chunk, offset)
      offset += chunk.byteLength
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(combined)) as JsonObject
  }

  async function collectTerminalFacts(status: MissionStatus) {
    const artifacts = new Map<string, EvolutionArtifactFact>()
    const tasks: JsonObject[] = []
    const addArtifact = async (taskID: string, locator: Record<string, unknown>) => {
      const identity = `${taskID}\0${JSON.stringify(locator)}`
      if (artifacts.has(identity)) return
      artifacts.set(identity, { taskID, locator, envelope: await readArtifact(taskID, locator) })
    }
    for (const statusTask of status.tasks) {
      const task = await requestJSON(taskRoute(statusTask.taskID))
      tasks.push(task)
      if (!(["completed", "failed", "cancelled"] as string[]).includes(statusTask.lifecycleStatus)) continue
      const turns = (await requestJSON(taskRoute(statusTask.taskID, "turn-artifacts"))) as unknown as Array<JsonObject>
      for (const turn of turns) {
        for (const declared of (turn.declaredOutputs as Array<JsonObject> | undefined) ?? []) {
          const artifactType = declared.artifactType
          const locator = declared.declarationLocator
          if (typeof artifactType !== "string" || !artifactType.startsWith("evolution-lab/")) continue
          if (!locator || typeof locator !== "object") continue
          await addArtifact(statusTask.taskID, locator as Record<string, unknown>)
        }
      }
    }
    for (const fact of [...artifacts.values()]) {
      const envelope = fact.envelope as JsonObject
      if (envelope.artifact_type !== "evolution-lab/comparison-recommendation") continue
      for (const locator of (envelope.source_artifact_locators as Array<Record<string, unknown>> | undefined) ?? []) {
        await addArtifact(fact.taskID, locator)
      }
    }
    return { tasks, artifacts: [...artifacts.values()] }
  }

  async function collectRecommendationRenderings(input: { taskID: string; sessionID: string }) {
    const transcript = (await requestJSON(taskRoute(input.taskID, "transcript"))) as unknown as Array<JsonObject>
    const artifactIDs = recommendationInteractiveArtifactIDs(transcript, input.sessionID)
    const records = []
    for (const artifactID of [...new Set(artifactIDs)]) {
      const record = await requestJSON(
        `/session/${encodeURIComponent(input.sessionID)}/interactive-artifact/${encodeURIComponent(artifactID)}`,
      )
      records.push(InteractiveArtifactRecord.parse(record))
    }
    const document = records.find((record) => record.payload.renderer === "document@1")
    const chart = records.find((record) => record.payload.renderer === "chart@1")
    if (!document || !chart) {
      throw new Error(
        `Recommendation Session render closure is incomplete: document=${Boolean(document)} chart=${Boolean(chart)}`,
      )
    }
    return records.map((record) => ({
      id: record.id,
      session_id: record.sessionID,
      message_id: record.messageID,
      renderer: record.payload.renderer,
      title: record.payload.title,
    }))
  }

  abortMission = async (reason: string, signal: AbortSignal) => {
    if (!missionID) return
    await requestJSON(`/mission/${encodeURIComponent(missionID)}/abort`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(missionAbortRequest(reason)),
      signal,
    })
  }

  await appendEvent("backend.started", {
    runID,
    pid: process.pid,
    port: allocatedPort,
    projectDirectory,
    databasePath,
    homeDirectory,
  })

  const providerCatalog = await requestJSON("/provider")
  const providerProjection = (providerCatalog.all as Array<JsonObject>).find((entry) => entry.id === PROVIDER_ID)
  const projectedModelIDs = providerProjection
    ? Object.keys((providerProjection.models as Record<string, unknown> | undefined) ?? {})
    : []
  const providerTestResponse = await request(`/provider/${encodeURIComponent(PROVIDER_ID)}/test`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ modelID: MODEL_ID }),
  })
  const providerTest = (await providerTestResponse.json()) as JsonObject
  if (!providerTestResponse.ok || providerTest.ok !== true || providerTest.status !== "connected") {
    const issues = (providerCatalog.issues as Array<JsonObject>).filter((issue) => issue.providerID === PROVIDER_ID)
    throw new Error(
      `Provider preflight failed: ${JSON.stringify(providerTest)}; ` +
        `catalog=${JSON.stringify({
          connected: (providerCatalog.connected as string[]).includes(PROVIDER_ID),
          projected: providerProjection !== undefined,
          requested_model_projected: projectedModelIDs.includes(MODEL_ID),
          projected_model_count: projectedModelIDs.length,
          issues,
        })}`,
    )
  }
  await appendEvent("provider.connected", { providerID: PROVIDER_ID, modelID: MODEL_ID })

  const marketEntries: MarketEntry[] = []
  let marketCursor: string | null = null
  let marketRevision: string | undefined
  do {
    const query = new URLSearchParams({ availability: "available", limit: "20" })
    if (marketCursor) query.set("cursor", marketCursor)
    const page = await requestJSON(`/expert-squad/market?${query}`)
    if (marketRevision && page.catalog_revision !== marketRevision) {
      throw new Error("Expert Squad Market catalog revision changed during random selection")
    }
    marketRevision = page.catalog_revision as string
    marketEntries.push(...(page.entries as MarketEntry[]))
    marketCursor = page.next_cursor as string | null
  } while (marketCursor)

  const seedHex = process.env.EXPERT_SQUAD_EVOLUTION_SEED?.trim().toLowerCase() || randomBytes(32).toString("hex")
  selection = selectRandomEvolutionTarget(marketEntries, seedHex)
  await appendEvent("market.selected", {
    catalogRevision: marketRevision,
    algorithm: selection.algorithm,
    seedHex: selection.seedHex,
    poolSHA256: selection.poolSHA256,
    poolCount: selection.poolCount,
    counter: selection.counter,
    index: selection.index,
    selected: `${selection.selected.namespace}/${selection.selected.id}@${selection.selected.version}`,
  })

  const targetMarketDetail = await requestJSON(
    `/expert-squad/market/detail?id=${encodeURIComponent(selection.selected.id)}`,
  )
  if (USER_DRIVEN) {
    await appendEvent("user.install.required", {
      origin,
      pageURL,
      targetID: selection.selected.id,
      targetIdentity: `${selection.selected.namespace}/${selection.selected.id}@${selection.selected.version}`,
      companionID: "evolution-lab",
      installationScope: "project",
    })
    const installed = await waitForUserAction("install random target and Evolution Lab", async () => {
      const [targetDetail, evolutionDetail] = await Promise.all([
        requestJSON(`/expert-squad/market/detail?id=${encodeURIComponent(selection!.selected.id)}`),
        requestJSON("/expert-squad/market/detail?id=evolution-lab"),
      ])
      const projectInstall = (detail: JsonObject) =>
        (detail.installations as Array<JsonObject>).find((entry) => entry.installation_scope === "project")
      const target = projectInstall(targetDetail)
      const evolution = projectInstall(evolutionDetail)
      return target && evolution
        ? {
            targetDigest: target.installed_package_digest as string,
            evolutionDigest: evolution.installed_package_digest as string,
          }
        : undefined
    })
    installedTargetDigest = installed.targetDigest
    installedEvolutionDigest = installed.evolutionDigest
  } else {
    const targetInstall = await postJSON("/expert-squad/install-payload", {
      id: selection.selected.id,
      installationScope: "project",
    })
    const targetReceipt = targetInstall.after as JsonObject
    installedTargetDigest = targetReceipt.packageDigest as string
    const evolutionInstall = await postJSON("/expert-squad/install-payload", {
      id: "evolution-lab",
      installationScope: "project",
    })
    const evolutionReceipt = evolutionInstall.after as JsonObject
    installedEvolutionDigest = evolutionReceipt.packageDigest as string
  }
  if (typeof installedTargetDigest !== "string" || !/^[a-f0-9]{64}$/.test(installedTargetDigest)) {
    throw new Error("Random Market target installation returned an invalid project revision")
  }
  if (typeof installedEvolutionDigest !== "string" || !/^[a-f0-9]{64}$/.test(installedEvolutionDigest)) {
    throw new Error("Evolution Lab installation returned an invalid project revision")
  }

  const installedTargetDetail = await requestJSON(
    `/expert-squad/market/detail?id=${encodeURIComponent(selection.selected.id)}`,
  )
  const targetInstallation = (installedTargetDetail.installations as Array<JsonObject>).find(
    (entry) => entry.installation_scope === "project",
  )
  if (targetInstallation?.installed_package_digest !== installedTargetDigest) {
    throw new Error("Random Market target detail did not converge to its installation receipt")
  }
  const settings = await requestJSON(
    `/expert-squad/settings/detail?directory=${encodeURIComponent(projectDirectory)}` +
      `&namespace=${encodeURIComponent(selection.selected.namespace)}` +
      `&id=${encodeURIComponent(selection.selected.id)}&installationScope=project`,
  )
  const selectedSettings = settings.selected as JsonObject
  const productPillars = selectedSettings.product_pillars as string[]
  productPillar = productPillars.includes("work") ? "work" : "code"
  if (!productPillars.includes(productPillar)) throw new Error("Installed target has no compatible product pillar")

  const activeCatalog = await requestJSON("/expert-squad/catalog")
  const activeProjection = activeCatalog.active_skill_projection as JsonObject
  if (activeProjection.active_squad_id !== "base") {
    throw new Error(
      `Market installation changed the active Expert Squad to ${String(activeProjection.active_squad_id)}`,
    )
  }
  await appendEvent("packages.installed", {
    targetID: selection.selected.id,
    targetDigest: installedTargetDigest,
    targetAgents: (targetMarketDetail.agents as unknown[]).length,
    targetSkills: targetMarketDetail.skill_count,
    evolutionDigest: installedEvolutionDigest,
    productPillar,
    activeSquadID: activeProjection.active_squad_id,
  })
  const currentProject = await requestJSON("/project/current")
  if (typeof currentProject.id !== "string" || currentProject.worktree !== projectDirectory) {
    throw new Error("Current project identity does not match the isolated project directory")
  }

  await fs.mkdir(path.join(projectDirectory, "case"), { recursive: true })
  await fs.mkdir(path.join(projectDirectory, "subject"), { recursive: true })
  const caseInputPath = path.join(projectDirectory, "case", "input.md")
  const datasetManifestPath = path.join(projectDirectory, "case", "acceptance.json")
  const subjectModulePath = path.join(projectDirectory, "subject", "decision-ledger.mjs")
  const subjectReproductionPath = path.join(projectDirectory, "subject", "reproduce.mjs")
  await fs.writeFile(
    subjectModulePath,
    [
      "export function remainingBudget(total, allocations) {",
      "  return total - allocations.slice(0, -1).reduce((sum, value) => sum + value, 0)",
      "}",
      "",
    ].join("\n"),
    "utf8",
  )
  await fs.writeFile(
    subjectReproductionPath,
    [
      'import { remainingBudget } from "./decision-ledger.mjs"',
      "",
      "const actual = remainingBudget(100_000, [40_000, 35_000, 25_000])",
      "const expected = 0",
      "if (actual !== expected) {",
      '  console.error(JSON.stringify({ status: "failed", expected, actual }))',
      "  process.exit(1)",
      "}",
      'console.log(JSON.stringify({ status: "passed", expected, actual }))',
      "",
    ].join("\n"),
    "utf8",
  )
  await fs.writeFile(
    caseInputPath,
    [
      "# Synthetic acceptance case",
      "",
      `Target Expert Squad: ${selection.selected.namespace}/${selection.selected.id}`,
      `Declared purpose: ${selection.selected.description}`,
      `Selector summary: ${String(targetMarketDetail.selector_summary)}`,
      "Concrete review target: subject/decision-ledger.mjs at the frozen repository revision.",
      "Reproduction command: node subject/reproduce.mjs",
      "Observed baseline: the command exits 1 and reports actual remaining budget 25000; expected is 0.",
      "",
      "A hypothetical mid-sized organization needs a bounded, professional, decision-ready package that demonstrates",
      "the target Squad's declared purpose. Use only the facts in this file and explicitly labelled assumptions.",
      "",
      "Synthetic facts:",
      "- Decision horizon: 30 calendar days.",
      "- Available implementation budget: 100,000 synthetic currency units.",
      "- The organization requires named owners, evidence provenance, measurable acceptance, and a reversible first step.",
      "- No production system, person, credential, customer, regulated record, or external service may be contacted.",
      "- Unknown domain facts must remain unknown; do not invent a jurisdiction, measurement, source, or observed outcome.",
      "",
      "Deliver the package through the target Squad's canonical Artifact workflow.",
    ].join("\n"),
    "utf8",
  )
  const syntheticCaseInputIdentity = await fileResourceIdentity(caseInputPath, "case/input.md", "text/plain")
  await writeJSON(datasetManifestPath, {
    schema_version: 1,
    dataset_partition: "development",
    cases: [
      {
        case_id: "synthetic-random-domain-v1",
        resource: syntheticCaseInputIdentity,
      },
    ],
    required: [
      "decision statement tied to the declared purpose",
      "fact, assumption, and unknown separation",
      "evidence and provenance register",
      "prioritized 30-day actions with named owners",
      "budget allocation bounded by 100000",
      "measurable acceptance criteria and residual risks",
      "reversible first step and explicit no-external-side-effect confirmation",
      "execute node subject/reproduce.mjs and preserve its exact observed exit/output as evidence",
      "identify the concrete review target and trace the defect through subject/decision-ledger.mjs",
    ],
  })
  const syntheticDatasetIdentity = await fileResourceIdentity(
    datasetManifestPath,
    "case/acceptance.json",
    "application/json",
  )
  const campaignDirectory = path.join(projectDirectory, "campaign")
  await fs.mkdir(campaignDirectory, { recursive: true })
  const modelConfigurationPath = path.join(campaignDirectory, "model-configuration.json")
  const environmentPath = path.join(campaignDirectory, "environment.json")
  const workspaceTemplatePath = path.join(campaignDirectory, "workspace-template.json")
  const permissionSnapshotPath = path.join(campaignDirectory, "permission-snapshot.json")
  const scorerAssetPath = path.join(campaignDirectory, "global-judge.json")
  await writeCanonicalJSON(modelConfigurationPath, {
    schema_version: 1,
    provider_id: PROVIDER_ID,
    model_id: MODEL_ID,
    streaming: true,
    retries: 0,
    inactivity_timeout_ms: 120_000,
    max_evidence_bytes: 65_536,
  })
  await writeCanonicalJSON(environmentPath, {
    schema_version: 1,
    runtime: "isolated-opencorvus-development",
    platform: process.platform,
    architecture: process.arch,
    product_pillar: productPillar,
    external_side_effects: "none",
    production_actions: false,
  })
  const workspaceSnapshot = {
    protocol: "opencorvus/workspace-tree@1" as const,
    files: [
      {
        path: "case/acceptance.json",
        bytes_base64: (await fs.readFile(datasetManifestPath)).toString("base64"),
      },
      {
        path: "case/input.md",
        bytes_base64: (await fs.readFile(caseInputPath)).toString("base64"),
      },
      {
        path: "subject/decision-ledger.mjs",
        bytes_base64: (await fs.readFile(subjectModulePath)).toString("base64"),
      },
      {
        path: "subject/reproduce.mjs",
        bytes_base64: (await fs.readFile(subjectReproductionPath)).toString("base64"),
      },
    ],
  }
  await fs.writeFile(workspaceTemplatePath, canonicalWorkspaceTreeJSON(workspaceSnapshot), "utf8")
  await writeCanonicalJSON(permissionSnapshotPath, {
    schema_version: 1,
    assurance: "required_only",
    external_side_effects: "none",
    production_actions: false,
    granted_permissions: [],
  })
  await writeCanonicalJSON(scorerAssetPath, {
    schema_version: 1,
    scorer_id: "global-judge",
    evaluator_kind: "judge",
    provider_id: PROVIDER_ID,
    model_id: MODEL_ID,
    streaming: true,
    retries: 0,
    inactivity_timeout_ms: 120_000,
    max_evidence_bytes: 65_536,
    direction: "higher_better",
    target: 0.8,
    floor: 0.6,
    weight: 1,
    unit: "ratio",
    observation_class: "quality",
    criteria: SCORER_CRITERIA,
    rubric: [
      { score: 0, label: "unusable", passes: false, anchor: "Material requirements or evidence are absent." },
      {
        score: 0.5,
        label: "partial",
        passes: false,
        anchor: "Some requirements are met but the decision package is incomplete.",
      },
      {
        score: 1,
        label: "accepted",
        passes: true,
        anchor: "Every acceptance item is evidenced and the result is decision-ready.",
      },
    ],
  })
  const frozenInputs: FrozenCampaignInputClosure = {
    dataset: syntheticDatasetIdentity,
    caseResource: syntheticCaseInputIdentity,
    modelConfiguration: await fileResourceIdentity(
      modelConfigurationPath,
      "campaign/model-configuration.json",
      "application/json",
    ),
    environment: await fileResourceIdentity(environmentPath, "campaign/environment.json", "application/json"),
    workspaceTemplate: await fileResourceIdentity(
      workspaceTemplatePath,
      "campaign/workspace-template.json",
      "application/json",
    ),
    workspaceDigest: workspaceTreeDigest(workspaceSnapshot),
    permissionSnapshot: await fileResourceIdentity(
      permissionSnapshotPath,
      "campaign/permission-snapshot.json",
      "application/json",
    ),
    scorerAsset: await fileResourceIdentity(scorerAssetPath, "campaign/global-judge.json", "application/json"),
    scorerRevision: "",
  }
  frozenInputs.scorerRevision = frozenInputs.scorerAsset.sha256
  await runCommand(["git", "add", "case", "campaign", "subject"], projectDirectory)
  await runCommand(["git", "commit", "-m", "test: freeze synthetic evolution case"], projectDirectory)
  const projectCommit = await runCommand(["git", "rev-parse", "HEAD"], projectDirectory)
  const projectTree = await runCommand(["git", "rev-parse", "HEAD^{tree}"], projectDirectory)

  const missionRequest = campaignPrompt({
    target: selection.selected,
    targetDigest: installedTargetDigest,
    targetSelectorSummary: String(targetMarketDetail.selector_summary),
    evolutionDigest: installedEvolutionDigest,
    productPillar,
    projectID: currentProject.id,
    projectDirectory,
    frozenInputs,
  })
  await fs.writeFile(missionRequestPath, `${missionRequest}\n`, "utf8")
  const wake = USER_DRIVEN
    ? await (async () => {
        await appendEvent("user.mission.required", {
          origin,
          pageURL,
          missionRequestPath,
          model: MODEL,
          productPillar,
          expertSquadIDs: [selection!.selected.id, "evolution-lab"],
        })
        return waitForUserAction("submit the frozen Mission from the real page", async () => {
          const missions = (await requestJSON(
            missionCollectionRoute(projectDirectory, 20),
          )) as unknown as Array<JsonObject>
          const mission = missions.find(
            (entry) =>
              typeof entry.missionID === "string" &&
              typeof entry.sessionID === "string" &&
              entry.productPillar === productPillar,
          )
          return mission
            ? { missionID: mission.missionID as string, sessionID: mission.sessionID as string }
            : undefined
        })
      })()
    : await postJSON("/mission/wake", {
        text: missionRequest,
        model: MODEL,
        productPillar,
        expertSquadIDs: [selection.selected.id, "evolution-lab"],
      })
  missionID = wake.missionID as string
  missionSessionID = wake.sessionID as string
  const missionSession = await requestJSON(`/session/${encodeURIComponent(missionSessionID)}`)
  const heldExpertSquadIDs = ((missionSession.metadata as JsonObject | undefined)?.mission as JsonObject | undefined)
    ?.visibleExpertSquadIDs
  const actualExpertSquadIDs = Array.isArray(heldExpertSquadIDs)
    ? heldExpertSquadIDs.filter((value): value is string => typeof value === "string")
    : []
  const expectedExpertSquadIDs = [selection.selected.id, "evolution-lab"]
  if (
    actualExpertSquadIDs.length !== expectedExpertSquadIDs.length ||
    expectedExpertSquadIDs.some((id) => !actualExpertSquadIDs.includes(id))
  ) {
    throw new Error(
      `Mission held Expert Squad set does not match the frozen request: expected ${expectedExpertSquadIDs.join(", ")}; actual ${actualExpertSquadIDs.join(", ") || "none"}`,
    )
  }
  await appendEvent("mission.started", {
    missionID,
    missionSessionID,
    projectCommit,
    projectTree,
    expertSquadIDs: actualExpertSquadIDs,
  })

  let deadline: ActivityDeadline | undefined
  let lastStatusSignature = ""
  let terminalFacts: Awaited<ReturnType<typeof collectTerminalFacts>> | undefined
  for (;;) {
    const observedAtMs = Date.now()
    const cursor = await requestJSON(`/mission/${encodeURIComponent(missionID)}/activity-cursor`)
    deadline = observeActivityDeadline({
      previous: deadline,
      activitySHA256: cursor.activity_sha256 as string,
      observedAtMs,
      inactivityWindowMs: INACTIVITY_WINDOW_MS,
    })
    latestStatus = (await requestJSON(`/mission/${encodeURIComponent(missionID)}/status`)) as unknown as MissionStatus
    const statusSignature = JSON.stringify({
      status: latestStatus.status,
      tasks: latestStatus.tasks.map((task) => [task.taskID, task.lifecycleStatus, task.error ?? null]),
    })
    if (statusSignature !== lastStatusSignature) {
      lastStatusSignature = statusSignature
      await appendEvent("mission.status", {
        missionID,
        status: latestStatus.status,
        taskCounts: latestStatus.taskCounts,
        tasks: latestStatus.tasks.map((task) => ({
          id: task.taskID,
          title: task.title,
          lifecycleStatus: task.lifecycleStatus,
          error: task.error,
        })),
        activitySHA256: deadline.activitySHA256,
        inactivityDeadlineMs: deadline.deadlineMs,
      })
    }

    for (const task of latestStatus.tasks) {
      const interactions = (await requestJSON(taskRoute(task.taskID, "interactions"))) as unknown as Array<JsonObject>
      const pending = interactions.filter((interaction) => interaction.status === "pending")
      if (pending.length > 0) {
        throw new Error(`Task ${task.taskID} requested ${pending.length} interaction(s) during no-intervention E2E`)
      }
      if (task.lifecycleStatus === "failed" || task.lifecycleStatus === "cancelled") {
        throw new Error(`Task ${task.taskID} ended ${task.lifecycleStatus}: ${task.error ?? "no typed error"}`)
      }
    }

    const allTasksTerminal =
      latestStatus.tasks.length > 0 &&
      latestStatus.tasks.every((task) => ["completed", "failed", "cancelled"].includes(task.lifecycleStatus))
    if (latestStatus.status === "inactive" && allTasksTerminal) {
      terminalFacts = await collectTerminalFacts(latestStatus)
      try {
        summarizeEvolutionEvidence(terminalFacts.artifacts)
        break
      } catch {
        // Mission lifecycle delivery may schedule the next stage after a brief inactive projection.
      }
    }

    if (Date.now() >= deadline.deadlineMs) {
      const finalCursor = await requestJSON(`/mission/${encodeURIComponent(missionID)}/activity-cursor`)
      const finalDeadline = observeActivityDeadline({
        previous: deadline,
        activitySHA256: finalCursor.activity_sha256 as string,
        observedAtMs: Date.now(),
        inactivityWindowMs: INACTIVITY_WINDOW_MS,
      })
      if (finalDeadline.deadlineMs === deadline.deadlineMs && Date.now() >= finalDeadline.deadlineMs) {
        throw new Error(`Mission produced no durable activity for ${INACTIVITY_WINDOW_MS}ms`)
      }
      deadline = finalDeadline
    }
    await Bun.sleep(POLL_INTERVAL_MS)
  }

  const evidence = summarizeEvolutionEvidence(terminalFacts!.artifacts)
  assertRandomEvolutionCampaignContract(evidence.campaign.payload, {
    caseID: "synthetic-random-domain-v1",
    dataset: syntheticDatasetIdentity,
    caseResource: syntheticCaseInputIdentity,
    modelConfiguration: frozenInputs.modelConfiguration,
    environment: frozenInputs.environment,
    workspaceTemplate: frozenInputs.workspaceTemplate,
    workspaceDigest: frozenInputs.workspaceDigest,
    permissionSnapshot: frozenInputs.permissionSnapshot,
    scorerAsset: frozenInputs.scorerAsset,
    scorerID: "global-judge",
    scorerRevision: frozenInputs.scorerRevision,
    projectID: currentProject.id,
    projectDirectory,
    targetNamespace: selection.selected.namespace,
    targetID: selection.selected.id,
    baselineDigest: installedTargetDigest,
    model: MODEL,
    maxRuns: 2,
    maxCost: 10,
  })
  const recommendationEnvelope = evidence.recommendation.envelope as JsonObject
  if (recommendationEnvelope.artifact_type !== "evolution-lab/comparison-recommendation") {
    throw new Error("Terminal recommendation locator returned the wrong Artifact type")
  }
  const recommendationProducer = recommendationEnvelope.producer as JsonObject | undefined
  if (typeof recommendationProducer?.session_id !== "string") {
    throw new Error("Terminal recommendation has no producing Session identity")
  }
  const recommendationRenderings = await collectRecommendationRenderings({
    taskID: evidence.recommendation.taskID,
    sessionID: recommendationProducer.session_id,
  })
  if (USER_DRIVEN) {
    await appendEvent("user.render-review.required", {
      page_url: pageURL,
      task_id: evidence.recommendation.taskID,
      session_id: recommendationProducer.session_id,
      renderings: recommendationRenderings,
      receipt_path: renderReviewReceiptPath,
    })
    await waitForUserAction("inspect the recommendation document and chart in the real Overlay page", async () => {
      const receipt = await fs
        .readFile(renderReviewReceiptPath, "utf8")
        .then((value) => JSON.parse(value) as JsonObject)
        .catch(() => undefined)
      if (
        receipt?.task_id !== evidence.recommendation.taskID ||
        receipt?.session_id !== recommendationProducer.session_id ||
        receipt?.document_reviewed !== true ||
        receipt?.chart_reviewed !== true
      ) {
        return undefined
      }
      return receipt
    })
  }
  const candidatePayload = evidence.candidate.payload as JsonObject
  const parentRevision = candidatePayload.parent_revision as JsonObject
  const candidateRevision = candidatePayload.candidate_revision as JsonObject
  if (parentRevision.package_digest !== installedTargetDigest) {
    throw new Error("Candidate parent revision differs from the installed random target")
  }
  if (
    typeof candidateRevision.package_digest !== "string" ||
    candidateRevision.package_digest === installedTargetDigest
  ) {
    throw new Error("Candidate revision did not produce a distinct immutable package digest")
  }

  const targetTaskDigests = terminalFacts!.tasks.flatMap((task) => {
    const binding = task.packageRevisionBinding as JsonObject | undefined
    return binding?.id === selection.selected.id && typeof binding.package_digest === "string"
      ? [binding.package_digest]
      : []
  })
  const baselineOccurrences = targetTaskDigests.filter((digest) => digest === installedTargetDigest).length
  const candidateOccurrences = targetTaskDigests.filter((digest) => digest === candidateRevision.package_digest).length
  if (baselineOccurrences < 2 || candidateOccurrences < 1) {
    throw new Error(
      `Target Trial revision evidence is incomplete: baseline=${baselineOccurrences}, candidate=${candidateOccurrences}`,
    )
  }

  const postRunDetail = await requestJSON(`/expert-squad/market/detail?id=${encodeURIComponent(selection.selected.id)}`)
  const postRunInstallation = (postRunDetail.installations as Array<JsonObject>).find(
    (entry) => entry.installation_scope === "project",
  )
  const postRunCatalog = await requestJSON("/expert-squad/catalog")
  const postRunActive = (postRunCatalog.active_skill_projection as JsonObject).active_squad_id
  if (postRunInstallation?.installed_package_digest !== installedTargetDigest || postRunActive !== "base") {
    throw new Error("Evolution campaign mutated the installed or active production Expert Squad without authorization")
  }

  const databaseIdentity = Database.Identity()
  const completedPort = allocatedPort
  const resourceSettlement = await settleRunResourcesWithinDeadline()
  if (resourceSettlement.status !== "settled") {
    throw new Error(resourceSettlement.error)
  }
  const settlement = { ...resourceSettlementState }
  await appendEvent("runtime.disposed", {
    pid: process.pid,
    port: completedPort,
    listenerStopped: settlement.runtimeDisposed,
    instancesSettled: settlement.runtimeDisposed,
    databaseClosed: settlement.runtimeDisposed,
    isolatedAuthRemoved: settlement.isolatedAuthRemoved,
    uiServedByBackend: true,
  })
  const result = {
    schema_version: 1,
    outcome: "passed",
    run_id: runID,
    isolation: {
      pid: process.pid,
      port: completedPort,
      home_directory: homeDirectory,
      project_directory: projectDirectory,
      database_path: databasePath,
      database_identity: databaseIdentity,
      project_commit: projectCommit,
      project_tree: projectTree,
      runtime_cleanup: {
        listener_stopped_before_acceptance: true,
        instances_settled_before_acceptance: true,
        database_closed_before_acceptance: true,
        isolated_auth_removed_before_acceptance: settlement.isolatedAuthRemoved,
      },
      page_url: pageURL,
    },
    provider: {
      provider_id: PROVIDER_ID,
      model_id: MODEL_ID,
      connection: "connected",
      auth_handoff: COPY_GLOBAL_AUTH ? "isolated-copy-removed" : "environment-or-runtime-config",
      model_catalog: modelCatalogReceipt ?? { source: "bundled-bootstrap" },
    },
    random_selection: selection,
    installation: {
      target_digest: installedTargetDigest,
      evolution_lab_digest: installedEvolutionDigest,
      installation_scope: "project",
      active_squad_id: postRunActive,
    },
    mission: {
      mission_id: missionID,
      session_id: missionSessionID,
      product_pillar: productPillar,
      task_count: latestStatus!.tasks.length,
      tasks: terminalFacts!.tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        package_revision_binding: task.packageRevisionBinding,
      })),
    },
    evidence: {
      counts: evidence.counts,
      candidate_revision: candidateRevision,
      baseline_target_task_occurrences: baselineOccurrences,
      candidate_target_task_occurrences: candidateOccurrences,
      recommendation: recommendationProjection(recommendationEnvelope),
      recommendation_renderings: recommendationRenderings,
    },
    request_summary: summarizeEvolutionRequests(requests),
  }
  await writeJSON(resultPath, result)
  await appendEvent("run.passed", {
    resultPath,
    recommendation: (recommendationEnvelope.payload as JsonObject).recommendation,
    candidateDigest: candidateRevision.package_digest,
    taskCount: latestStatus!.tasks.length,
  })
  console.log(`RUN_RESULT ${JSON.stringify({ outcome: "passed", runRoot, resultPath })}`)
} catch (error) {
  await appendEvent("run.failed", { error: errorMessage(error) }).catch(() => {})
  let failureResourceSettlement: Awaited<ReturnType<typeof settleRunResourcesWithinDeadline>> | undefined
  await settleFailureAfterBoundedAbort({
    abortMission: abortMission
      ? (signal) => abortMission!(`Automated evolution E2E failed: ${errorMessage(error)}`, signal)
      : undefined,
    abortTimeoutMs: FAILURE_ABORT_TIMEOUT_MS,
    settleResources: async () => {
      failureResourceSettlement = await settleRunResourcesWithinDeadline()
    },
  })
    .then(async ({ abortStatus, abortError }) => {
      if (abortStatus === "timed_out" || abortStatus === "failed") {
        await appendEvent("mission.abort.failed", {
          error:
            abortStatus === "timed_out"
              ? `Mission abort did not settle within ${FAILURE_ABORT_TIMEOUT_MS}ms`
              : abortError,
          timeout_ms: FAILURE_ABORT_TIMEOUT_MS,
        })
      }
      if (failureResourceSettlement?.status === "settled") {
        await appendEvent("runtime.disposed", {
          pid: process.pid,
          port: allocatedPort,
          listenerStopped: resourceSettlementState.runtimeDisposed,
          instancesSettled: resourceSettlementState.runtimeDisposed,
          databaseClosed: resourceSettlementState.runtimeDisposed,
          isolatedAuthRemoved: resourceSettlementState.isolatedAuthRemoved,
          uiServedByBackend: true,
        })
      } else {
        await appendEvent("runtime.dispose.failed", {
          error: failureResourceSettlement?.error ?? "Evolution E2E resource settlement did not return a receipt",
          timeout_ms: RESOURCE_SETTLEMENT_TIMEOUT_MS,
          partial_receipt: resourceSettlementState,
        })
      }
    })
    .catch(async (cleanupError) => {
      await appendEvent("runtime.dispose.failed", { error: errorMessage(cleanupError) }).catch(() => {})
    })
  const failure = {
    schema_version: 1,
    outcome: "failed",
    run_id: runID,
    error: errorMessage(error),
    isolation: {
      pid: process.pid,
      port: allocatedPort,
      home_directory: homeDirectory,
      project_directory: projectDirectory,
      database_path: databasePath,
      runtime_cleanup: {
        status: failureResourceSettlement?.status ?? "failed",
        ...resourceSettlementState,
        ...(failureResourceSettlement && failureResourceSettlement.status !== "settled"
          ? { error: failureResourceSettlement.error }
          : {}),
      },
    },
    provider: { provider_id: PROVIDER_ID, model_id: MODEL_ID },
    model_catalog: modelCatalogReceipt,
    random_selection: selection,
    installation: {
      target_digest: installedTargetDigest,
      evolution_lab_digest: installedEvolutionDigest,
      product_pillar: productPillar,
    },
    mission: {
      mission_id: missionID,
      session_id: missionSessionID,
      latest_status: latestStatus
        ? {
            status: latestStatus.status,
            task_counts: latestStatus.taskCounts,
            tasks: latestStatus.tasks.map((task) => ({
              id: task.taskID,
              title: task.title,
              lifecycle_status: task.lifecycleStatus,
              error: task.error,
            })),
          }
        : undefined,
    },
    request_summary: summarizeEvolutionRequests(requests),
    artifact_failure_history: await fs
      .access(databasePath)
      .then(() => readArtifactFailureHistory())
      .catch((historyError) => ({ unavailable: errorMessage(historyError) })),
    conversation_failure_history: await fs
      .access(databasePath)
      .then(() => readConversationFailureHistory())
      .catch((historyError) => ({ unavailable: errorMessage(historyError) })),
  }
  await writeJSON(resultPath, failure).catch(() => {})
  console.error(`RUN_RESULT ${JSON.stringify({ outcome: "failed", runRoot, resultPath, error: errorMessage(error) })}`)
  process.exitCode = 1
} finally {
  const settlement = await settleRunResourcesWithinDeadline()
  if (settlement.status !== "settled") process.exitCode = 1
}

// This file is an executable acceptance controller, not a reusable runtime host.
// Once every owned resource has settled and the receipt is durable, inherited
// process-level handles must not keep the isolated run alive indefinitely.
process.exit(process.exitCode ?? 0)
