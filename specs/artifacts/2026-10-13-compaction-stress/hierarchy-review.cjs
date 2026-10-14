const fs = require("node:fs")
const path = require("node:path")
const zlib = require("node:zlib")
const assert = require("node:assert/strict")
const read = name => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname, name))))
const data = row => JSON.parse(row.data)
const empty = () => ({ users: 0, assistants: 0, tools: 0, toolErrors: 0, diagnostics: 0 })
const sum = counts => counts.reduce((a, b) => {
  for (const key of Object.keys(a)) a[key] += b[key]
  return a
}, empty())
const merge = ranges => ranges.toSorted((a, b) => a[0] - b[0]).reduce((out, range) => {
  const last = out.at(-1)
  if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1])
  else out.push([...range])
  return out
}, [])

// Reconstruct only delivered node spans, including a source split across reads.
// Counts are factual source-record counts, never a relevance/semantic score.
function directory(pages, root, originals) {
  const chars = new Map(), refs = new Map([[root.offset, root]]), decoded = new Map()
  for (const page of pages) {
    assert.equal(page.content.length, page.end - page.offset)
    assert.equal(page.nextOffset, page.end === page.totalChars ? null : page.end)
    for (let i = 0; i < page.content.length; i++) {
      const at = page.offset + i
      if (chars.has(at)) assert.equal(chars.get(at), page.content[i])
      chars.set(at, page.content[i])
    }
  }
  for (const [offset, ref] of refs) {
    const content = []
    for (let at = offset; at < ref.end && chars.has(at); at++) content.push(chars.get(at))
    if (content.length !== ref.end - offset) continue
    const node = JSON.parse(content.join(""))
    decoded.set(offset, node)
    if (node.kind === "directory") {
      assert.equal(node.children.length, 2)
      assert.equal(node.children[0].records[0], ref.records[0])
      assert.equal(node.children[0].records[1], node.children[1].records[0])
      assert.equal(node.children[1].records[1], ref.records[1])
      assert.deepEqual(sum(node.children.map(child => child.counts)), ref.counts)
      for (const child of node.children) {
        assert(child.offset > 0 && child.end < offset && child.limit > 0)
        assert(child.limit <= child.end - child.offset)
        refs.set(child.offset, child)
      }
    } else {
      assert.equal(node.kind, "source")
      assert.equal(ref.records[1] - ref.records[0], 1)
      const original = originals[node.messageIndex]
      assert(original)
      assert.equal(node.role, original.info.role)
      assert(node.text.includes(`id="${original.info.id}" role="${original.info.role}"`))
      assert(node.text.includes(`author="${original.info.author}"`))
      assert(node.text.includes('projection="catalog-record"'))
      const partIDs = [...node.text.matchAll(/part_id="([^"]+)"/g)].map(match => match[1])
      for (const id of partIDs) assert(original.parts.some(part => part.id === id))
      if (node.toolState) {
        const tool = original.parts.find(part => part.type === "tool" && partIDs.includes(part.id))
        assert.equal(tool.state.status, node.toolState)
        assert(node.text.includes(`call_id="${tool.callID}"`))
      }
      assert.deepEqual(ref.counts, {
        users: Number(node.role === "user"), assistants: Number(node.role === "assistant"),
        tools: Number(node.toolState !== undefined), toolErrors: Number(node.toolState === "error"),
        diagnostics: Number(node.diagnostics === true),
      })
    }
  }
  for (const page of pages) assert([...refs.values()].some(ref => page.offset >= ref.offset && page.end <= ref.end))
  return { nodes: decoded.size, leaves: [...decoded.values()].filter(node => node.kind === "source").length,
    deliveredChars: pages.reduce((n, page) => n + page.content.length, 0), uniqueChars: chars.size }
}

function receipts(tools) {
  const seen = []
  for (const tool of tools) {
    if (tool.state.status !== "completed") continue
    if (tool.tool === "ReadCompactionEvidence") seen.push({ callID: tool.callID, page: JSON.parse(tool.state.output) })
    if (tool.tool !== "SaveCompactionNotes") continue
    const receipt = JSON.parse(tool.state.output)
    assert.equal(receipt.status, "saved")
    assert.equal(receipt.notes_call_id, tool.callID)
    const keys = new Set(seen.map(({ page }) => JSON.stringify([page.messageID, page.partID, page.field])))
    assert.equal(receipt.source_reads.length, keys.size)
    for (const source of receipt.source_reads) {
      const matching = seen.filter(({ page }) => page.messageID === source.messageID && page.partID === source.partID && page.field === source.field)
      assert(matching.length > 0)
      assert.deepEqual(source.readerCalls, [...new Set(matching.map(item => item.callID))])
      const ranges = merge(matching.map(({ page }) => [page.offset, page.end]))
      assert.deepEqual(source.ranges, ranges)
      const end = ranges[0][0] === 0 ? ranges[0][1] : 0
      assert.equal(source.nextUnreadOffset, end === source.totalChars ? null : end)
      for (const { page } of matching) for (const key of ["sessionID", "source", "totalChars", "originalRole", "originalAuthor"])
        assert.equal(source[key], page[key])
      assert.equal(source.offsetUnit, "utf16_code_units")
    }
  }
}

function local() {
  return [[256, 20], [1024, 20], [1024, 2]].map(([count, steps]) => {
    const run = read(`hierarchy-local-${count}-${steps}.json.gz`)
    assert.equal(run.remoteModelRequests, 0)
    assert.equal(run.sources, count)
    assert.equal(run.steps, steps)
    assert.equal(run.capacity, 19000)
    const ids = new Set(run.original.map(message => message.info.id))
    assert.deepEqual(run.reopened.filter(message => ids.has(message.info.id)), run.original)
    assert.deepEqual(run.reopened.at(-1), run.helper)
    const tools = run.helper.parts.filter(part => part.type === "tool")
    const facts = new Map(tools.map(part => [part.callID, part]))
    const delivered = new Map()
    let root
    for (const request of run.requests) {
      assert.equal(request.model, run.target.modelID)
      assert.equal(request.stream, true)
      const input = request.messages.filter(message => message.role === "user").map(message => typeof message.content === "string"
        ? message.content : message.content.map(part => part.text ?? "").join("\n")).join("\n")
      const notices = input.split("\n").filter(line => line.startsWith('{"kind":"compaction_catalog_reference"')).map(line => JSON.parse(line))
      assert.equal(notices.length, 1)
      const notice = notices[0]
      assert.equal(notice.messageID, run.helper.info.id)
      if (root) assert.deepEqual(notice.root, root)
      root = notice.root
      assert.deepEqual([...input.matchAll(/<message id="([^"]+)"/g)].map(match => match[1]), run.original.slice(1, 1 + notice.inlineMessages).map(message => message.info.id))
      for (const message of request.messages) {
        for (const call of message.tool_calls ?? []) {
          const fact = facts.get(call.id)
          assert.equal(call.function.name, fact.tool)
          assert.deepEqual(JSON.parse(call.function.arguments), fact.state.input)
        }
        if (message.role === "tool") {
          assert.equal(message.content, facts.get(message.tool_call_id).state.output)
          delivered.set(message.tool_call_id, message.content)
        }
      }
    }
    const catalog = tools.filter(part => part.tool === "ReadCompactionEvidence" && part.state.input.field === "catalog")
    const deliveredCatalog = catalog.filter(part => delivered.has(part.callID)).map(part => JSON.parse(part.state.output))
    assert.deepEqual(deliveredCatalog, run.pages)
    for (const part of catalog) {
      const page = JSON.parse(part.state.output)
      assert.equal(part.state.status, "completed")
      assert.equal(page.messageID, run.helper.info.id)
      assert.equal(page.sessionID, run.helper.info.sessionID)
      assert.equal(page.offset, part.state.input.offset)
      assert.equal(page.source, "compaction-catalog")
    }
    const inspected = directory(run.pages, root, run.original.slice(1))
    assert.equal(inspected.nodes, run.nodes)
    assert.equal(inspected.deliveredChars, run.deliveredCatalogChars)
    receipts(tools)
    if (steps === 2) {
      assert.equal(run.status, "step_limit")
      assert.equal(run.requests.length, 2)
      assert.equal(catalog.length, 2)
      assert.equal(deliveredCatalog.length, 1)
      assert.equal(run.helper.info.finish, "error")
      assert.equal(run.helper.info.error.name, "CompactionContinuationMissingError")
      assert.equal(run.control.status, "failed")
      assert.deepEqual(run.replay.filter(message => ids.has(message.info.id)), run.original)
    } else {
      assert.equal(run.status, "completed")
      assert.equal(run.control.status, "consumed")
      assert.equal(run.control.payload.result_summary_message_id, run.helper.info.id)
      assert.equal(run.helper.info.finish, "stop")
      assert.equal(run.helper.info.summary, true)
      const source = run.original.at(-2)
      assert.equal(run.sourcePage.content, source.parts[0].text)
      assert.equal(run.sourcePage.messageID, source.info.id)
      assert.equal(run.sourcePage.partID, source.parts[0].id)
      const selected = tools.find(tool => tool.tool === "RetainCompactionUserText")
      assert.deepEqual(selected.state.input.excerpts, [{ part_id: source.parts[0].id, text: source.parts[0].text }])
      assert.deepEqual(run.replay.find(message => message.info.id === source.info.id), source)
      assert(run.requests.length <= steps)
    }
    return { count, steps, status: run.status, requests: run.requests.length, executedCatalogReads: catalog.length,
      deliveredCatalogReads: deliveredCatalog.length, catalogChars: run.catalogChars, ...inspected }
  })
}

function model() {
  const baseline = read("catalog-evidence-sol-facts.json.gz")
  const originalText = facts => {
    const ids = new Set(facts.messages.slice(0, 1029).map(message => message.id))
    return facts.parts.filter(part => ids.has(part.message_id) && data(part).type === "text").map(part => data(part).text)
  }
  const expected = read("catalog-evidence-sol.json.gz").cases[0].expected
  return ["luna", "sol", "sol-retry"].map(suffix => {
    const name = `hierarchy-catalog-${suffix}`, run = read(`${name}.json.gz`), audit = read(`${name}.json.requests.json.gz`), facts = read(`${name}-facts.json.gz`)
    const entry = run.cases[0], interrupted = suffix === "sol"
    assert.equal(run.cases.length, 1)
    assert.equal(run.model, suffix === "luna" ? "openai/gpt-6-luna" : "openai/gpt-6.1-sol")
    assert.equal(run.credential, "available")
    assert.equal(run.modelProjection, "verified")
    assert.equal(run.nonceSeed, "7be39fa820d4")
    assert.equal(run.contextTokens, 19000)
    assert.equal(run.effectiveHelperSteps, 80)
    assert.deepEqual(run.requests, audit)
    assert.equal(facts.usage.length, audit.length)
    for (const request of audit) {
      assert.equal(request.model, run.model.slice(7))
      assert.equal(request.streaming, true)
      assert.equal(request.response_reader.state, "settled")
    }
    for (const usage of facts.usage) {
      assert.equal(usage.provider_id, "openai")
      assert.equal(usage.model_id, run.model.slice(7))
    }
    assert.equal(entry.originalMessageCount, 1029)
    assert.deepEqual(originalText(facts), originalText(baseline))
    assert.deepEqual(Object.fromEntries(Object.entries(entry.expected).filter(([key]) => key !== "part_id")),
      Object.fromEntries(Object.entries(expected).filter(([key]) => key !== "part_id")))
    const helper = facts.messages[1029], outcomes = new Map(facts.outcomes.map(outcome => [outcome.request_part_id, data(outcome)]))
    assert.equal(data(helper).author, "compaction")
    const toolPart = row => {
      const request = data(row), outcome = outcomes.get(row.id)
      return { ...request, id: row.id, type: "tool", state: { ...outcome, input: request.input, status: outcome.outcome === "completed" ? "completed" : "error" } }
    }
    const tools = facts.requests.filter(request => request.message_id === helper.id).map(toolPart)
    const originals = facts.messages.slice(1, 1029).map(row => ({ info: { ...data(row), id: row.id }, parts: [
      ...facts.parts.filter(part => part.message_id === row.id).map(part => ({ ...data(part), id: part.id })),
      ...facts.requests.filter(part => part.message_id === row.id).map(toolPart),
    ] }))
    const source = facts.requests.find(request => request.id === entry.expected.part_id), outcome = outcomes.get(source.id)
    assert.equal(data(source).callID, entry.expected.call_id)
    assert(data(source).input.request.includes(entry.expected.input_reference))
    assert.equal(outcome.outcome, "failed")
    assert.equal(outcome.failure.name, entry.expected.failure_name)
    assert.equal(outcome.failure.data.evidence, entry.expected.evidence)
    assert.equal(outcome.failure.data.next_offset, entry.expected.next_offset)
    assert.equal(outcome.metadata.traceID, entry.expected.trace_id)
    const baselineSource = baseline.requests.find(request => request.id === expected.part_id)
    const baselineOutcome = data(baseline.outcomes.find(row => row.request_part_id === expected.part_id))
    assert.deepEqual(data(source).input, data(baselineSource).input)
    assert.deepEqual(outcome.failure, baselineOutcome.failure)
    assert.deepEqual(outcome.metadata, baselineOutcome.metadata)
    for (const tool of tools.filter(tool => tool.tool === "ReadCompactionEvidence" && tool.state.status === "completed" && tool.state.input.field !== "catalog")) {
      const page = JSON.parse(tool.state.output)
      const field = tool.state.input.field
      let original, ownerID
      if (field === "text") {
        const part = facts.parts.find(part => part.id === page.partID)
        original = data(part).text
        ownerID = part.message_id
      } else {
        assert.equal(page.partID, source.id)
        ownerID = source.message_id
        original = JSON.stringify(field === "input" ? data(source).input : field === "failure" ? outcome.failure
          : { part: data(source).metadata ?? {}, state: outcome.metadata ?? {} })
        assert(["input", "failure", "metadata"].includes(field))
      }
      const owner = facts.messages.find(message => message.id === ownerID)
      assert.equal(page.messageID, ownerID)
      assert.equal(page.originalRole, data(owner).role)
      assert.equal(page.originalAuthor, data(owner).author)
      assert.equal(page.totalChars, original.length)
      assert.equal(page.content, original.slice(page.offset, page.end))
    }
    const catalog = tools.filter(tool => tool.tool === "ReadCompactionEvidence" && tool.state.status === "completed" && tool.state.input.field === "catalog")
    const pages = catalog.map(tool => JSON.parse(tool.state.output))
    for (const [i, page] of pages.entries()) {
      assert.equal(page.messageID, helper.id)
      assert.equal(page.sessionID, entry.sessionID)
      assert.equal(page.source, "compaction-catalog")
      assert.equal(page.offset, catalog[i].state.input.offset)
    }
    const root = { offset: pages[0].offset, end: pages[0].end, records: [0, 1029], counts: { users: 2, assistants: 1027, tools: 1, toolErrors: 1, diagnostics: 0 } }
    const inspected = directory(pages, root, originals)
    receipts(tools)
    const control = facts.controls.find(control => control.kind === "compaction_request")
    const terminal = facts.controlEvents.filter(event => event.control_id === control.id && ["consumed", "failed"].includes(event.kind))
    let metrics, sourceInActualUserRole
    if (interrupted) {
      assert.equal(run.status, "failed")
      assert.equal(data(helper).finish, "error")
      assert.equal(data(helper).error.name, "UnknownError")
      assert.equal(data(helper).error.data.message, "AI_StreamProviderError: Our servers are currently overloaded. Please try again later.")
      assert.deepEqual(terminal.map(event => event.kind), ["failed"])
    } else {
      assert.equal(run.status, "passed")
      assert.equal(entry.originalHistoryPreserved, true)
      assert.equal(entry.summaryID, helper.id)
      assert.equal(data(helper).finish, "stop")
      assert.equal(data(helper).summary, true)
      assert.equal(entry.checkpoint.status, "valid_checkpoint")
      assert.equal(entry.reopen, "same projected message identities")
      assert.deepEqual(terminal.map(event => event.kind), ["consumed"])
      const actual = JSON.parse(entry.answer.trim().replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, ""))
      metrics = Object.fromEntries(Object.entries(entry.expected).map(([key, value]) => [key, { expected: value, actual: actual[key], pass: actual[key] === value }]))
      assert.deepEqual(metrics, entry.metrics)
      assert.equal(Object.values(metrics).filter(metric => metric.pass).length, 11)
      for (const retained of entry.retainedUserSources) {
        const owner = facts.messages.find(message => message.id === retained.messageID)
        assert.equal(data(owner).role, "user")
        assert.equal(data(owner).author, retained.author)
        for (const selected of retained.parts) {
          const part = facts.parts.find(part => part.id === selected.partID)
          assert.equal(part.message_id, owner.id)
          assert(data(part).text.includes(selected.text))
          assert(entry.continuationProjection.some(message => message.role === "user" && message.content.some(item => item.text === selected.text)))
        }
      }
      const probe = audit.at(-1).input_evidence.probes.find(probe => probe.id === "catalog-evidence")
      sourceInActualUserRole = probe.matches.some(match => match.message_role === "user" && /^\/(?:input|messages)\/\d+\/role$/.test(match.role_json_pointer))
      assert.equal(sourceInActualUserRole, true)
    }
    return { name, model: run.model, status: interrupted ? "provider_interrupted" : "passed", requests: audit.length,
      canonicalUsageRows: facts.usage.length, originalMessages: 1029, catalogReads: pages.length, catalogChars: pages[0].totalChars,
      ...inspected, sourceInActualUserRole, metrics,
      toolFailures: tools.filter(tool => tool.state.status === "error").map(tool => ({ tool: tool.tool, input: tool.state.input, failure: tool.state.failure })) }
  })
}

const result = process.argv.includes("--local") ? { review: "passed", paidRequests: 0, results: local() }
  : { review: "passed", status: "passed", authoredTextMatched: true, results: model(),
    limits: ["One matched catalog case per model; no full-history answer lane.", "The preserved Sol overload attempt is infrastructure interruption, not semantic qualification.", "Prior Luna alternating-policy failures remain failed; native/cross-vendor/whole-OS recovery remain open."] }
console.log(JSON.stringify(result, null, 2))
