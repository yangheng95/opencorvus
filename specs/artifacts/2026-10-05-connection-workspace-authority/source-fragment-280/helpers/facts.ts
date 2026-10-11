import fs from "node:fs/promises"
import path from "node:path"
const base = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-fragment-280"
const document = "https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/details"
const results = []
for (const stage of ["01", "02"]) {
  const directory = path.join(base, `live-${stage}`)
  const read = async (name: string) => JSON.parse(await fs.readFile(path.join(directory, name), "utf8"))
  const canonical = await read("canonical-current-conversations.json")
  const provider = await read(`source-fragment-280-live-${stage}-final-provider-audit.json`)
  const closure = await read("closure-readback.json")
  const toolRequests = canonical.tools.map((row: any) => ({ ...row, data: JSON.parse(row.data) }))
  const fetches = toolRequests.filter((row: any) => row.data.tool === "webfetch")
  const sources = canonical.parts.filter((row: any) => row.type === "source-url")
  const expectedInputs = stage === "01" ? [`${document}#examples`] : [`${document}#examples`, `${document}#technical_summary`]
  const expectedSources = stage === "01" ? [document] : expectedInputs
  if (JSON.stringify(fetches.map((row: any) => row.data.input.url)) !== JSON.stringify(expectedInputs))
    throw new Error(`Actual fetch inputs differ for ${stage}`)
  if (JSON.stringify(sources.map((row: any) => row.url)) !== JSON.stringify(expectedSources))
    throw new Error(`Actual durable source URLs differ for ${stage}`)
  const toolIDs = new Set(fetches.map((row: any) => row.id))
  const outcomes = canonical.outcomes.filter((row: any) => toolIDs.has(row.requestPartID))
  if (outcomes.length !== fetches.length || outcomes.some((row: any) => row.outcome !== "completed"))
    throw new Error(`Actual fetch completion differs for ${stage}`)
  if (provider.requests.some((row: any) => row.model !== "gpt-6.1-sol" || row.streaming !== true || row.response_reader?.terminal?.kind !== "eof"))
    throw new Error(`Actual provider reader contract differs for ${stage}`)
  const physicalAt = Date.parse(closure.native.observedAtUtc)
  results.push({ stage, toolInputs: fetches.map((row: any) => row.data.input), sources,
    sessions: canonical.sessions.map((row: any) => ({ id: row.id, projectID: row.project_id, kind: row.kind })),
    completedFetches: outcomes.length, providerEOF: provider.requests.length,
    physicalAtUtc: closure.native.observedAtUtc, deadlineAt: closure.native.deadlineAt,
    remainingAtPhysicalMs: closure.native.deadlineAt - physicalAt,
    qualification: stage === "01" ? "Observed before: requested chapter discarded in actual Source" : "Actual durable chapter URLs preserved; UI navigation and screenshots reviewed separately by Root" })
}
await fs.writeFile(path.join(base, "actual-source-facts.json"), JSON.stringify(results, null, 2) + "\n")
console.log(JSON.stringify(results.map(({ stage, completedFetches, providerEOF, remainingAtPhysicalMs }) => ({stage, completedFetches, providerEOF, remainingAtPhysicalMs}))))
