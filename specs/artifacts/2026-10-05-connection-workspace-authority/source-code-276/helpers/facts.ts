import fs from "node:fs/promises"
import { parseExaCodeSearchSources } from "D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/codesearch"
const base = "D:/myhexin-local/opencorvus/specs/artifacts/2026-10-05-connection-workspace-authority/source-code-276/live-01"
const canonical = JSON.parse(await fs.readFile(`${base}/canonical-current-conversations.json`, "utf8"))
const outcome = canonical.outcomes[0]
const tool = JSON.parse(canonical.tools[0].data)
const projected = parseExaCodeSearchSources(outcome.output)
const persisted = canonical.parts.filter((part: any) => part.type === "source-url")
for (const [index, source] of projected.entries()) {
  const current = persisted[index]
  for (const [key, value] of Object.entries(source)) {
    if (JSON.stringify(current?.[key]) !== JSON.stringify(value)) throw new Error(`Persisted source field differs: ${index}/${key}`)
  }
}
const protocolText = outcome.metadata.mcpResult.content
  .filter((block: any) => block.type === "text")
  .map((block: any) => block.text)
  .join("\n")
if (protocolText !== outcome.output) throw new Error("Complete protocol text and durable output differ")
const audit = JSON.parse(await fs.readFile(`${base}/source-code-276-live-01-final-provider-audit.json`, "utf8"))
const facts = {
  input: tool.input,
  toolPartID: canonical.tools[0].id,
  outcome: outcome.outcome,
  completeOutputChars: outcome.output.length,
  completeProtocolTextEqualsOutput: true,
  projectedSources: projected.length,
  persistedSources: persisted.length,
  sourceFieldsEqual: true,
  sources: persisted.map((source: any) => ({ id: source.id, messageID: source.messageID, title: source.title, url: source.url, snippetChars: source.snippet.length })),
  requests: audit.requests.map((request: any) => ({ model: request.model, streaming: request.streaming, agent: request.response_reader.requestContext.streamRequest.agentID, sessionID: request.response_reader.requestContext.sessionID, terminal: request.response_reader.terminal.kind })),
  boundary: "Current production parser and real canonical SQLite/Provider archive comparison; backend facts only, visual acceptance remains manual screenshots",
}
await fs.writeFile(`${base}/current-source-facts.json`, JSON.stringify(facts, null, 2) + "\n", { flag: "wx" })
console.log(JSON.stringify({ input: facts.input, projectedSources: facts.projectedSources, persistedSources: facts.persistedSources, completeOutputChars: facts.completeOutputChars, sourceFieldsEqual: facts.sourceFieldsEqual, completeProtocolTextEqualsOutput: facts.completeProtocolTextEqualsOutput }))
