import { expect, test } from "bun:test"
import { findNext, findPrevious, getSearchQuery, search, SearchQuery, setSearchQuery } from "@codemirror/search"
import { EditorSelection, EditorState } from "@codemirror/state"
import type { EditorView } from "@codemirror/view"

test.each([
  { direction: "next", command: findNext, query: new SearchQuery({ search: "Quartz" }) },
  { direction: "previous", command: findPrevious, query: new SearchQuery({ search: "[Aa]mber", regexp: true }) },
])("reports the active query and cursor after a $direction search with no match", ({ direction, command, query }) => {
  const doc = "Sapphire\nAmber\nSapphire"
  const reports: Array<{ direction: string; query: SearchQuery; doc: string; cursor: number }> = []
  const source = EditorState.create({
    doc,
    selection: EditorSelection.cursor(11),
    extensions: search({
      onNoMatch: ({ state }, matchDirection) => {
        reports.push({
          direction: matchDirection,
          query: getSearchQuery(state),
          doc: state.doc.toString(),
          cursor: state.selection.main.head,
        })
      },
    }),
  })
  const state = source.update({ effects: setSearchQuery.of(query) }).state
  if (query.regexp) {
    const match = query.getCursor(state).next().value
    expect([match.from, match.to]).toEqual([9, 14])
  }
  command({ state } as EditorView)

  expect(reports).toEqual([{ direction, query, doc, cursor: 11 }])
})
