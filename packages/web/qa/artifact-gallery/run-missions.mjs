/**
 * Drive one real Mission per Interactive Artifact renderer.
 *
 * Each case becomes a Mission draft plus a dispatch on the operator prompt path — the same two
 * routes the Mission Board calls — and a run is only finished when the Host has actually persisted
 * an artifact of the expected renderer against that Mission's session. Nothing here writes an
 * artifact itself; a renderer that never shows up is reported as a failure rather than filled in.
 *
 * Phases exist because some cases describe files an earlier case had to build first, and because a
 * PDF can only be previewed once its real bytes are in the Attachment Store — which agents cannot
 * write to, so the driver uploads them between phases.
 *
 * Completion is detected by renderer rather than by session. Holding research-studio, a Mission
 * opens a Task and the squad's writer publishes from its own child session, which hangs off the
 * Task root and not off the Mission session at all — watching the Mission session alone reports
 * every case as a timeout while the artifacts are landing. Each case in this gallery owns a
 * distinct renderer, so "an artifact of this renderer, created after dispatch" is unambiguous.
 *
 *   node packages/web/qa/artifact-gallery/run-missions.mjs [--only document,table] [--concurrency 3]
 */
import fs from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath, pathToFileURL } from "node:url"
import { cases, phases } from "./cases.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../..")

const BASE = process.env.GALLERY_BASE ?? "http://127.0.0.1:7893"
const DIRECTORY = process.env.GALLERY_DIRECTORY ?? path.join(repoRoot, "tmp/gallery-workspace")
const DB = process.env.GALLERY_DB ?? path.join(process.env.LOCALAPPDATA ?? "", "opencorvus/data/opencorvus.db")
const MODEL = process.env.GALLERY_MODEL ?? "openai/gpt-5.6-luna"
/** Every Mission is launched holding the built-in research delivery team. */
const SQUAD = (process.env.GALLERY_SQUAD ?? "research-studio").split(",").filter(Boolean)
const RESULTS = path.join(repoRoot, "tmp/gallery-artifacts.json")
const ATTACHMENTS = path.join(repoRoot, "tmp/gallery-attachments.json")
/** A research-studio Mission runs a five-agent workflow before it publishes; this is a give-up bound. */
const MISSION_TIMEOUT_MS = 40 * 60 * 1000

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

async function api(pathname, init) {
  const separator = pathname.includes("?") ? "&" : "?"
  const response = await fetch(`${BASE}${pathname}${separator}directory=${encodeURIComponent(DIRECTORY)}`, init)
  const text = await response.text()
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${pathname} -> HTTP ${response.status} ${text}`)
  return text ? JSON.parse(text) : undefined
}

const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

/**
 * Read-only peek at the same rows the Overlay reads; the driver never writes to the database.
 *
 * The root title comes back too: the capture harness opens a conversation from the sidebar, and the
 * conversation holding a squad-published artifact is titled after the Task, not the Mission.
 */
function publishedSince(renderer, since) {
  const db = new DatabaseSync(DB, { readOnly: true })
  try {
    const rows = db
      .prepare(
        `with recursive lineage(id, root) as (
             select id, id from session where parent_id is null
             union all
             select s.id, lineage.root from session s join lineage on s.parent_id = lineage.id
           )
           select a.id as id, a.payload as payload, m.session_id as sessionID,
                  lineage.root as rootSessionID, root.title as rootTitle
             from interactive_artifact a
             join message m on m.id = a.message_id
             join lineage on lineage.id = m.session_id
             join session root on root.id = lineage.root
            where a.time_created >= ?
            order by a.time_created asc`,
      )
      .all(since)
    return rows
      .map((row) => ({ ...row, payload: JSON.parse(row.payload) }))
      .filter((row) => row.payload.renderer === renderer)
  } finally {
    db.close()
  }
}

function sessionErrors(sessionID) {
  const db = new DatabaseSync(DB, { readOnly: true })
  try {
    return db
      .prepare(`select data from message where session_id = ? order by time_created`)
      .all(sessionID)
      .map((row) => JSON.parse(row.data).error)
      .filter(Boolean)
  } finally {
    db.close()
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function runCase(entry, attachments) {
  let request = entry.request
  if (entry.attachment) {
    const reference = attachments[entry.attachment]
    if (!reference) throw new Error(`missing prepared attachment ${entry.attachment}`)
    const { filename, ...source } = reference
    request = request.replace("__ATTACHMENT__", JSON.stringify(source))
  }

  const dispatchedAt = Date.now()
  const draft = await api(
    "/mission/draft",
    json({ title: entry.title, request, productPillar: "work", expertSquadIDs: SQUAD }),
  )
  await api(`/mission/${draft.missionID}/dispatch`, json({ model: MODEL }))

  const deadline = dispatchedAt + MISSION_TIMEOUT_MS
  while (Date.now() < deadline) {
    await sleep(15_000)
    // A producer case has no renderer of its own; it is finished when its files are on disk.
    if (!entry.renderer) {
      const written = await Promise.all(
        (entry.produces ?? []).map((filename) => fs.stat(path.join(DIRECTORY, filename)).then(() => true, () => false)),
      )
      if (written.length > 0 && written.every(Boolean)) {
        return { id: entry.id, missionID: draft.missionID, sessionID: draft.sessionID, missionTitle: entry.title }
      }
    }
    const match = entry.renderer ? publishedSince(entry.renderer, dispatchedAt).at(-1) : undefined
    if (match) {
      return {
        id: entry.id,
        renderer: entry.renderer,
        missionID: draft.missionID,
        sessionID: match.sessionID,
        rootSessionID: match.rootSessionID,
        artifactID: match.id,
        title: match.payload.title,
        missionTitle: entry.title,
        conversationTitle: match.rootTitle,
      }
    }
    const status = await api(`/mission/${draft.missionID}/status`)
    // A squad Mission is idle between Task steps, so "no Task running" is only terminal once the
    // Mission itself has no activity left either.
    if (status.status === "inactive" && status.activity.running === 0 && status.taskCounts.running === 0) {
      const errors = sessionErrors(draft.sessionID)
      throw new Error(
        `mission settled without ${entry.renderer ?? entry.produces?.join(", ")}` +
          (errors.length ? `; errors: ${JSON.stringify(errors).slice(0, 400)}` : ""),
      )
    }
  }
  throw new Error(`timed out after ${MISSION_TIMEOUT_MS / 60000} minutes`)
}

/** Files a case built inside the project become Attachment Store references for the cases that preview them. */
async function absorbProducedFiles(entry, attachments) {
  for (const filename of entry.produces ?? []) {
    const bytes = await fs.readFile(path.join(DIRECTORY, filename)).catch(() => undefined)
    if (!bytes) {
      console.log(`warn  ${entry.id} declared ${filename} but the Mission did not write it`)
      continue
    }
    const mime =
      filename.endsWith(".pdf")
        ? "application/pdf"
        : filename.endsWith(".xlsx")
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : filename.endsWith(".docx")
            ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            : "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    const query = new URLSearchParams({ filename, directory: DIRECTORY })
    const response = await fetch(`${BASE}/attachment?${query}`, {
      method: "POST",
      headers: { "content-type": mime },
      body: bytes,
    })
    if (!response.ok) throw new Error(`upload ${filename} -> HTTP ${response.status} ${await response.text()}`)
    attachments[filename] = await response.json()
    await fs.writeFile(ATTACHMENTS, JSON.stringify(attachments, null, 2))
    console.log(`store ${filename} ${bytes.length} bytes`)
  }
}

async function main() {
  const attachments = JSON.parse(await fs.readFile(ATTACHMENTS, "utf8"))
  const only = (argument("only", "") || "").split(",").filter(Boolean)
  const concurrency = Number(argument("concurrency", "3"))
  const byID = new Map(cases.map((entry) => [entry.id, entry]))

  let results = {}
  try {
    results = JSON.parse(await fs.readFile(RESULTS, "utf8"))
  } catch {}

  const failures = []
  for (const phase of phases) {
    const queue = phase
      .map((id) => byID.get(id))
      .filter(Boolean)
      .filter((entry) => (only.length ? only.includes(entry.id) : true))
    const pending = [...queue]
    async function worker() {
      while (pending.length) {
        const entry = pending.shift()
        const started = Date.now()
        try {
          const result = await runCase(entry, attachments)
          results[entry.id] = result
          await fs.writeFile(RESULTS, JSON.stringify(results, null, 2))
          console.log(`ok    ${entry.id.padEnd(14)} ${Math.round((Date.now() - started) / 1000)}s  ${result.artifactID}`)
        } catch (error) {
          failures.push({ id: entry.id, message: error.message })
          console.log(`FAIL  ${entry.id.padEnd(14)} ${Math.round((Date.now() - started) / 1000)}s  ${error.message}`)
        }
        await absorbProducedFiles(entry, attachments).catch((error) => console.log(`warn  ${error.message}`))
      }
    }
    await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker))
  }

  console.log(`\n${Object.keys(results).length}/${cases.length} renderers captured`)
  if (failures.length) {
    console.log("failed:", failures.map((failure) => failure.id).join(", "))
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
