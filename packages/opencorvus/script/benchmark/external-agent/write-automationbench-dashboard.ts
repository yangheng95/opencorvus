import crypto from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { activeAutomationBenchBatchRunIDs, plannedAutomationBenchSlotState } from "./contract"

type Profile = "base" | "advanced"
type DashboardResult = {
  run: { id: string; status: string; duration_ms?: number }
  benchmark: {
    case_index?: number
    batch_index?: number
    batch_run_id?: string
    task: string
    metrics: { partial_credit: number; task_completed_correctly: number } | null
    tool_attempts?: number
  }
  opencorvus: {
    profile: Profile
    model: string
    launch_mode?: string
    tokens?: { total?: number; modelCalls?: number }
  }
}

type DashboardRecord = {
  run_id: string
  duration_ms?: number
  benchmark: DashboardResult["benchmark"]
  opencorvus: DashboardResult["opencorvus"]
}

type BatchPlan = {
  launch_mode: string
  batch_run_id: string
  batch_index: number
  model: string
  cases: Array<{ case_index: number; task: string }>
  profiles: Profile[]
  waves: Array<Array<{ case_index: number; profile: Profile }>>
  preexisting_eligible?: Partial<
    Record<Profile, Array<{ run_id: string; case_index: number; profile: Profile }>>
  >
}

type CatalogAttempt = {
  run_id?: string
  evidence_status?: string
  reason?: string
  started_at?: number
  raw_leaderboard_eligible?: boolean
  batch_candidate_eligible?: boolean
  permanent_invalidation?: { invalid?: boolean }
  benchmark?: { case_index?: number }
  opencorvus?: { profile?: Profile }
}

type EvidenceManifest = {
  run_id?: string
  run_key?: string
  redacted_from_manifest_sha256?: string
  files?: Array<{ path?: string; bytes?: number; sha256?: string }>
}

type PublicContext = {
  source?: string
  snapshot_date?: string
  rows?: Array<{ model: string; strict_success_rate: number }>
}

const values = new Map<string, string>()
for (let index = 2; index < process.argv.length; index += 2) {
  const key = process.argv[index]
  const value = process.argv[index + 1]
  if (!key?.startsWith("--") || value === undefined) throw new Error("Expected --name value arguments")
  values.set(key.slice(2), value)
}

const rootValue = values.get("root")
const dashboardValue = values.get("dashboard")
const planValue = values.get("batch-plan")
const model = values.get("model")
if (!rootValue || !dashboardValue || !model) throw new Error("--root, --dashboard, and --model are required")
const root = path.resolve(rootValue)
const dashboard = path.resolve(dashboardValue)
const planPaths = planValue
  ? planValue
      .split(",")
      .filter(Boolean)
      .map((item) => path.resolve(item))
  : []
const profiles = (values.get("profiles") ?? "base").split(",").map((item) => item.trim()) as Profile[]
if (
  profiles.length < 1 ||
  profiles.length > 2 ||
  new Set(profiles).size !== profiles.length ||
  profiles.some((profile) => profile !== "base" && profile !== "advanced")
) {
  throw new Error("--profiles must be base, advanced, or base,advanced")
}
const [brandLogoLight, brandLogoDark] = await Promise.all([
  fs.readFile(path.resolve(import.meta.dir, "../../../../web/src/assets/logo-light.svg"), "utf8"),
  fs.readFile(path.resolve(import.meta.dir, "../../../../web/src/assets/logo-dark.svg"), "utf8"),
])

async function readJSON<T>(file: string): Promise<T | undefined> {
  return fs.readFile(file, "utf8").then(JSON.parse).catch(() => undefined) as Promise<T | undefined>
}

async function walk(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name)
        return entry.isDirectory() ? walk(target) : Promise.resolve([target])
      }),
    )
  ).flat()
}

async function verifyEvidenceManifest(directory: string, manifest: EvidenceManifest | undefined, runID: string) {
  if (
    !manifest ||
    manifest.run_id !== runID ||
    manifest.redacted_from_manifest_sha256 ||
    !Array.isArray(manifest.files)
  ) {
    return false
  }
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => [])
  const actualFiles = entries
    .filter((entry) => entry.isFile() && entry.name !== "evidence-manifest.json")
    .map((entry) => entry.name)
    .sort()
  const declaredFiles = manifest.files.map((entry) => entry.path ?? "").sort()
  if (
    new Set(declaredFiles).size !== declaredFiles.length ||
    actualFiles.length !== declaredFiles.length ||
    actualFiles.some((name, index) => name !== declaredFiles[index])
  ) {
    return false
  }
  return (
    await Promise.all(
      manifest.files.map(async (entry) => {
        if (!entry.path || path.basename(entry.path) !== entry.path) return false
        const bytes = await fs.readFile(path.join(directory, entry.path)).catch(() => undefined)
        return (
          bytes !== undefined &&
          bytes.byteLength === entry.bytes &&
          crypto.createHash("sha256").update(bytes).digest("hex") === entry.sha256
        )
      }),
    )
  ).every(Boolean)
}

function escapeHTML(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

function integer(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.round(number).toLocaleString("en-US") : "—"
}

function percent(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : "—"
}

function duration(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? `${(number / 60_000).toFixed(2)} min` : "—"
}

const [catalog, anchoredPlans, allFiles, activeLeases] = await Promise.all([
  readJSON<{
    generated_at?: number
    attempts?: CatalogAttempt[]
    candidates?: DashboardRecord[]
    leaderboard?: DashboardRecord[]
    primary_leaderboard?: DashboardRecord[]
    public_context?: PublicContext
    scope?: { model?: string; launch_mode?: string; case_count?: number }
  }>(path.join(root, "evidence-catalog.json")),
  Promise.all(planPaths.map((planPath) => readJSON<BatchPlan>(planPath))),
  walk(root),
  readJSON<{ active?: Array<{ run_id: string; case_id: string; profile: Profile; batch_run_id: string }> }>(
    path.join(root, ".automationbench-active-leases.json"),
  ),
])
if (anchoredPlans.some((plan) => plan && (plan.model !== model || plan.launch_mode !== "mission"))) {
  throw new Error("Dashboard batch plan model/launch mode does not match the Mission run")
}
if (catalog?.scope && (catalog.scope.model !== model || catalog.scope.launch_mode !== "mission")) {
  throw new Error("Dashboard catalog model/launch mode does not match the Mission run")
}
const activeBatchRunIDs = activeAutomationBenchBatchRunIDs(activeLeases?.active ?? [], anchoredPlans)
const currentPlans = (
  await Promise.all(
    allFiles
      .filter((file) => /-plan\.json$/.test(path.basename(file)))
      .map((file) => readJSON<BatchPlan>(file)),
  )
)
  .filter((item): item is BatchPlan => Boolean(item && activeBatchRunIDs.has(item.batch_run_id)))
  .filter((item) => item.model === model && item.launch_mode === "mission")
const currentBatchRunIDs = new Set(currentPlans.map((item) => item.batch_run_id))
const currentCases = currentPlans.flatMap((item) => item.cases)

const verified = (catalog?.primary_leaderboard ?? catalog?.leaderboard ?? [])
  .filter(
    (record) =>
      profiles.includes(record.opencorvus.profile) &&
      record.opencorvus.model === model &&
      (record.opencorvus as Record<string, any>).launch_mode === "mission",
  )
  .sort((left, right) => Number(left.benchmark.case_index) - Number(right.benchmark.case_index))
const verifiedRunIDs = new Set(verified.map((record) => String(record.run_id)))
const catalogAttempts = new Map((catalog?.attempts ?? []).map((attempt) => [String(attempt.run_id), attempt]))
const dispositions = await readJSON<{ runs?: Record<string, unknown> }>(path.join(root, "run-dispositions.json"))
const currentResults = (
  await Promise.all(
    allFiles
      .filter((file) => path.basename(file) === "result.json")
      .map(async (file) => {
        const directory = path.dirname(file)
        const payload = await readJSON<DashboardResult>(file)
        if (
          !payload ||
          currentPlans.length === 0 ||
          !currentBatchRunIDs.has(String(payload.benchmark.batch_run_id)) ||
          payload.opencorvus.model !== model ||
          payload.opencorvus.launch_mode !== "mission" ||
          verifiedRunIDs.has(String(payload.run.id))
        ) {
          return { file, payload, manifest: undefined, manifestValid: false, names: [] }
        }
        const [manifest, names] = await Promise.all([
          readJSON<EvidenceManifest>(path.join(directory, "evidence-manifest.json")),
          fs.readdir(directory).catch(() => []),
        ])
        const manifestValid = await verifyEvidenceManifest(directory, manifest, String(payload.run.id))
        return { file, payload, manifest, manifestValid, names }
      }),
  )
)
  .filter(
    (item): item is {
      file: string
      payload: DashboardResult
      manifest: EvidenceManifest
      manifestValid: true
      names: string[]
    } =>
      Boolean(
        item.payload &&
          item.manifestValid &&
          item.manifest?.files?.some((entry) => entry.path === "result.json") &&
          item.payload.run.status === "scored" &&
          item.payload.benchmark.metrics &&
          profiles.includes(item.payload.opencorvus.profile) &&
          currentPlans.length > 0 &&
          currentBatchRunIDs.has(String(item.payload.benchmark.batch_run_id)) &&
          !verifiedRunIDs.has(String(item.payload.run.id)),
      ),
  )
  .filter((item) => {
    const runID = String(item.payload.run.id)
    const attempt = catalogAttempts.get(runID)
    return (
      dispositions?.runs?.[runID] === undefined &&
      (attempt === undefined || attempt.raw_leaderboard_eligible === true || attempt.batch_candidate_eligible === true) &&
      attempt?.permanent_invalidation?.invalid !== true &&
      !item.names.some(
        (name) =>
          name === "failure.json" ||
          name === "cleanup-failure.json" ||
          name === "evidence-seal-failure.json" ||
          /^redaction-receipt(?:-\d+)?\.json$/.test(name),
      )
    )
  })
  .map(({ payload }) => ({
    run_id: payload.run.id,
    duration_ms: payload.run.duration_ms,
    benchmark: payload.benchmark,
    opencorvus: payload.opencorvus,
  }))

const active = (activeLeases?.active ?? []).filter(
  (item) => profiles.includes(item.profile) && currentBatchRunIDs.has(item.batch_run_id),
)
const slotKey = (caseIndex: unknown, profile: unknown) => `${Number(caseIndex)}:${String(profile)}`
const activeSlots = new Set(active.map((item) => slotKey(currentCases.find((entry) => entry.task === item.case_id.split(":", 2)[1])?.case_index, item.profile)))
const verifiedBySlot = new Map(
  verified.map((record) => [slotKey(record.benchmark.case_index, record.opencorvus.profile), record]),
)
const pendingBySlot = new Map(
  currentResults.map((record) => [slotKey(record.benchmark.case_index, record.opencorvus.profile), record]),
)
const adoptedCandidateBySlot = new Map(
  profiles.flatMap((profile) =>
    currentPlans.flatMap((currentPlan) =>
      (currentPlan.preexisting_eligible?.[profile] ?? []).map((record) => [
        slotKey(record.case_index, record.profile),
        record.run_id,
      ] as const),
    ),
  ),
)
const adoptedRunIDs = new Set(adoptedCandidateBySlot.values())
const adoptedRecords = (catalog?.candidates ?? []).filter(
  (record) => adoptedRunIDs.has(String(record.run_id)) && profiles.includes(record.opencorvus.profile),
)
/**
 * A planned slot whose run was invalidated is not a slot that has yet to run.
 *
 * The plan view has three states — verified, sealed-and-pending, and planned —
 * and an invalidated run belongs to none of them, so it fell through to
 * "queued" and the page claimed work was waiting to start that had in fact run
 * and been thrown out. That is the one reading a stopped batch must not admit.
 */
const invalidatedBySlot = new Map<string, { status: string; reason: string; startedAt: number }>()
for (const attempt of catalog?.attempts ?? []) {
  const status = String(attempt.evidence_status ?? "")
  if (!status || status === "scored" || status === "sealed_candidate") continue
  const profile = attempt.opencorvus?.profile
  if (!profile || !profiles.includes(profile)) continue
  const key = slotKey(attempt.benchmark?.case_index, profile)
  const startedAt = Number(attempt.started_at ?? 0)
  const current = invalidatedBySlot.get(key)
  if (current && current.startedAt >= startedAt) continue
  invalidatedBySlot.set(key, { status, reason: String(attempt.reason ?? ""), startedAt })
}
const planned = currentPlans.flatMap((currentPlan) => currentPlan.waves.flat())
const displayRecords = [
  ...verified,
  ...adoptedRecords.filter((record) => !verifiedRunIDs.has(String(record.run_id))),
]
for (const slot of planned) {
  const key = slotKey(slot.case_index, slot.profile)
  if (!verifiedBySlot.has(key) && pendingBySlot.has(key)) displayRecords.push(pendingBySlot.get(key)!)
}
displayRecords.sort(
  (left, right) =>
    Number(left.benchmark.case_index) - Number(right.benchmark.case_index) ||
    left.opencorvus.profile.localeCompare(right.opencorvus.profile),
)

const summaries = profiles.map((profile) => {
  const rows = verified.filter((record) => record.opencorvus.profile === profile)
  const strictPasses = rows.reduce(
    (sum, record) => sum + Number(record.benchmark.metrics?.task_completed_correctly ?? 0),
    0,
  )
  const mean = (selector: (record: DashboardRecord) => number) =>
    rows.length ? rows.reduce((sum, record) => sum + selector(record), 0) / rows.length : 0
  const total = (selector: (record: DashboardRecord) => number) =>
    rows.reduce((sum, record) => sum + selector(record), 0)
  return {
    profile,
    rows,
    strictPasses,
    strictRate: rows.length ? strictPasses / rows.length : 0,
    partialMean: mean((record) => Number(record.benchmark.metrics?.partial_credit ?? 0)),
    tokensMean: mean((record) => Number(record.opencorvus.tokens?.total ?? 0)),
    tokensTotal: total((record) => Number(record.opencorvus.tokens?.total ?? 0)),
    modelCallsMean: mean((record) => Number(record.opencorvus.tokens?.modelCalls ?? 0)),
    modelCallsTotal: total((record) => Number(record.opencorvus.tokens?.modelCalls ?? 0)),
  }
})
const coverage = verified.length
const targetCases = Number(catalog?.scope?.case_count ?? 50)
const targetSlots = profiles.length * targetCases
const generatedAt = Date.now()

const officialRows = catalog?.public_context?.rows ?? []

const resultRows = displayRecords
  .map((record) => {
    const metrics = record.benchmark.metrics
    const status = verifiedRunIDs.has(String(record.run_id))
      ? "verified"
      : adoptedRunIDs.has(String(record.run_id))
        ? "sealed candidate · adopted"
        : "sealed · pending catalog"
    return `<tr>
      <td>${integer(record.benchmark.case_index)}</td>
      <td>${escapeHTML(record.benchmark.task)}</td>
      <td>${escapeHTML(record.opencorvus.profile)}</td>
      <td>${escapeHTML(status)}</td>
      <td class="num">${integer(metrics?.task_completed_correctly)}</td>
      <td class="num">${percent(metrics?.partial_credit)}</td>
      <td class="num">${integer(record.opencorvus.tokens?.total)}</td>
      <td class="num">${integer(record.opencorvus.tokens?.modelCalls)}</td>
      <td class="num">${integer(record.benchmark.tool_attempts)}</td>
      <td class="num">${duration(record.duration_ms)}</td>
    </tr>`
  })
  .join("\n")

const plannedRows = planned
  .filter((slot) => {
    const key = slotKey(slot.case_index, slot.profile)
    return !verifiedBySlot.has(key) && !pendingBySlot.has(key) && !adoptedCandidateBySlot.has(key)
  })
  .map((slot) => {
    const task = currentCases.find((item) => item.case_index === slot.case_index)?.task ?? ""
    const key = slotKey(slot.case_index, slot.profile)
    const state = plannedAutomationBenchSlotState({
      active: activeSlots.has(key),
      invalidation: invalidatedBySlot.get(key),
    })
    const status = state.kind === "running"
      ? "running"
      : state.kind === "invalidated"
        ? `${state.status.replaceAll("_", " ")} · ${state.reason}`
        : "queued"
    return `<tr><td>${slot.case_index}</td><td>${escapeHTML(task)}</td><td>${escapeHTML(slot.profile)}</td><td>${escapeHTML(status)}</td></tr>`
  })
  .join("\n")

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="refresh" content="10">
  <title>AutomationBench · OpenCorvus profiles</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background:#f6f7f9; color:#172033; }
    body { margin:0; padding:28px; }
    main { max-width:1180px; margin:0 auto; }
    .brand-hero { display:flex; justify-content:space-between; gap:28px; align-items:center; margin:0 0 28px; padding:24px 26px; border:1px solid #eadfc9; border-radius:16px; background:linear-gradient(135deg,#fffaf0 0%,#fff 62%,#eef4ff 100%); box-shadow:0 16px 40px rgba(51,65,85,.08); color:#1f1c1c; }
    .brand-hero svg { display:block; width:234px; height:42px; }
    .brand-kicker { margin-top:8px; color:#705b39; font:600 11px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; letter-spacing:.12em; text-transform:uppercase; }
    .brand-links { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; }
    .brand-link { display:inline-flex; align-items:center; min-height:34px; padding:0 12px; border:1px solid #d7deea; border-radius:999px; background:rgba(255,255,255,.82); color:#24324a; font:600 12px/1.2 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-decoration:none; }
    .brand-link:hover { border-color:#8aa4d6; background:#fff; }
    h1 { margin:0 0 6px; font-size:28px; font-weight:650; }
    h2 { margin:30px 0 12px; font-size:18px; }
    .subtle { color:#667085; font-size:13px; }
    .metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; margin:20px 0; }
    .metric { background:#fff; border:1px solid #e3e7ee; border-radius:10px; padding:15px; }
    .metric span { display:block; color:#667085; font-size:12px; }
    .metric strong { display:block; margin-top:6px; font-size:22px; font-variant-numeric:tabular-nums; }
    .progress { height:10px; overflow:hidden; border-radius:999px; background:#e5e9f0; }
    .progress > div { height:100%; width:${Math.min(100, targetSlots ? (coverage / targetSlots) * 100 : 0)}%; background:#2563eb; }
    .bars { display:grid; gap:9px; }
    .bar { display:grid; grid-template-columns:minmax(180px,1.4fr) minmax(180px,3fr) 72px; gap:12px; align-items:center; }
    .track { height:12px; background:#e5e9f0; border-radius:999px; overflow:hidden; }
    .fill { height:100%; background:#7c8aa5; }
    .fill.local { background:#2563eb; }
    .num { text-align:right; font-variant-numeric:tabular-nums; white-space:nowrap; }
    .table-wrap { overflow-x:auto; background:#fff; border:1px solid #e3e7ee; border-radius:10px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { padding:10px 12px; border-bottom:1px solid #edf0f4; text-align:left; }
    th { color:#475467; font-weight:600; background:#fafbfc; }
    tr:last-child td { border-bottom:0; }
    a { color:#2563eb; }
    .brand-footer { display:grid; grid-template-columns:auto 1fr; gap:18px 34px; align-items:center; margin:32px 0 8px; padding:24px 26px; border-radius:14px; background:#111827; color:#e8edf6; }
    .brand-footer svg { display:block; width:190px; height:auto; }
    .brand-footer-copy { display:grid; gap:6px; justify-items:end; font:500 12px/1.45 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; text-align:right; }
    .brand-footer a { color:#9fc1ff; overflow-wrap:anywhere; }
    .evidence-footer { grid-column:1 / -1; padding-top:14px; border-top:1px solid #2d3748; color:#9ca8ba; }
    @media (prefers-color-scheme:dark) {
      :root { background:#0f141d; color:#eef2f8; }
      .subtle, .metric span { color:#98a2b3; }
      .metric, .table-wrap { background:#161d28; border-color:#2a3443; }
      th { color:#cbd5e1; background:#1b2431; }
      th, td { border-color:#293343; }
      .progress, .track { background:#2b3545; }
      a { color:#78a7ff; }
    }
    @media (max-width:760px) {
      body { padding:18px 12px; }
      .metrics { grid-template-columns:repeat(2,minmax(0,1fr)); }
      .bar { grid-template-columns:1fr 64px; }
      .track { grid-column:1 / -1; grid-row:2; }
      .brand-hero { align-items:flex-start; flex-direction:column; }
      .brand-links { justify-content:flex-start; }
      .brand-footer { grid-template-columns:1fr; }
      .brand-footer-copy { justify-items:start; text-align:left; }
      .evidence-footer { grid-column:1; }
    }
  </style>
</head>
<body>
<main>
  <header class="brand-hero">
    <div>
      <a href="https://opencorvus.com" aria-label="OpenCorvus 官网">${brandLogoLight}</a>
      <div class="brand-kicker">Mission benchmark evidence · reproducible by design</div>
    </div>
    <nav class="brand-links" aria-label="OpenCorvus project links">
      <a class="brand-link" href="https://opencorvus.com">官网 · opencorvus.com</a>
      <a class="brand-link" href="https://github.com/yangheng95">作者 · yangheng95</a>
      <a class="brand-link" href="https://github.com/yangheng95/opencorvus">项目 · github.com/yangheng95/opencorvus</a>
    </nav>
  </header>
  <h1>AutomationBench · OpenCorvus Mission ${profiles.map((profile) => escapeHTML(profile)).join(" + ")} / ${escapeHTML(model)}</h1>
  <div class="subtle">Primary profiles: ${profiles.map(escapeHTML).join(" + ")} · target ${targetCases} unique cases · updated ${new Date(generatedAt).toISOString()}</div>
  <section class="metrics" aria-label="Profile benchmark summary">
    ${summaries
      .flatMap((summary) => [
        `<div class="metric"><span>${escapeHTML(summary.profile)} verified coverage</span><strong>${summary.rows.length} / ${targetCases}</strong></div>`,
        `<div class="metric"><span>${escapeHTML(summary.profile)} strict pass rate</span><strong>${percent(summary.strictRate)}</strong></div>`,
        `<div class="metric"><span>${escapeHTML(summary.profile)} mean partial · usage</span><strong>${percent(summary.partialMean)}</strong><span>${integer(summary.tokensTotal)} total tokens · ${integer(summary.tokensMean)} mean</span><span>${integer(summary.modelCallsTotal)} model calls · ${integer(summary.modelCallsMean)} mean</span></div>`,
      ])
      .join("\n    ")}
  </section>
  <div class="progress" role="progressbar" aria-valuenow="${coverage}" aria-valuemin="0" aria-valuemax="${targetSlots}" aria-label="Verified profile trials"><div></div></div>

  <h2>Strict pass rate · official metric</h2>
  <div class="bars">
    ${summaries
      .map(
        (summary) =>
          `<div class="bar"><span>OpenCorvus ${escapeHTML(summary.profile)} · ${escapeHTML(model)} <span class="subtle">n=${summary.rows.length}</span></span><div class="track"><div class="fill local" style="width:${Math.min(100, summary.strictRate * 200)}%"></div></div><strong class="num">${percent(summary.strictRate)}</strong></div>`,
      )
      .join("\n    ")}
    ${officialRows
      .map(
        (row) =>
          `<div class="bar"><span>${escapeHTML(row.model)} <span class="subtle">official held-out context</span></span><div class="track"><div class="fill" style="width:${Math.min(100, row.strict_success_rate * 200)}%"></div></div><strong class="num">${percent(row.strict_success_rate)}</strong></div>`,
      )
      .join("\n    ")}
  </div>
  <div class="subtle">Same deterministic strict metric; the local frozen ${targetCases}-case public set is not assigned a cross-sample rank.</div>

  <h2>Profile results</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Case</th><th>Task</th><th>Profile</th><th>Status</th><th class="num">Strict</th><th class="num">Partial</th><th class="num">Tokens</th><th class="num">Model calls</th><th class="num">API attempts</th><th class="num">Duration</th></tr></thead>
      <tbody>${resultRows || '<tr><td colspan="10">No sealed profile results yet.</td></tr>'}</tbody>
    </table>
  </div>

  ${plannedRows ? `<h2>Current batch</h2><div class="table-wrap"><table><thead><tr><th>Case</th><th>Task</th><th>Profile</th><th>Status</th></tr></thead><tbody>${plannedRows}</tbody></table></div>` : ""}
  <footer class="brand-footer">
    <a href="https://opencorvus.com" aria-label="OpenCorvus 官网">${brandLogoDark}</a>
    <div class="brand-footer-copy">
      <span>作者 · <a href="https://github.com/yangheng95">yangheng95</a></span>
      <span>官网 · <a href="https://opencorvus.com">https://opencorvus.com</a></span>
      <span>项目 · <a href="https://github.com/yangheng95/opencorvus">https://github.com/yangheng95/opencorvus</a></span>
    </div>
    <div class="evidence-footer">Verified ${coverage} / ${targetSlots} · remaining ${Math.max(0, targetSlots - coverage)} · indexed attempts ${integer(catalog?.attempts?.length ?? 0)} · source: <a href="${escapeHTML(catalog?.public_context?.source ?? "https://github.com/zapier/AutomationBench")}">AutomationBench official leaderboard</a>${catalog?.public_context?.snapshot_date ? ` · snapshot ${escapeHTML(catalog.public_context.snapshot_date)}` : ""}</div>
  </footer>
</main>
</body>
</html>
`

await fs.mkdir(path.dirname(dashboard), { recursive: true })
const temporary = `${dashboard}.tmp-${process.pid}-${Date.now()}`
await fs.writeFile(temporary, html, "utf8")
await fs.rename(temporary, dashboard)
process.stdout.write(JSON.stringify({ dashboard, verified: coverage, pending: currentResults.length, active: active.length }) + "\n")
