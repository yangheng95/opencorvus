import { createWriteStream } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const evidenceRoot = path.join(scriptDirectory, "evidence", "batch-01")
const baseURL = process.env.OPENCORVUS_BATCH_BASE_URL ?? "http://127.0.0.1:7878"
const segmentIndex = process.env.OPENCORVUS_BATCH_SEGMENT ?? "unknown"
const segmentDurationMilliseconds = Number(process.env.OPENCORVUS_BATCH_SEGMENT_MS ?? 65_000)
const keepServer = process.env.OPENCORVUS_BATCH_KEEP_SERVER === "1"
const terminalStatuses = new Set(["completed", "failed", "cancelled"])

async function readJSON(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

async function appendJSONLine(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value)}\n`, { encoding: "utf8", flag: "a" })
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

const cases = await Promise.all(
  ["case-01", "case-02"].map(async (id) => {
    const response = await readJSON(path.join(evidenceRoot, id, "response.json"))
    return {
      id,
      taskID: response.body.task_id,
      directory: response.body.directory,
      evidenceDirectory: path.join(evidenceRoot, id),
    }
  }),
)

if (cases.length !== 2 || cases.some((item) => !item.taskID || !item.directory)) {
  throw new Error("Resume requires exactly two persisted Batch 01 Task identities")
}

const heartbeat = setInterval(() => {
  console.log(`${new Date().toISOString()} segment=${segmentIndex} heartbeat`)
}, 5_000)

async function getProject(caseState, route) {
  const response = await fetch(`${baseURL}${route}`, {
    headers: { "x-opencorvus-directory": caseState.directory },
  })
  return responseRecord(response)
}

async function captureEvents(caseState, controller) {
  const output = createWriteStream(
    path.join(caseState.evidenceDirectory, `events-segment-${segmentIndex}.sse`),
    { flags: "w" },
  )
  try {
    const response = await fetch(`${baseURL}/task/${caseState.taskID}/events?after=0&after_live=0`, {
      headers: { "x-opencorvus-directory": caseState.directory },
      signal: controller.signal,
    })
    await writeJSON(path.join(caseState.evidenceDirectory, `events-segment-${segmentIndex}-response.json`), {
      status: response.status,
      statusText: response.statusText,
      headers: headersObject(response.headers),
    })
    if (!response.ok || !response.body) throw new Error(`Event stream returned HTTP ${response.status}`)
    for await (const chunk of response.body) output.write(chunk)
  } catch (error) {
    if (!controller.signal.aborted) {
      await writeJSON(path.join(caseState.evidenceDirectory, `events-segment-${segmentIndex}-error.json`), {
        error: String(error),
      })
    }
  } finally {
    output.end()
  }
}

const controllers = new Map(cases.map((caseState) => [caseState.id, new AbortController()]))
const eventOperations = cases.map((caseState) => captureEvents(caseState, controllers.get(caseState.id)))
const started = Date.now()
let finalObservation

try {
  while (Date.now() - started < segmentDurationMilliseconds) {
    const observations = await Promise.all(
      cases.map(async (caseState) => {
        const [task, status, progress, board] = await Promise.all([
          getProject(caseState, `/task/${caseState.taskID}`),
          getProject(caseState, `/task/${caseState.taskID}/status`),
          getProject(caseState, `/task/${caseState.taskID}/progress`),
          getProject(caseState, `/task/${caseState.taskID}/board`),
        ])
        const observation = {
          observedAt: new Date().toISOString(),
          segment: segmentIndex,
          task,
          status,
          progress,
          board,
        }
        await appendJSONLine(path.join(caseState.evidenceDirectory, "snapshots.jsonl"), observation)
        console.log(
          `${observation.observedAt} segment=${segmentIndex} ${caseState.id} task=${caseState.taskID} lifecycle=${task.body?.status ?? "unknown"}`,
        )
        return { case: caseState.id, taskID: caseState.taskID, lifecycle: task.body?.status, observation }
      }),
    )
    if (observations.every((item) => terminalStatuses.has(item.lifecycle))) {
      finalObservation = observations
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000))
  }
} finally {
  await writeJSON(path.join(evidenceRoot, `segment-${segmentIndex}-result.json`), {
    segment: segmentIndex,
    startedAt: new Date(started).toISOString(),
    completedAt: new Date().toISOString(),
    terminal: Boolean(finalObservation),
    observations: finalObservation?.map(({ case: caseID, taskID, lifecycle }) => ({ case: caseID, taskID, lifecycle })),
  })
  if (!keepServer) {
    const shutdownResponse = await fetch(`${baseURL}/shutdown`, {
      method: "POST",
      headers: { "x-opencorvus-directory": cases[0].directory },
    })
    await writeJSON(
      path.join(evidenceRoot, `segment-${segmentIndex}-shutdown.json`),
      await responseRecord(shutdownResponse),
    )
    await new Promise((resolve) => setTimeout(resolve, 3_000))
  }
  for (const controller of controllers.values()) controller.abort()
  await Promise.allSettled(eventOperations)
  clearInterval(heartbeat)
}

console.log(JSON.stringify({ segment: segmentIndex, terminal: Boolean(finalObservation) }))
