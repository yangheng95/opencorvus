const fs = require("node:fs"), path = require("node:path"), zlib = require("node:zlib"), assert = require("node:assert/strict")
const read = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, name))))
const data = row => JSON.parse(row.data)
const merge = ranges => ranges.toSorted((a, b) => a[0] - b[0]).reduce((out, range) => {
  const last = out.at(-1)
  if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
  else out.push([...range])
  return out
}, [])
const name = process.argv[2]
assert(/^(?:cross-model-policy-revisions(?:-range|-sol)?|hierarchy-policy-revisions-luna(?:-retry[0-9]+)?)$/.test(name))
const run = read(`${name}.json.gz`), audit = read(`${name}.json.requests.json.gz`), facts = read(`${name}-facts.json.gz`)
assert.equal(run.credential, "available")
assert.equal(run.modelProjection, "verified")
assert.equal(run.contextTokens, 19000)
assert.equal(run.fullContextTokens, 256000)
assert.deepEqual(run.requests, audit)
assert.equal(facts.usage.length, audit.length)
for (const q of audit) {
  assert.equal(q.model, run.model.slice(7))
  assert.equal(q.streaming, true)
  assert.equal(q.response_reader.state, "settled")
  assert.equal(q.response_reader.requestContext.streamRequest.apiModelID, run.model.slice(7))
}
for (const usage of facts.usage) {
  assert.equal(usage.provider_id, "openai")
  assert.equal(usage.model_id, run.model.slice(7))
}
assert.deepEqual(facts.credentialCleanup, [{ name: "auth.json", present: false }, { name: "models.json", present: false }])
const messages = new Map(facts.messages.map(row => [row.id, row]))
const outcomes = new Map(facts.outcomes.map(row => [row.request_part_id, data(row)]))
const effects = new Map(facts.effects.map(item => [item.file, item.content]))
function authored(facts, sessionID) {
  const outcomes = new Map(facts.outcomes.map(row => [row.request_part_id, data(row)]))
  return facts.messages.filter(row => row.session_id === sessionID && data(row).author !== "compaction").map(row => ({
    role: data(row).role, author: data(row).author,
    text: facts.parts.filter(part => part.message_id === row.id && data(part).type === "text").map(part => data(part).text),
    tools: facts.requests.filter(part => part.message_id === row.id).map(part => ({
      tool: data(part).tool, input: data(part).input, output: outcomes.get(part.id).output,
    })),
  }))
}
const baseline = read("cross-model-policy-revisions-range-facts.json.gz")
const baselineReport = read("cross-model-policy-revisions-range.json.gz")
const currentCorpus = authored(facts, run.cases[0].sessionID)
assert.deepEqual(currentCorpus, authored(baseline, baselineReport.cases[0].sessionID).slice(0, currentCorpus.length))
const result = run.cases.map(c => {
  const nonce = c.expected.artifact_id.slice("ARTIFACT-".length), revision = `${nonce}-r${c.round}`
  const expected = { kind: c.round % 2 ? "release" : "draft", channel: `CHANNEL-${revision}`, region: `REGION-${revision}`, artifact_id: `ARTIFACT-${nonce}`, policy_revision: `POLICY-${revision}` }
  assert.deepEqual(c.expected, expected)
  const source = facts.parts.find(part => part.message_id === c.updateID && data(part).type === "text")
  assert(source)
  assert.equal(data(messages.get(c.updateID)).role, "user")
  assert.equal(data(messages.get(c.updateID)).author, "user")
  const original = data(source).text
  const authorization = original.split("\n").find(line => Object.values(expected).every(value => line.includes(value)))
  assert(authorization)
  const authorizationOffset = original.indexOf(authorization)
  const helpers = facts.messages.filter(row => row.session_id === c.sessionID && data(row).author === "compaction" && data(row).parentID === c.sourceID)
  const helper = helpers.at(-1)
  assert(helper)
  const helperRequests = audit.filter(q => q.response_reader.requestContext?.activity?.assistantMessageID === helper.id)
  const control = facts.controls.find(row => row.session_id === c.sessionID && row.kind === "compaction_request" && JSON.parse(row.payload).source_user_message_id === c.sourceID)
  assert(control)
  const terminal = facts.controlEvents.filter(event => event.control_id === control.id && ["consumed", "failed"].includes(event.kind))
  const tools = facts.requests.filter(row => row.message_id === helper.id).map(row => ({ id: row.id, ...data(row), outcome: outcomes.get(row.id) }))
  const currentReads = []
  const trace = tools.map(tool => {
    let output
    if (tool.outcome?.outcome === "completed") output = JSON.parse(tool.outcome.output)
    if (tool.tool === "ReadCompactionEvidence" && tool.input.field === "text" && tool.outcome?.outcome === "completed") {
      const part = facts.parts.find(row => row.id === output.partID), owner = messages.get(part.message_id)
      assert.equal(output.messageID, owner.id)
      assert.equal(output.originalRole, data(owner).role)
      assert.equal(output.originalAuthor, data(owner).author)
      assert.equal(output.content, data(part).text.slice(output.offset, output.end))
      assert.equal(output.totalChars, data(part).text.length)
      if (output.partID === source.id) currentReads.push({
        callID: tool.callID, offset: output.offset, end: output.end,
        hasLaterHelperRequest: helperRequests.some(q => q.response_reader.receivedAt > tool.outcome.time.end),
      })
    }
    if (tool.tool === "SaveCompactionNotes" && output) {
      const receipt = output.source_reads.find(item => item.partID === source.id && item.field === "text")
      if (currentReads.length) {
        assert(receipt)
        assert.deepEqual(receipt.ranges, merge(currentReads.map(page => [page.offset, page.end])))
        assert.deepEqual(receipt.readerCalls, [...new Set(currentReads.map(page => page.callID))])
      }
    }
    return { callID: tool.callID, tool: tool.tool, input: tool.input, outcome: tool.outcome?.outcome,
      ...(tool.outcome?.outcome === "failed" ? { failure: tool.outcome.failure } : {}),
      ...(tool.tool === "ReadCompactionEvidence" && output ? { page: { messageID: output.messageID, partID: output.partID, field: output.field, offset: output.offset, end: output.end, nextOffset: output.nextOffset, totalChars: output.totalChars, containsCurrentRegion: output.content.includes(expected.region) } } : {}) }
  })
  const selected = c.retainedUserSources?.filter(item => item.messageID === c.updateID) ?? []
  for (const item of selected) {
    assert.equal(item.role, "user")
    assert.equal(item.author, "user")
    for (const part of item.parts) {
      assert.equal(part.partID, source.id)
      assert(original.includes(part.text))
    }
  }
  const selectedText = selected.flatMap(item => item.parts.map(part => part.text)).join("\n")
  const lanes = (c.lanes ?? []).map(lane => {
    assert.equal(lane.contextCapacity.tokens, lane.lane === "full" ? 256000 : 19000)
    const canonicalCalls = facts.requests.filter(row => row.message_id === lane.assistantMessageID && data(row).tool === "WriteDeliveryArtifact")
    assert.equal(canonicalCalls.length, lane.effects.length)
    const actual = lane.effects.map(effect => {
      const file = effects.get(effect.file)
      assert.deepEqual(file, { callID: effect.callID, sessionID: lane.sessionID, action: effect.action })
      const call = canonicalCalls.find(row => data(row).callID === effect.callID)
      assert(call)
      assert.deepEqual(data(call).input, effect.action)
      assert.equal(outcomes.get(call.id).outcome, "completed")
      assert.deepEqual(JSON.parse(outcomes.get(call.id).output), file)
      return effect.action
    })
    const passedFields = Object.keys(expected).filter(key => actual.length === 1 && actual[0][key] === expected[key]).length
    assert.equal(lane.status, passedFields === 5 ? "passed" : "failed")
    const probe = audit[lane.requestStart].input_evidence.probes.find(probe => probe.id === `policy-revisions.r${c.round}`)
    const currentSourceInUserRole = probe.matches.some(match => match.message_role === "user" && /^\/(?:input|messages)\/\d+\/role$/.test(match.role_json_pointer))
    if (lane.lane === "full") assert.equal(currentSourceInUserRole, true)
    return { lane: lane.lane, status: lane.status, actual, passedFields, currentSourceInUserRole }
  })
  if (c.checkpoint) {
    assert.equal(c.checkpoint.summaryID, helper.id)
    assert.equal(c.checkpoint.status, "valid_checkpoint")
    assert.equal(data(helper).finish, "stop")
    assert.equal(data(helper).summary, true)
    assert.deepEqual(terminal.map(event => event.kind), ["consumed"])
    assert.equal(facts.parts.filter(part => part.message_id === helper.id && data(part).type === "compaction").length, 1)
    assert.deepEqual(lanes.map(lane => lane.lane), ["full", "compacted"])
    assert.equal(c.status, lanes.every(lane => lane.status === "passed") ? "passed" : "failed")
  } else {
    assert.equal(c.status, "error")
    assert.equal(data(helper).finish, "error")
    assert.equal(data(helper).error.name, "CompactionContinuationMissingError")
    assert.deepEqual(terminal.map(event => event.kind), ["failed"])
    assert.equal(c.requestEnd - c.requestStart, run.effectiveHelperSteps)
  }
  return { round: c.round, status: c.status, expected, summary: c.summary, helperID: helper.id,
    error: data(helper).error, currentSource: { messageID: c.updateID, partID: source.id, chars: original.length,
      authorization, authorizationRange: [authorizationOffset, authorizationOffset + authorization.length],
      executedReadRanges: merge(currentReads.map(page => [page.offset, page.end])),
      readResultsWithLaterHelperRequest: merge(currentReads.filter(page => page.hasLaterHelperRequest).map(page => [page.offset, page.end])),
      readResultsWithoutLaterHelperRequest: merge(currentReads.filter(page => !page.hasLaterHelperRequest).map(page => [page.offset, page.end])),
      rangeEvidence: "Canonical successful read outcomes. Later-request timestamps establish a subsequent helper request, not a complete wire-content capture or model comprehension." },
    selected, sourceRolePreserved: Object.values(expected).every(value => selectedText.includes(value)) && lanes.some(lane => lane.lane === "compacted" && lane.currentSourceInUserRole), lanes, trace }
})
const status = result.length === run.rounds && result.every(entry => entry.status === "passed") ? "passed" : "failed"
assert.equal(run.status, status)
console.log(JSON.stringify({ name, status, review: "passed", model: run.model, requests: audit.length,
  canonicalUsageRows: facts.usage.length, plannedRounds: run.rounds, completedCheckpoints: result.filter(c => c.lanes.length === 2).length,
  actualActions: result.flatMap(c => c.lanes).length, passedActions: result.flatMap(c => c.lanes).filter(lane => lane.status === "passed").length,
  passedFields: result.flatMap(c => c.lanes).reduce((sum, lane) => sum + lane.passedFields, 0),
  sourceRolePreserved: result.filter(c => c.sourceRolePreserved).length, matchedAuthoredPrefixMessages: currentCorpus.length,
  credentialCleanup: facts.credentialCleanup, cases: result,
  limits: ["Full-history action failure is distinguished from compaction loss.", "A valid checkpoint is not proof of semantic preservation.", "This archive records captured original effects and facts; it does not execute new model actions."] }, null, 2))
