/**
 * The twentieth renderer.
 *
 * `mcp-app@1` is deliberately absent from PublishableInteractiveArtifactPayload — the Host only
 * mints one after a real MCP tool call returns a real `ui://` resource, so it cannot be authored the
 * way the other nineteen are. This script installs a real MCP server into the gallery workspace,
 * registers it in the project config, and dispatches a Mission that calls its tool.
 *
 * Run it after run-missions.mjs: it rewrites the project's opencorvus.jsonc, which every agent in
 * the project reads at startup.
 *
 *   node packages/web/qa/artifact-gallery/run-mcp-app.mjs
 */
import fs from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath, pathToFileURL } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../..")

const BASE = process.env.GALLERY_BASE ?? "http://127.0.0.1:7893"
const DIRECTORY = process.env.GALLERY_DIRECTORY ?? path.join(repoRoot, "tmp/gallery-workspace")
const DB = process.env.GALLERY_DB ?? path.join(process.env.LOCALAPPDATA ?? "", "opencorvus/data/opencorvus.db")
const MODEL = process.env.GALLERY_MODEL ?? "openai/gpt-5.6-luna"
const SQUAD = (process.env.GALLERY_SQUAD ?? "research-studio").split(",").filter(Boolean)
const RESULTS = path.join(repoRoot, "tmp/gallery-artifacts.json")
const TITLE = "Live spot rates as an MCP App"

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function api(pathname, init) {
  const separator = pathname.includes("?") ? "&" : "?"
  const response = await fetch(`${BASE}${pathname}${separator}directory=${encodeURIComponent(DIRECTORY)}`, init)
  const text = await response.text()
  if (!response.ok) throw new Error(`${init?.method ?? "GET"} ${pathname} -> HTTP ${response.status} ${text}`)
  return text ? JSON.parse(text) : undefined
}

const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })

function publishedArtifacts(sessionID) {
  const db = new DatabaseSync(DB, { readOnly: true })
  try {
    return db
      .prepare(
        `select a.id as id, a.payload as payload
           from interactive_artifact a
           join message m on m.id = a.message_id
          where m.session_id = ?`,
      )
      .all(sessionID)
      .map((row) => ({ id: row.id, payload: JSON.parse(row.payload) }))
  } finally {
    db.close()
  }
}

async function main() {
  await fs.copyFile(path.join(here, "mcp-app-server.mjs"), path.join(DIRECTORY, "mcp-app-server.mjs"))
  const configDir = path.join(DIRECTORY, ".opencorvus")
  await fs.mkdir(configDir, { recursive: true })
  await fs.writeFile(
    path.join(configDir, "opencorvus.jsonc"),
    `${JSON.stringify(
      {
        $schema: "https://opencorvus.ai/config.json",
        mcp: {
          "spot-rates": {
            type: "local",
            command: ["bun", path.join(DIRECTORY, "mcp-app-server.mjs")],
            timeout: 30000,
          },
        },
      },
      null,
      2,
    )}\n`,
  )
  console.log("registered the spot-rates MCP server in the project config")

  const draft = await api(
    "/mission/draft",
    json({
      title: TITLE,
      request: [
        "This project has one MCP server registered, `spot-rates`, exposing a tool named `spot_rate_board`.",
        "Call that tool once. It fetches live Coinbase spot rates and returns an MCP App UI resource, which the",
        "Host renders as an interactive artifact on its own — you do not publish anything yourself.",
        "After the call, reply with one sentence naming the pairs it returned and their prices.",
        "Never call the question tool, never delegate, and do not call any other tool.",
      ].join(" "),
      productPillar: "work",
      expertSquadIDs: SQUAD,
    }),
  )
  await api(`/mission/${draft.missionID}/dispatch`, json({ model: MODEL }))

  const deadline = Date.now() + 12 * 60 * 1000
  while (Date.now() < deadline) {
    await sleep(10_000)
    const match = publishedArtifacts(draft.sessionID).find((artifact) => artifact.payload.renderer === "mcp-app@1")
    if (match) {
      const results = JSON.parse(await fs.readFile(RESULTS, "utf8"))
      results["mcp-app"] = {
        id: "mcp-app",
        renderer: "mcp-app@1",
        missionID: draft.missionID,
        sessionID: draft.sessionID,
        artifactID: match.id,
        title: match.payload.title,
        missionTitle: TITLE,
      }
      await fs.writeFile(RESULTS, JSON.stringify(results, null, 2))
      console.log(`ok    mcp-app  ${match.id}`)
      return
    }
    const status = await api(`/mission/${draft.missionID}/status`)
    if (status.status === "inactive" && status.activity.running === 0) {
      throw new Error("mission settled without an mcp-app@1 artifact")
    }
  }
  throw new Error("timed out waiting for the MCP App artifact")
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
