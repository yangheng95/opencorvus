import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(fileURLToPath(import.meta.url))
const evidenceRoot = path.join(root, "evidence", "batch-01")
const baseURL = process.env.OPENCORVUS_BATCH_BASE_URL ?? "http://127.0.0.1:7878"
const cases = await Promise.all(
  ["case-01", "case-02"].map(async (id) => {
    const accepted = JSON.parse(await readFile(path.join(evidenceRoot, id, "response.json"), "utf8"))
    return { id, taskID: accepted.body.task_id, directory: accepted.body.directory }
  }),
)

if (cases.length !== 2 || cases.some((item) => !item.taskID || !item.directory)) {
  throw new Error("Batch 01 recovery requires exactly two existing Task identities")
}

const text =
  "The durable workflow evidence shows that the earlier physical Build Session was created before any WorkerTurnDescriptor or Developer dispatch lineage committed. It is audit evidence, not a prior logical occurrence or continuation authority. The projected MCP runtime and recovery defects are repaired and focused verification passes. Re-read this exact operator message and the current workflow snapshot; the dependency-ready base-developer node has occurrence_not_committed, so dispatch its one authorized initial Turn now. Then run the mission's required real checker and continue the existing workflow to a terminal outcome."

await Promise.all(
  cases.map(async (item) => {
    const request = { text, source: "backend-algorithm-test-loop", model: "openai/gpt-5.6-luna" }
    const response = await fetch(`${baseURL}/task/${item.taskID}/message`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-opencorvus-directory": item.directory,
      },
      body: JSON.stringify(request),
    })
    const bodyText = await response.text()
    let body = bodyText
    try {
      body = JSON.parse(bodyText)
    } catch {}
    const target = path.join(evidenceRoot, item.id)
    await mkdir(target, { recursive: true })
    await writeFile(path.join(target, "post-f06-resume-request.json"), `${JSON.stringify(request, null, 2)}\n`)
    await writeFile(
      path.join(target, "post-f06-resume-response.json"),
      `${JSON.stringify(
        {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        },
        null,
        2,
      )}\n`,
    )
    if (!response.ok) throw new Error(`${item.id} resume returned HTTP ${response.status}: ${bodyText}`)
    console.log(`${item.id} task=${item.taskID} status=${response.status} wake=${body?.wake_status ?? "unknown"}`)
  }),
)
