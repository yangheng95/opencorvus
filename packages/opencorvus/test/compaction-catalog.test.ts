import { expect, test } from "bun:test"
import { CompactionCatalog } from "@/session/compaction-catalog"
import { CompactionEvidenceReader } from "@/session/compaction-evidence-reader"

function readerFor(sources: CompactionCatalog.Source[], pageSize = CompactionEvidenceReader.MAX_CHARS_PER_READ) {
  const catalog = {
    sessionID: "ses_directory",
    messageID: "msg_directory",
    ...CompactionCatalog.build(sources, pageSize),
  }
  const reader = CompactionEvidenceReader.create([], undefined, catalog)
  let reads = 0
  return {
    catalog,
    reads: () => reads,
    async node(reference: CompactionCatalog.Reference) {
      let offset = reference.offset,
        content = ""
      while (offset < reference.end) {
        const result = (await reader.execute!(
          {
            message_id: catalog.messageID,
            field: "catalog",
            offset,
            limit: Math.min(reference.limit, reference.end - offset),
          },
          { toolCallId: `tree_${++reads}`, messages: [], context: {}, abortSignal: new AbortController().signal },
        )) as { output: string }
        const page = JSON.parse(result.output)
        expect(page.offset).toBe(offset)
        expect(page.end).toBeLessThanOrEqual(reference.end)
        expect(page.content.isWellFormed()).toBe(true)
        content += page.content
        offset = page.end
      }
      expect(content).toBe(catalog.content.slice(reference.offset, reference.end))
      return JSON.parse(content) as CompactionCatalog.Node
    },
  }
}

test("directory counts and exact ranges reconstruct every original Unicode source in order", async () => {
  const sources: CompactionCatalog.Source[] = [
    { messageIndex: 0, role: "user", text: "Original user 更正😀" },
    { messageIndex: 1, role: "assistant", text: "Original failed Tool", toolState: "error" },
    { messageIndex: 1, role: "assistant", text: "Original Message diagnostics", diagnostics: true },
    { messageIndex: 2, role: "assistant", text: "Completed Tool", toolState: "completed" },
  ]
  const before = structuredClone(sources)
  const view = readerFor(sources, 7)
  expect(view.catalog.root.counts).toEqual({ users: 1, assistants: 3, tools: 2, toolErrors: 1, diagnostics: 1 })
  const actual: CompactionCatalog.Source[] = []
  async function visit(reference: CompactionCatalog.Reference) {
    const node = await view.node(reference)
    if (node.kind === "source") {
      const { kind, ...source } = node
      actual.push(source)
      return
    }
    expect(node.children.length).toBe(2)
    expect(node.children[0]!.records[0]).toBe(reference.records[0])
    expect(node.children[0]!.records[1]).toBe(node.children[1]!.records[0])
    expect(node.children[1]!.records[1]).toBe(reference.records[1])
    for (const child of node.children) await visit(child)
  }
  await visit(view.catalog.root)
  expect(actual).toEqual(sources)
  expect(sources).toEqual(before)
})

test.each(["users", "toolErrors", "diagnostics"] as const)(
  "a 1024-record directory locates exact %s evidence in logarithmic reads",
  async (kind) => {
    const sources = Array.from(
      { length: 1024 },
      (_, index): CompactionCatalog.Source => ({
        messageIndex: index,
        role: index === 1000 ? "user" : "assistant",
        text: `Original source ${index}`,
        ...(index === 1023 ? { toolState: "error" } : {}),
        ...(index === 512 ? { diagnostics: true } : {}),
      }),
    )
    const expected = kind === "users" ? 1000 : kind === "toolErrors" ? 1023 : 512
    const view = readerFor(sources)
    let reference = view.catalog.root
    for (;;) {
      const node = await view.node(reference)
      if (node.kind === "source") {
        expect(node).toEqual({ kind: "source", ...sources[expected] })
        expect(reference.records).toEqual([expected, expected + 1])
        break
      }
      reference = node.children.find((child) => child.counts[kind] === 1)!
    }
    expect(view.reads()).toBe(11)
    expect(view.catalog.root.end - view.catalog.root.offset).toBeLessThan(1500)
  },
)

test("an oversized atomic record uses exact bounded pages until its node end", async () => {
  const source: CompactionCatalog.Source = { messageIndex: 0, role: "assistant", text: "source😀证据".repeat(6000) }
  const view = readerFor([source])
  expect(view.catalog.root.limit).toBe(CompactionEvidenceReader.MAX_CHARS_PER_READ)
  expect(await view.node(view.catalog.root)).toEqual({ kind: "source", ...source })
  expect(view.reads()).toBeGreaterThan(1)
})

test("an empty source snapshot has an exact empty directory root", async () => {
  const view = readerFor([])
  expect(view.catalog.root.records).toEqual([0, 0])
  expect(await view.node(view.catalog.root)).toEqual({ kind: "directory", children: [] })
})

test("an invalid page size returns the explicit construction error", () => {
  expect(() => CompactionCatalog.build([], 0)).toThrow(
    new RangeError("Catalog read size must be a positive safe integer"),
  )
})
