const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")
const assert = require("node:assert/strict")
const root = __dirname
const read = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, name))))
const text = row => JSON.parse(row.data)
const corpora = []
const results = ["sol", "luna"].map(model => {
  const name = `catalog-evidence-${model}`
  const report = read(`${name}.json.gz`)
  const audit = read(`${name}.json.requests.json.gz`)
  const facts = read(`${name}-facts.json.gz`)
  const entry = report.cases[0]
  assert.equal(report.cases.length, 1)
  assert.equal(report.model, model === "sol" ? "openai/gpt-6.1-sol" : "openai/gpt-6-luna")
  assert.equal(report.credential, "available")
  assert.equal(report.modelProjection, "verified")
  assert.equal(report.contextTokens, 19000)
  assert.equal(report.effectiveHelperSteps, 80)
  assert.equal(report.nonceSeed, "7be39fa820d4")
  assert.deepEqual(report.requests, audit)
  assert.equal(facts.usage.length, audit.length)
  for (const request of audit) {
    assert.equal(request.model, report.model.slice("openai/".length))
    assert.equal(request.streaming, true)
    assert.equal(request.status, 200)
    assert.equal(request.response_reader.state, "settled")
    assert.equal(request.response_reader.terminal.kind, "eof")
  }
  for (const usage of facts.usage) {
    assert.equal(usage.provider_id, "openai")
    assert.equal(usage.model_id, report.model.slice("openai/".length))
  }
  const helperIndex = facts.messages.findIndex(message => message.id === entry.summaryID)
  assert.equal(helperIndex, entry.originalMessageCount)
  assert.equal(entry.originalMessageCount, 1029)
  const originalIDs = new Set(facts.messages.slice(0, helperIndex).map(message => message.id))
  const originalText = facts.parts.filter(part => originalIDs.has(part.message_id) && text(part).type === "text")
  const observations = originalText.map(text).filter(part => part.text.startsWith("Historical observation "))
  assert.deepEqual(observations.map(part => part.text), Array.from({ length: 1024 }, (_, index) =>
    `Historical observation ${index}: routine measurement remains provisional. No new user directive or verified result is recorded.`))
  corpora.push(originalText.map(part => text(part).text))
  assert.equal(entry.originalHistoryPreserved, true)
  const helper = text(facts.messages[helperIndex])
  assert.equal(helper.summary, true)
  assert.equal(helper.finish, "stop")
  assert.equal(entry.checkpoint.status, "valid_checkpoint")
  const marker = facts.parts.filter(part => part.message_id === entry.summaryID).map(text).find(part => part.type === "compaction")
  assert(marker)
  const control = facts.controls.find(control => control.kind === "compaction_request")
  assert(control)
  assert.deepEqual(facts.controlEvents.filter(event => event.control_id === control.id).map(event => event.kind).filter(kind => kind === "consumed" || kind === "failed"), ["consumed"])
  const outcomes = new Map(facts.outcomes.map(outcome => [outcome.request_part_id, text(outcome)]))
  const source = facts.requests.find(request => request.id === entry.expected.part_id)
  assert(source)
  const sourceRequest = text(source), sourceOutcome = outcomes.get(source.id)
  assert.equal(sourceRequest.callID, entry.expected.call_id)
  assert(sourceRequest.input.request.includes(entry.expected.input_reference))
  assert.equal(sourceOutcome.outcome, "failed")
  assert.equal(sourceOutcome.failure.name, entry.expected.failure_name)
  assert.equal(sourceOutcome.failure.data.evidence, entry.expected.evidence)
  assert.equal(sourceOutcome.failure.data.next_offset, entry.expected.next_offset)
  assert.equal(sourceOutcome.metadata.traceID, entry.expected.trace_id)
  const tools = facts.requests.filter(request => request.message_id === entry.summaryID).map(request => ({
    id: request.id, request: text(request), outcome: outcomes.get(request.id),
  }))
  const reads = tools.filter(tool => tool.request.tool === "ReadCompactionEvidence")
  const catalogPages = reads.filter(tool => tool.outcome.outcome === "completed" && tool.request.input.field === "catalog")
    .map(tool => JSON.parse(tool.outcome.output))
  assert(catalogPages.length > 0)
  for (const page of catalogPages) {
    assert.equal(page.messageID, entry.summaryID)
    assert.equal(page.source, "compaction-catalog")
    assert.equal(page.content.length, page.end - page.offset)
  }
  for (const retained of entry.retainedUserSources) {
    const owner = facts.messages.find(message => message.id === retained.messageID)
    assert.equal(text(owner).role, "user")
    assert.equal(text(owner).author, retained.author)
    for (const selected of retained.parts) {
      const part = facts.parts.find(part => part.id === selected.partID)
      assert.equal(part.message_id, owner.id)
      assert(text(part).text.includes(selected.text))
    }
  }
  const actual = JSON.parse(entry.answer.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""))
  const metrics = Object.fromEntries(Object.entries(entry.expected).map(([key, expected]) => [key, {
    expected, actual: actual[key], pass: actual[key] === expected,
  }]))
  assert.deepEqual(metrics, entry.metrics)
  const passedFields = Object.values(metrics).filter(metric => metric.pass).length
  assert.equal(entry.status, passedFields === 11 ? "passed" : "failed")
  assert.equal(report.status, entry.status)
  const probe = audit.at(-1).input_evidence.probes.find(probe => probe.id === "catalog-evidence")
  const sourceInActualUserRole = probe.matches.some(match => match.message_role === "user" && /^\/(?:input|messages)\/\d+\/role$/.test(match.role_json_pointer))
  const farthestCatalogPosition = Math.max(...catalogPages.map(page => page.end))
  if (model === "sol") {
    assert.equal(passedFields, 11)
    assert.equal(sourceInActualUserRole, true)
    assert.equal(farthestCatalogPosition, catalogPages[0].totalChars)
  } else {
    assert.equal(passedFields, 3)
    assert.equal(entry.retainedUserSources.length, 0)
    assert.equal(farthestCatalogPosition, 62719)
    assert.equal(audit.length, 13)
    assert.equal(helper.finish, "stop")
  }
  return { name, model: report.model, status: report.status, requests: audit.length, originalMessages: entry.originalMessageCount,
    fields: 11, passedFields, sourceInActualUserRole, catalogPages: catalogPages.length, farthestCatalogPosition,
    catalogChars: catalogPages[0].totalChars, toolFailures: tools.filter(tool => tool.outcome.outcome === "failed").map(tool => ({
      tool: tool.request.tool, input: tool.request.input, failure: tool.outcome.failure,
    })), metrics }
})
assert.deepEqual(corpora[0], corpora[1], "Both models received the same authored original text")
const expected = results.map(result => Object.fromEntries(Object.entries(result.metrics).filter(([key]) => key !== "part_id").map(([key, metric]) => [key, metric.expected])))
assert.deepEqual(expected[0], expected[1], "Opaque source values match; original Part identity remains runtime-owned")
console.log(JSON.stringify({ status: "failed", review: "passed", authoredTextMatched: true, requests: results.reduce((sum, result) => sum + result.requests, 0), results,
  limits: ["The Luna summary completed before the step limit with most catalog material unread.", "A valid shrinking checkpoint does not establish semantic fidelity.", "No paired full-history answer lane or native product parity is claimed by this catalog experiment."] }, null, 2))
