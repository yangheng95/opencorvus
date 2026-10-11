import fs from "node:fs/promises"
import path from "node:path"
const base = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-tooltip-282"
const stage = process.argv[2] ?? "01"
if (!["01", "02", "03", "04"].includes(stage)) throw new Error("A current occurrence is required")
const read = async (name: string) => JSON.parse(await fs.readFile(path.join(base, `live-${stage}`, name), "utf8"))
const canonical = await read("canonical-current-conversations.json")
const provider = await read(`source-tooltip-282-live-${stage}-final-provider-audit.json`)
const closure = await read("closure-readback.json")
const expected = (await fs.readFile(path.join(base, "request.txt"), "utf8")).match(/https:\/\/[^\s、]+/g)
const requests = canonical.tools.map((row: any) => ({ ...row, data: JSON.parse(row.data) })).filter((row: any) => row.data.tool === "webfetch")
const sources = canonical.parts.filter((row: any) => row.type === "source-url")
if (JSON.stringify(requests.map((row: any) => row.data.input.url).sort()) !== JSON.stringify(expected?.toSorted())) throw new Error("Actual tool inputs differ")
if (JSON.stringify(sources.map((row: any) => row.url).sort()) !== JSON.stringify(expected?.toSorted())) throw new Error("Actual durable source locations differ")
const ids = new Set(requests.map((row: any) => row.id))
const outcomes = canonical.outcomes.filter((row: any) => ids.has(row.requestPartID))
if (outcomes.length !== 3 || outcomes.some((row: any) => row.outcome !== "completed")) throw new Error("Actual fetch completion differs")
if (provider.requests.some((row: any) => row.model !== "gpt-6.1-sol" || row.streaming !== true || row.response_reader?.terminal?.kind !== "eof"))
  throw new Error("Actual streaming provider completion differs")
const facts = { sources, sessions: canonical.sessions.map((row: any) => ({ id: row.id, projectID: row.project_id, kind: row.kind })),
  completedFetches: outcomes.length, providerEOF: provider.requests.length,
  physicalAtUtc: closure.native.observedAtUtc, remainingAtPhysicalMs: closure.native.deadlineAt - Date.parse(closure.native.observedAtUtc),
  boundary: "Actual backend facts only; screenshot and focus/tooltip qualification belongs to Root's explicit manual record" }
await fs.writeFile(path.join(base, `actual-source-facts-${stage}.json`), JSON.stringify(facts, null, 2) + "\n")
console.log(JSON.stringify({ completedFetches: facts.completedFetches, providerEOF: facts.providerEOF, remainingAtPhysicalMs: facts.remainingAtPhysicalMs }))
