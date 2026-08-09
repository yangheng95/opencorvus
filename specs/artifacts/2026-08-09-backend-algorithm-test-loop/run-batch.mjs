import { spawnSync } from "node:child_process"
import { createWriteStream } from "node:fs"
import { cp, mkdir, readFile, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const baseURL = process.env.OPENCORVUS_BATCH_BASE_URL ?? "http://127.0.0.1:7878"
const runID = process.env.OPENCORVUS_BATCH_RUN_ID ?? new Date().toISOString().replaceAll(/[:.]/g, "-")
const evidenceRoot = path.join(scriptDirectory, "evidence", "batch-01")
const projectRoot =
  process.env.OPENCORVUS_BATCH_PROJECT_ROOT ?? path.join(os.tmpdir(), "opencorvus-backend-algorithm-loop", runID)
const terminalStatuses = new Set(["completed", "failed", "cancelled"])
const pollIntervalMilliseconds = 5_000
const maximumRunMilliseconds = 45 * 60 * 1_000
const heartbeat = setInterval(() => {
  console.log(`${new Date().toISOString()} batch-harness heartbeat`)
}, 5_000)

const cases = [
  {
    id: "case-01",
    fixture: "case-01-interval-windows",
    title: "Repair deterministic interval-window aggregation",
    request: [
      "Repair the existing algorithm defect in src/windows.js.",
      "Read package.json, the implementation, and every test before editing.",
      "Do not change, delete, skip, or weaken tests. Do not add dependencies.",
      "Implement one clear current algorithm: validate every window, sort input without mutating the caller, merge only windows with a positive-width overlap (adjacent end/start boundaries stay separate), and aggregate labels as unique lexicographically sorted strings.",
      "Malformed windows must throw the existing InvalidWindowError contract, which is a RangeError with code INVALID_WINDOW.",
      "Run node --test through the real project checker and finish only after all tests pass. Keep the change focused and report the exact verification result.",
    ].join("\n"),
  },
  {
    id: "case-02",
    fixture: "case-02-dependency-waves",
    title: "Implement deterministic dependency execution waves",
    request: [
      "Implement dependencyWaves in src/waves.js.",
      "Read package.json, the implementation stub, and every test before editing.",
      "Do not change, delete, skip, or weaken tests. Do not add dependencies.",
      "Return deterministic lexicographically sorted execution waves for the dependency graph: a node may enter a wave only after all of its declared predecessors are in earlier waves, and result order must not depend on object insertion order or dependency-array order.",
      "If no further node can be scheduled, throw the existing DependencyCycleError with code DEPENDENCY_CYCLE and the sorted nodes that remain blocked by the cycle; independent acyclic nodes must not be reported as cycle members.",
      "Run node --test through the real project checker and finish only after all tests pass. Keep the change focused and report the exact verification result.",
    ].join("\n"),
  },
]

if (cases.length !== 2) throw new Error(`Batch must contain exactly two cases, received ${cases.length}`)

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", shell: false })
  return {
    command: [command, ...args],
    cwd,
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error ? String(result.error) : undefined,
  }
}

async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function headersObject(headers) {
  return Object.fromEntries([...headers.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

async function responseRecord(response) {
  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {}
  return { status: response.status, statusText: response.statusText, headers: headersObject(response.headers), body }
}

async function fetchRecord(url, init) {
  const response = await fetch(url, init)
  return responseRecord(response)
}

async function setupCase(caseDefinition) {
  console.log(`${new Date().toISOString()} ${caseDefinition.id} preparing fixture`)
  const directory = path.join(projectRoot, caseDefinition.id)
  const evidenceDirectory = path.join(evidenceRoot, caseDefinition.id)
  await mkdir(directory, { recursive: true })
  await mkdir(evidenceDirectory, { recursive: true })
  await cp(path.join(scriptDirectory, "fixtures", caseDefinition.fixture), directory, { recursive: true })

  const setup = [
    run("git", ["init", "-b", "main"], directory),
    run("git", ["config", "user.name", "OpenCorvus E2E"], directory),
    run("git", ["config", "user.email", "opencorvus-e2e@example.invalid"], directory),
    run("git", ["add", "."], directory),
    run("git", ["commit", "-m", "test: seed backend algorithm case"], directory),
  ]
  if (setup.some((entry) => entry.status !== 0)) {
    await writeJSON(path.join(evidenceDirectory, "fixture-setup.json"), setup)
    throw new Error(`${caseDefinition.id} fixture Git setup failed`)
  }
  const initialVerification = run("node", ["--test"], directory)
  await writeJSON(path.join(evidenceDirectory, "fixture-setup.json"), {
    runID,
    directory,
    setup,
    initialVerification,
    baselineCommit: run("git", ["rev-parse", "HEAD"], directory).stdout.trim(),
  })
  if (initialVerification.status === 0) throw new Error(`${caseDefinition.id} seed unexpectedly passes`)
  return { ...caseDefinition, directory, evidenceDirectory }
}

async function createTask(caseState) {
  console.log(`${new Date().toISOString()} ${caseState.id} submitting POST /task`)
  const requestBody = {
    requestID: `${runID}-${caseState.id}`,
    source: "backend-algorithm-batch-01",
    productPillar: "code",
    model: "openai/gpt-5.6-luna",
    title: caseState.title,
    request: caseState.request,
    queue: false,
    budget: { maxExecutorGroups: 1 },
    checks: {
      test: ["node --test"],
      artifact: {
        require_changed_files: true,
        min_changed_files: 1,
        require_diff: true,
        require_summary: true,
        mode: "strict",
      },
    },
    metadata: { batch: "2026-08-09-01", case: caseState.id },
  }
  const requestRecord = {
    method: "POST",
    url: `${baseURL}/task`,
    headers: { "content-type": "application/json", "x-opencorvus-directory": caseState.directory },
    body: requestBody,
  }
  await writeJSON(path.join(caseState.evidenceDirectory, "request.json"), requestRecord)
  const response = await fetch(`${baseURL}/task`, {
    method: "POST",
    headers: requestRecord.headers,
    body: JSON.stringify(requestBody),
  })
  const responseData = await responseRecord(response)
  await writeJSON(path.join(caseState.evidenceDirectory, "response.json"), responseData)
  if (response.status !== 202 || typeof responseData.body?.task_id !== "string") {
    throw new Error(`${caseState.id} task creation failed with HTTP ${response.status}`)
  }
  console.log(`${new Date().toISOString()} ${caseState.id} accepted task=${responseData.body.task_id}`)
  return { ...caseState, taskID: responseData.body.task_id }
}

async function streamEvents(caseState, controller) {
  const response = await fetch(`${baseURL}/task/${caseState.taskID}/events?after=0&after_live=0`, {
    headers: { "x-opencorvus-directory": caseState.directory },
    signal: controller.signal,
  })
  await writeJSON(path.join(caseState.evidenceDirectory, "events-response.json"), {
    status: response.status,
    statusText: response.statusText,
    headers: headersObject(response.headers),
  })
  if (!response.ok || !response.body) throw new Error(`${caseState.id} event stream failed with HTTP ${response.status}`)
  const output = createWriteStream(path.join(caseState.evidenceDirectory, "events.sse"), { flags: "w" })
  try {
    for await (const chunk of response.body) output.write(chunk)
  } catch (error) {
    if (!controller.signal.aborted) throw error
  } finally {
    await new Promise((resolve, reject) => output.end((error) => (error ? reject(error) : resolve())))
  }
}

async function appendSnapshot(caseState, snapshot) {
  const file = path.join(caseState.evidenceDirectory, "snapshots.jsonl")
  await writeFile(file, `${JSON.stringify(snapshot)}\n`, { encoding: "utf8", flag: "a" })
}

async function getProjectRecord(caseState, route) {
  return fetchRecord(`${baseURL}${route}`, { headers: { "x-opencorvus-directory": caseState.directory } })
}

async function monitorCase(caseState) {
  const controller = new AbortController()
  const eventOperation = streamEvents(caseState, controller)
  const started = Date.now()
  let finalTask
  try {
    while (Date.now() - started < maximumRunMilliseconds) {
      const [task, status, progress, board] = await Promise.all([
        getProjectRecord(caseState, `/task/${caseState.taskID}`),
        getProjectRecord(caseState, `/task/${caseState.taskID}/status`),
        getProjectRecord(caseState, `/task/${caseState.taskID}/progress`),
        getProjectRecord(caseState, `/task/${caseState.taskID}/board`),
      ])
      const snapshot = { observedAt: new Date().toISOString(), task, status, progress, board }
      await appendSnapshot(caseState, snapshot)
      const lifecycle = task.body?.status ?? "unknown"
      console.log(`${snapshot.observedAt} ${caseState.id} task=${caseState.taskID} lifecycle=${lifecycle}`)
      if (terminalStatuses.has(lifecycle)) {
        finalTask = task.body
        break
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMilliseconds))
    }
    if (!finalTask) throw new Error(`${caseState.id} did not reach a terminal status within ${maximumRunMilliseconds}ms`)
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    controller.abort()
    await eventOperation.catch(async (error) => {
      await writeJSON(path.join(caseState.evidenceDirectory, "events-error.json"), { error: String(error) })
    })
  }

  const finalRoutes = {
    task: `/task/${caseState.taskID}`,
    status: `/task/${caseState.taskID}/status`,
    progress: `/task/${caseState.taskID}/progress`,
    board: `/task/${caseState.taskID}/board`,
    transcript: `/task/${caseState.taskID}/transcript`,
    trace: `/task/${caseState.taskID}/trace`,
    turnArtifacts: `/task/${caseState.taskID}/turn-artifacts`,
  }
  const final = {}
  for (const [name, route] of Object.entries(finalRoutes)) final[name] = await getProjectRecord(caseState, route)
  await writeJSON(path.join(caseState.evidenceDirectory, "final-projections.json"), final)

  const archiveResponse = await fetch(`${baseURL}/task/${caseState.taskID}/project-archive`, {
    headers: { "x-opencorvus-directory": caseState.directory },
  })
  await writeJSON(path.join(caseState.evidenceDirectory, "project-archive-response.json"), {
    status: archiveResponse.status,
    statusText: archiveResponse.statusText,
    headers: headersObject(archiveResponse.headers),
  })
  if (archiveResponse.ok) {
    await writeFile(path.join(caseState.evidenceDirectory, "project-archive.zip"), Buffer.from(await archiveResponse.arrayBuffer()))
  }

  const localVerification = {
    gitStatus: run("git", ["status", "--short"], caseState.directory),
    gitDiff: run("git", ["diff", "--no-ext-diff", "--binary"], caseState.directory),
    gitDiffCheck: run("git", ["diff", "--check"], caseState.directory),
    tests: run("node", ["--test"], caseState.directory),
    implementation: await readFile(
      path.join(caseState.directory, "src", caseState.id === "case-01" ? "windows.js" : "waves.js"),
      "utf8",
    ),
  }
  await writeJSON(path.join(caseState.evidenceDirectory, "local-verification.json"), localVerification)
  return {
    case: caseState.id,
    taskID: caseState.taskID,
    directory: caseState.directory,
    lifecycle: finalTask.status,
    terminalReason: finalTask.terminalReason,
    taskError: finalTask.error,
    testStatus: localVerification.tests.status,
    diffCheckStatus: localVerification.gitDiffCheck.status,
  }
}

await mkdir(evidenceRoot, { recursive: true })
await writeJSON(path.join(evidenceRoot, "run-context.json"), {
  runID,
  baseURL,
  projectRoot,
  caseCount: cases.length,
  model: "openai/gpt-5.6-luna",
  startedAt: new Date().toISOString(),
})

const preflightRequest = {
  method: "POST",
  url: `${baseURL}/global/providers/openai/test`,
  headers: { "content-type": "application/json" },
  body: { modelID: "gpt-5.6-luna" },
}
await writeJSON(path.join(evidenceRoot, "provider-preflight-request.json"), preflightRequest)
console.log(`${new Date().toISOString()} provider preflight started`)
const preflightResponse = await fetchRecord(preflightRequest.url, {
  method: preflightRequest.method,
  headers: preflightRequest.headers,
  body: JSON.stringify(preflightRequest.body),
})
await writeJSON(path.join(evidenceRoot, "provider-preflight-response.json"), preflightResponse)
if (preflightResponse.status !== 200 || preflightResponse.body?.ok !== true) {
  throw new Error(`Provider preflight failed: ${JSON.stringify(preflightResponse.body)}`)
}
console.log(`${new Date().toISOString()} provider preflight connected`)

const preparedCases = await Promise.all(cases.map(setupCase))
const createdCases = await Promise.all(preparedCases.map(createTask))
const results = await Promise.all(createdCases.map(monitorCase))
await writeJSON(path.join(evidenceRoot, "batch-result.json"), {
  runID,
  completedAt: new Date().toISOString(),
  results,
})
console.log(JSON.stringify({ runID, results }, null, 2))
clearInterval(heartbeat)
