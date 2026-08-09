import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const evidenceRoot = path.join(scriptDirectory, "evidence", "batch-01")
const baseURL = process.env.OPENCORVUS_BATCH_BASE_URL ?? "http://127.0.0.1:7878"
const requestedCase = process.env.OPENCORVUS_BATCH_REPLY_CASE
const targets = [
  { caseID: "case-01", supersededInteractionID: "int_g019fe4556e9d000000000000iPkluG08G2uc9k" },
  { caseID: "case-02", supersededInteractionID: "int_g019fe45584c5000000000000POUkTiSKkv3Ich" },
].filter((target) => !requestedCase || target.caseID === requestedCase)

async function readJSON(file) {
  return JSON.parse(await readFile(file, "utf8"))
}

async function writeJSON(file, value) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

for (const target of targets) {
  const accepted = await readJSON(path.join(evidenceRoot, target.caseID, "response.json"))
  const directory = accepted.body.directory
  const taskID = accepted.body.task_id
  let interaction
  let interactionList
  for (let attempt = 0; attempt < 60; attempt++) {
    const listResponse = await fetch(`${baseURL}/task/${taskID}/interactions`, {
      headers: { "x-opencorvus-directory": directory },
    })
    if (!listResponse.ok) throw new Error(`${target.caseID} interaction list failed with HTTP ${listResponse.status}`)
    interactionList = await listResponse.json()
    interaction = interactionList
      .filter(
        (item) =>
          item.status === "pending" &&
          item.id !== target.supersededInteractionID &&
          item.payload?.questions?.some((question) =>
            question.options?.some((option) => option.value === "skip_optional_testing"),
          ),
      )
      .sort((left, right) => right.time.created - left.time.created)[0]
    if (interaction) break
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }
  await writeJSON(path.join(evidenceRoot, target.caseID, "interaction-list-before-reply.json"), interactionList)
  if (!interaction) throw new Error(`${target.caseID} did not publish a recovered verification-budget interaction`)
  const request = {
    method: "POST",
    url: `${baseURL}/interaction/${interaction.id}/reply`,
    headers: { "content-type": "application/json", "x-opencorvus-directory": directory },
    body: { autoReply: false, answers: [["skip_optional_testing"]] },
  }
  await writeJSON(path.join(evidenceRoot, target.caseID, "interaction-reply-request.json"), request)
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: JSON.stringify(request.body),
  })
  const text = await response.text()
  let body = text
  try {
    body = JSON.parse(text)
  } catch {}
  await writeJSON(path.join(evidenceRoot, target.caseID, "interaction-reply-response.json"), {
    status: response.status,
    statusText: response.statusText,
    headers: Object.fromEntries(response.headers.entries()),
    body,
  })
  if (!response.ok) throw new Error(`${target.caseID} interaction reply failed with HTTP ${response.status}`)
  console.log(`${new Date().toISOString()} replied ${target.caseID} interaction=${interaction.id}`)
}
