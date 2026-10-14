const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

const root = __dirname
const responseBoundary = process.argv.includes("--response-boundary")
const cases = responseBoundary
  ? [{ count: 256, steps: 20, completed: true }, { count: 1024, steps: 20, completed: false }, { count: 1024, steps: 80, completed: true }]
  : [{ count: 256, steps: 20, completed: true }, { count: 1024, steps: 20, completed: false }]
const results = cases.map(({ count, steps, completed }) => {
  const name = responseBoundary ? `response-boundary-${count}-${steps}` : `catalog-scale-${count}`
  const run = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `${name}.json.gz`))))
  assert.equal(run.remoteModelRequests, 0)
  assert.equal(run.sources, count)
  assert.equal(run.capacity, 19000)
  assert.equal(run.original.length, count + 2)
  const sourceIDs = new Set(run.original.map((message) => message.info.id))
  assert.deepEqual(run.reopened.filter((message) => sourceIDs.has(message.info.id)), run.original)
  assert.deepEqual(run.reopened.at(-1), run.helper)
  const tools = run.helper.parts.filter((part) => part.type === "tool")
  const reads = tools.filter((part) => part.tool === "ReadCompactionEvidence")
  const catalogReads = reads.filter((part) => part.state.input.field === "catalog")
  assert.deepEqual(catalogReads.map((part) => JSON.parse(part.state.output)), run.pages)
  const wireCalls = new Map()
  const wireResults = new Map()
  const sourcePrefix = run.original.slice(1).map(message => message.info.id)
  const toolFacts = new Map(tools.map(part => [part.callID, part]))
  for (const request of run.requests) {
    assert.equal(request.model, run.target.modelID)
    assert.equal(request.stream, true)
    if (responseBoundary) {
      assert.equal(run.steps, steps)
      const input = request.messages.filter(message => message.role === "user")
        .map(message => typeof message.content === "string" ? message.content : message.content.map(part => part.text ?? "").join("\n")).join("\n")
      const notices = [...input.matchAll(/\{"kind":"compaction_catalog_reference"[^\n}]*\}/g)].map(match => JSON.parse(match[0]))
      assert.equal(notices.length, 1)
      assert.equal(notices[0].messageID, run.helper.info.id)
      assert.deepEqual([...input.matchAll(/<message id="([^"]+)"/g)].map(match => match[1]), sourcePrefix.slice(0, notices[0].inlineMessages))
    }
    for (const message of request.messages) {
      for (const call of message.tool_calls ?? []) {
        const fact = toolFacts.get(call.id)
        assert.equal(call.function.name, fact.tool)
        assert.deepEqual(JSON.parse(call.function.arguments), fact.state.input)
        wireCalls.set(call.id, call)
      }
      if (message.role === "tool") {
        assert.equal(message.content, toolFacts.get(message.tool_call_id).state.output)
        wireResults.set(message.tool_call_id, message.content)
      }
    }
  }
  let delivered = ""
  for (const [index, part] of catalogReads.entries()) {
    const page = run.pages[index]
    assert.equal(page.messageID, run.helper.info.id)
    assert.equal(page.sessionID, run.helper.info.sessionID)
    assert.equal(page.source, "compaction-catalog")
    assert.equal(page.originalRole, "assistant")
    assert.equal(page.originalAuthor, "compaction")
    assert.equal(page.offset, delivered.length)
    assert.equal(page.end, page.offset + page.content.length)
    assert.equal(page.nextOffset, page.end === page.totalChars ? null : page.end)
    assert.equal(part.state.status, "completed")
    assert.equal(part.state.input.message_id, run.helper.info.id)
    assert.equal(part.state.input.offset, page.offset)
    assert.deepEqual(JSON.parse(wireCalls.get(part.callID).function.arguments), part.state.input)
    assert.equal(wireResults.get(part.callID), part.state.output)
    delivered += page.content
  }
  assert.equal(delivered.length, run.deliveredCatalogChars)
  const notes = tools.filter((part) => part.tool === "SaveCompactionNotes")
  assert.equal(notes.length, catalogReads.length)
  for (const [index, part] of notes.entries()) {
    const receipt = JSON.parse(part.state.output)
    assert.equal(part.state.status, "completed")
    assert.equal(receipt.notes_call_id, part.callID)
    assert.equal(receipt.source_reads.length, 1)
    const read = receipt.source_reads[0]
    assert.equal(read.messageID, run.helper.info.id)
    assert.equal(read.field, "catalog")
    assert.equal(read.source, "compaction-catalog")
    assert.equal(read.offsetUnit, "utf16_code_units")
    assert.equal(read.nextUnreadOffset, run.pages[index].nextOffset)
    assert.deepEqual(read.ranges, [[0, run.pages[index].end]])
    assert.deepEqual(read.readerCalls, catalogReads.slice(0, index + 1).map((part) => part.callID))
  }
  if (completed) {
    assert.equal(run.status, "completed")
    assert.equal(run.control.status, "consumed")
    assert.equal(run.control.payload.result_summary_message_id, run.helper.info.id)
    assert.equal(run.helper.info.summary, true)
    assert.equal(run.helper.info.finish, "stop")
    assert(run.requests.length <= steps)
    const entries = JSON.parse(delivered)
    assert.equal(entries.length, count + 1)
    for (const [index, original] of run.original.slice(1).entries()) {
      const entry = entries[index]
      assert.equal(entry.role, original.info.role)
      assert(entry.content[0].text.includes(`id="${original.info.id}" role="${original.info.role}"`))
      assert(entry.content[0].text.includes(`author="${original.info.author}"`))
      for (const part of original.parts) assert(entry.content[0].text.includes(`part_id="${part.id}"`))
    }
    const source = run.original.at(-2)
    assert.equal(run.sourcePage.messageID, source.info.id)
    assert.equal(run.sourcePage.partID, source.parts[0].id)
    assert.equal(run.sourcePage.content, source.parts[0].text)
    const selected = tools.find((part) => part.tool === "RetainCompactionUserText")
    assert.equal(selected.state.status, "completed")
    assert.deepEqual(selected.state.input.excerpts, [{ part_id: source.parts[0].id, text: source.parts[0].text }])
    assert.deepEqual(run.replay.find((message) => message.info.id === source.info.id).info, source.info)
    assert.equal(run.replay.find((message) => message.info.id === source.info.id).parts[0].text, source.parts[0].text)
  } else {
    assert.equal(run.status, "step_limit")
    assert.equal(run.requests.length, steps)
    assert.equal(run.control.status, "failed")
    assert.equal(run.helper.info.summary, false)
    assert.equal(run.helper.info.finish, "error")
    assert.equal(run.helper.info.error.name, "CompactionContinuationMissingError")
    assert(run.pages.at(-1).nextOffset < run.catalogChars)
    assert.deepEqual(run.replay.filter((message) => sourceIDs.has(message.info.id)), run.original)
  }
  return { sources: count, steps, observedStatus: run.status, requests: run.requests.length, pages: run.pages.length,
    catalogChars: run.catalogChars, deliveredChars: delivered.length, originalMessages: run.original.length }
})
console.log(JSON.stringify({ mechanicalReview: "passed", responseBoundary: responseBoundary ? "passed" : "not_assessed", largeCatalogCompletion: responseBoundary ? "configured_80_passed_default_20_failed" : "failed_at_1024_sources", paidRequests: 0, results }, null, 2))
