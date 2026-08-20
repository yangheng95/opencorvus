import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

type Result = {
  run: { id?: string; key?: string; started_at: number; finished_at?: number; duration_ms?: number; status: string }
  benchmark: {
    name: string
    version: string
    task: string
    metrics: { partial_credit: number; task_completed_correctly: number } | null
    tool_calls?: number
  }
  opencorvus: {
    commit?: string
    source?: { worktree_clean?: boolean; benchmark_bundle_sha256?: string; dirty_paths?: string[] }
    task_id?: string | null
    lifecycle_status?: string
    profile: string
    model: string
    tokens?: Record<string, number>
    modelCalls?: number
    sessions?: number
    agents?: string[]
  }
}

type Failure = {
  run: { id?: string; key?: string; started_at: number; failed_at?: number; status: string; stage?: string }
  benchmark: { name: string; version: string; task: string }
  opencorvus: { profile: string; model: string; task_id?: string | null }
  error?: { name?: string; message?: string }
}

async function arguments_() {
  const values = new Map<string, string>()
  const argv = process.argv.slice(2)
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith("--") || value === undefined) throw new Error("Expected --root value")
    values.set(key.slice(2), value)
  }
  const root = values.get("root")
  if (!root) throw new Error("--root is required")
  return path.resolve(root)
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name)
      return entry.isDirectory() ? walk(target) : Promise.resolve([target])
    }),
  )
  return nested.flat()
}

async function sha256(file: string) {
  return crypto.createHash("sha256").update(await fs.readFile(file)).digest("hex")
}

async function writeManifest(directory: string) {
  const manifestPath = path.join(directory, "evidence-manifest.json")
  const existing = await fs.readFile(manifestPath, "utf8").catch(() => undefined)
  if (existing) return JSON.parse(existing) as { schema_version: number; generated_at: number; files: unknown[] }
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const file = path.join(directory, entry.name)
        const stat = await fs.stat(file)
        return { path: entry.name, bytes: stat.size, sha256: await sha256(file) }
      }),
  )
  const manifest = {
    schema_version: 1,
    generated_at: Date.now(),
    files,
  }
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n", { flag: "wx" })
  return manifest
}

function percent(value: number | undefined) {
  return value === undefined ? "—" : `${(value * 100).toFixed(2)}%`
}

function integer(value: number | undefined) {
  return value === undefined ? "—" : Math.round(value).toLocaleString("en-US")
}

function duration(value: number | undefined) {
  return value === undefined ? "—" : `${(value / 60_000).toFixed(2)} min`
}

const root = await arguments_()
const files = await walk(root)
const records: Array<Record<string, any>> = []

for (const file of files.filter((item) => ["result.json", "failure.json"].includes(path.basename(item)))) {
  const directory = path.dirname(file)
  const payload = JSON.parse(await fs.readFile(file, "utf8")) as Result | Failure
  const isResult = path.basename(file) === "result.json"
  const result = isResult ? (payload as Result) : undefined
  const failure = isResult ? undefined : (payload as Failure)
  const cleanupFailure = await fs.readFile(path.join(directory, "cleanup-failure.json"), "utf8").catch(() => undefined)
  const cleanupBug = cleanupFailure !== undefined
  const eligible =
    result?.run.status === "scored" &&
    result.opencorvus.lifecycle_status === "completed" &&
    result.benchmark.metrics !== null &&
    result.opencorvus.source?.worktree_clean === true &&
    !cleanupBug
  const developmentScore =
    result?.run.status === "scored" &&
    result.opencorvus.lifecycle_status === "completed" &&
    result.benchmark.metrics !== null &&
    result.opencorvus.source?.worktree_clean !== true &&
    !cleanupBug
  const evidenceStatus = eligible
    ? "scored"
    : cleanupBug
      ? "invalid_bug"
    : developmentScore
      ? "development_scored"
    : failure?.run.status === "blocked_preflight"
      ? "blocked_preflight"
      : "invalid"
  const reason = eligible
    ? "natural_terminal_official_score"
    : cleanupBug
      ? "cleanup_failure"
    : developmentScore
      ? "uncommitted_or_unrecorded_source_state"
    : result
      ? `lifecycle_${result.opencorvus.lifecycle_status ?? "unknown"}`
      : `${failure?.run.stage ?? "unknown_stage"}:${failure?.error?.name ?? "unknown_error"}`
  const manifest = await writeManifest(directory)
  const tokens = result?.opencorvus.tokens
  records.push({
    run_id: payload.run.id ?? path.basename(directory),
    run_key: payload.run.key ?? path.relative(root, directory).replaceAll("\\", "/"),
    evidence_status: evidenceStatus,
    leaderboard_eligible: eligible,
    reason,
    started_at: payload.run.started_at,
    finished_at: result?.run.finished_at ?? failure?.run.failed_at ?? null,
    duration_ms: result?.run.duration_ms ?? null,
    benchmark: payload.benchmark,
    opencorvus: {
      ...payload.opencorvus,
      tokens: tokens ?? null,
    },
    failure: failure?.error ?? null,
    evidence_directory: path.relative(root, directory).replaceAll("\\", "/"),
    evidence_manifest: manifest,
  })
}

records.sort((left, right) => left.started_at - right.started_at)
const eligible = records.filter((record) => record.leaderboard_eligible)
const catalog = {
  schema_version: 1,
  generated_at: Date.now(),
  scope: {
    round: 1,
    benchmark: "AutomationBench",
    model: "openai/gpt-5.6-luna",
    profiles: ["base", "advanced"],
    note: "Every attempt is evidence; only natural terminal official scores enter the self-owned leaderboard.",
  },
  public_context: {
    comparability: "context_only_private_held_out_vs_local_public_single_task",
    luna_listed: false,
    automationbench_version: "1.0.6",
    snapshot_date: "2026-08-20",
    source: "https://zapier.com/benchmarks",
    rows: [
      { model: "Gemini 3.7 Flash High", strict_success_rate: 0.3044 },
      { model: "Claude Opus 5 Max", strict_success_rate: 0.2694 },
      { model: "GPT-5.6 Terra Max", strict_success_rate: 0.21 },
      { model: "GPT-5.6 Sol Max", strict_success_rate: 0.1963 },
    ],
  },
  attempts: records,
  leaderboard: eligible,
}

await fs.writeFile(path.join(root, "evidence-catalog.json"), JSON.stringify(catalog, null, 2) + "\n")

const lines = [
  "# AutomationBench round 1 · OpenCorvus self-owned leaderboard",
  "",
  "This board contains only `openai/gpt-5.6-luna` runs made through the OpenCorvus harness. Every attempt is retained below; only a clean-source, natural OpenCorvus `completed` terminal state followed by the official AutomationBench scorer is leaderboard-eligible.",
  "",
  "## Eligible scores",
  "",
  "| Profile | Task | Strict | Partial | Total tokens | Output | Model calls | Tool calls | Duration | Agents |",
  "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...eligible.map((record) => {
    const metrics = record.benchmark.metrics
    const tokens = record.opencorvus.tokens
    return `| ${record.opencorvus.profile} | ${record.benchmark.task} | ${percent(metrics.task_completed_correctly)} | ${percent(metrics.partial_credit)} | ${integer(tokens?.total)} | ${integer(tokens?.output)} | ${integer(tokens?.modelCalls)} | ${integer(record.benchmark.tool_calls)} | ${duration(record.duration_ms)} | ${integer(record.opencorvus.agents?.length)} |`
  }),
  "",
  "## All attempts (paper evidence index)",
  "",
  "| Started | Profile | Status | Reason | Task ID | Evidence |",
  "| --- | --- | --- | --- | --- | --- |",
  ...records.map(
    (record) =>
      `| ${new Date(record.started_at).toISOString()} | ${record.opencorvus.profile} | ${record.evidence_status} | ${record.reason} | ${record.opencorvus.task_id ?? "—"} | [manifest](${record.evidence_directory}/evidence-manifest.json) |`,
  ),
  "",
  "## Public leaderboard context (not numerically comparable)",
  "",
  "The official AutomationBench board uses a private held-out set, while this first round uses one public task. `gpt-5.6-luna` is not listed publicly. These rows are context only; no rank or delta against our one-task scores is computed.",
  "",
  "| Official row | Strict success rate |",
  "| --- | ---: |",
  ...catalog.public_context.rows.map((row) => `| ${row.model} | ${percent(row.strict_success_rate)} |`),
  "",
  `Snapshot: [AutomationBench official leaderboard](${catalog.public_context.source}), ${catalog.public_context.snapshot_date}.`,
  "",
]
await fs.writeFile(path.join(root, "leaderboard.md"), lines.join("\n"))
process.stdout.write(JSON.stringify({ root, attempts: records.length, eligible: eligible.length }) + "\n")
