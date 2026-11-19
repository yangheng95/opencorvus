import { expect, test } from "bun:test"
import { findNext, findPrevious, replaceNext, search, SearchQuery, setSearchQuery } from "@codemirror/search"
import { EditorState, type TransactionSpec } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

const document = "Overview: Sapphire.\nActual endpoint: Ruby\nBoundary marker: Quartz.\nLookaround pair\ncrosses its real line.\n"
type Direction = "next" | "previous"

function editorForQuery(
  query: SearchQuery,
  anchor: number,
  onNoMatch?: (editor: EditorView, direction: Direction) => void,
) {
  const source = EditorState.create({ doc: document, selection: { anchor }, extensions: search({ onNoMatch }) })
  const view = {
    state: source.update({ effects: setSearchQuery.of(query) }).state,
    plugin: () => null,
    dispatch(spec: TransactionSpec) {
      this.state = this.state.update(spec).state
    },
  }
  return view as unknown as EditorView
}

test.each([
  { pattern: "Sapphire$", cursor: 18, direction: "next", command: findNext },
  { pattern: "Sapphire(?![\\s\\S])", cursor: 18, direction: "previous", command: findPrevious },
  { pattern: "^Sapphire(?=[\\s\\S])", cursor: 10, direction: "next", command: findNext },
])("reports the current $direction result for $pattern at a midline boundary", ({ pattern, cursor, direction, command }) => {
  const reports: Array<{ direction: Direction; cursor: number }> = []
  const view = editorForQuery(new SearchQuery({ search: pattern, regexp: true }), cursor, ({ state }, direction) => {
    reports.push({ direction, cursor: state.selection.main.head })
  })

  command(view)

  expect(reports).toEqual([{ direction, cursor }])
})

test.each([
  { pattern: "Quartz(?=\\.)", cursor: 65, command: findNext, range: [59, 65] },
  { pattern: "Quartz(?=\\.)", cursor: 65, command: findPrevious, range: [59, 65] },
  { pattern: "(?<=\\nActual endpoint: )Ruby", cursor: 37, command: findNext, range: [37, 41] },
  { pattern: "Ruby$", cursor: 18, command: findPrevious, range: [37, 41] },
  { pattern: "pair\\ncrosses", cursor: 106, command: findPrevious, range: [78, 90] },
])("selects $pattern from the real document around offset $cursor", ({ pattern, cursor, command, range }) => {
  const view = editorForQuery(new SearchQuery({ search: pattern, regexp: true }), cursor)

  command(view)

  const { from, to } = view.state.selection.main
  expect([from, to]).toEqual(range)
})

test("replaces a real cross-line match using its original capture groups", () => {
  const view = editorForQuery(new SearchQuery({ search: "(pair)\\n(crosses)", regexp: true, replace: "$2 $1" }), 0)

  findNext(view)
  replaceNext(view)

  expect(view.state.doc.toString()).toBe(
    "Overview: Sapphire.\nActual endpoint: Ruby\nBoundary marker: Quartz.\nLookaround crosses pair its real line.\n",
  )
})

test("reverse search uses the nearest real match in the current revision", () => {
  const query = new SearchQuery({ search: "pair\\ncrosses", regexp: true })
  const view = editorForQuery(query, document.length)
  findPrevious(view)

  const gap = "An ordinary reading line.\n".repeat(900)
  const edited = `pair\ncrosses\n${gap}pair\ncrosses\n${gap}`
  const nearest = edited.lastIndexOf("pair")
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: edited }, selection: { anchor: edited.length } })
  findPrevious(view)

  const { from, to } = view.state.selection.main
  expect([from, to, view.state.sliceDoc(from, to)]).toEqual([nearest, nearest + 12, "pair\ncrosses"])
})

test("keeps real lookahead context outside a UTF-16 cursor range", () => {
  const state = EditorState.create({ doc: "🐦 Quartz.\nNext" })
  const lookahead = new SearchQuery({ search: "Quartz(?=\\.\\nNext)", regexp: true }).getCursor(state, 3, 9).next()
  const zeroWidth = new SearchQuery({ search: "(?=\\nNext)", regexp: true }).getCursor(state, 3, 10).next()

  expect([lookahead.value.from, lookahead.value.to]).toEqual([3, 9])
  expect([zeroWidth.value.from, zeroWidth.value.to]).toEqual([10, 10])
})
