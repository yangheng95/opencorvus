const assert = require("node:assert/strict")
const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")

const root = __dirname
const results = [256, 1024].map((count) => {
  const run = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root, `catalog-scale-${count}.json.gz`))))
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
  for (const request of run.requests) {
    assert.equal(request.model, run.target.modelID)
    assert.equal(request.stream, true)
    for (const message of request.messages) {
      for (const call of message.tool_calls ?? []) wireCalls.set(call.id, call)
      if (message.role === "tool") wireResults.set(message.tool_call_id, message.content)
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
  if (count === 256) {
    assert.equal(run.status, "completed")
    assert.equal(run.control.status, "consumed")
    assert.equal(run.control.payload.result_summary_message_id, run.helper.info.id)
    assert.equal(run.helper.info.summary, true)
    assert.equal(run.helper.info.finish, "stop")
    assert.equal(run.requests.length, 19)
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
    assert.equal(run.requests.length, 20)
    assert.equal(run.control.status, "failed")
    assert.equal(run.helper.info.summary, false)
    assert.equal(run.helper.info.finish, "error")
    assert.equal(run.helper.info.error.name, "CompactionContinuationMissingError")
    assert(run.pages.at(-1).nextOffset < run.catalogChars)
    assert.deepEqual(run.replay.filter((message) => sourceIDs.has(message.info.id)), run.original)
  }
  return { sources: count, observedStatus: run.status, requests: run.requests.length, pages: run.pages.length,
    catalogChars: run.catalogChars, deliveredChars: delivered.length, originalMessages: run.original.length }
})
console.log(JSON.stringify({ mechanicalReview: "passed", largeCatalogCompletion: "failed_at_1024_sources", paidRequests: 0, results }, null, 2))
