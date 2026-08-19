/**
 * Rebuild tmp/gallery-artifacts.json from what the database actually holds.
 *
 * run-missions.mjs writes that file as it goes, so two concurrent runs (a full pass plus a retry of
 * one case) can clobber each other's entries — which is how a successfully published spreadsheet
 * artifact went missing from the index while sitting happily in the database. The database is the
 * fact; this rebuilds the index from it by matching each case's Mission title to its session.
 *
 *   node packages/web/qa/artifact-gallery/sync-results.mjs
 */
import fs from "node:fs/promises"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { fileURLToPath, pathToFileURL } from "node:url"
import { cases } from "./cases.mjs"

const here = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(here, "../../../..")

const DB = process.env.GALLERY_DB ?? path.join(process.env.LOCALAPPDATA ?? "", "opencorvus/data/opencorvus.db")
const RESULTS = path.join(repoRoot, "tmp/gallery-artifacts.json")

/** mcp-app@1 has no entry in cases.mjs because run-mcp-app.mjs owns it. */
const EXTRA = [{ id: "mcp-app", renderer: "mcp-app@1", title: "Live spot rates as an MCP App" }]

async function main() {
  const db = new DatabaseSync(DB, { readOnly: true })
  const rows = db
    .prepare(
      `with recursive lineage(id, root) as (
           select id, id from session where parent_id is null
           union all
           select s.id, lineage.root from session s join lineage on s.parent_id = lineage.id
         )
         select a.id as artifactID, a.payload as payload, a.time_created as created,
                m.session_id as sessionID, lineage.root as rootSessionID, root.title as rootTitle
           from interactive_artifact a
           join message m on m.id = a.message_id
           join lineage on lineage.id = m.session_id
           join session root on root.id = lineage.root
          order by a.time_created asc`,
    )
    .all()
  db.close()

  const results = {}
  for (const entry of [...cases, ...EXTRA]) {
    if (!entry.renderer) continue
    // Each case owns a distinct renderer, so the renderer identifies it wherever the squad published
    // from. Newest wins: a re-run of a case is the one worth capturing.
    const match = rows.filter((row) => JSON.parse(row.payload).renderer === entry.renderer).at(-1)
    if (!match) {
      console.log(`miss  ${entry.id.padEnd(14)} no ${entry.renderer} anywhere in the database`)
      continue
    }
    results[entry.id] = {
      id: entry.id,
      renderer: entry.renderer,
      sessionID: match.sessionID,
      rootSessionID: match.rootSessionID,
      artifactID: match.artifactID,
      title: JSON.parse(match.payload).title,
      missionTitle: entry.title,
      conversationTitle: match.rootTitle,
    }
    console.log(`ok    ${entry.id.padEnd(14)} ${match.artifactID}  in "${match.rootTitle}"`)
  }

  await fs.writeFile(RESULTS, JSON.stringify(results, null, 2))
  console.log(`\n${Object.keys(results).length} entries written to ${path.relative(repoRoot, RESULTS)}`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main()
