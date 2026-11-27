import { expect, test } from "bun:test"
import {
  clearConversationUiState,
  conversationArtifactDisplayState,
  conversationUiStore,
  loadConversationUiStateForSource,
  setConversationArtifactDisplayState,
} from "../src/store/conversation-ui"

const resource = JSON.stringify(["artifact-table", "resource", "task-sales", "snapshot-east/csv"])
const publication = JSON.stringify(["artifact-table", "interactive", "session-files", "artifact-files"])

test("artifact reading merges query, sort direction and page into one retained record", () => {
  loadConversationUiStateForSource({ kind: "task", id: "reading-merge" }, { revision: 101 })
  setConversationArtifactDisplayState(resource, {
    query: "华 28.25",
    tableSorting: [{ id: "amount", desc: false }],
    tablePageIndex: 1,
  })
  setConversationArtifactDisplayState(resource, { tableSorting: [{ id: "amount", desc: true }] })
  expect(conversationArtifactDisplayState(resource)).toEqual({
    query: "华 28.25", tableSorting: [{ id: "amount", desc: true }], tablePageIndex: 1,
  })
  setConversationArtifactDisplayState(resource, { query: "", tablePageIndex: 0 })
  expect(conversationArtifactDisplayState(resource)).toEqual({
    query: "", tableSorting: [{ id: "amount", desc: true }], tablePageIndex: 0,
  })
})

test("distinct real resource and publication identities retain their own reading values", () => {
  loadConversationUiStateForSource({ kind: "session", id: "reading-identities" }, { revision: 102 })
  setConversationArtifactDisplayState(resource, { query: "华东", tablePageIndex: 0 })
  setConversationArtifactDisplayState(publication, { query: "components", tablePageIndex: 1 })
  const otherSnapshot = JSON.stringify(["artifact-table", "resource", "task-sales", "snapshot-south/csv"])
  setConversationArtifactDisplayState(otherSnapshot, { query: "华南", tableSorting: [{ id: "count", desc: false }] })
  expect([resource, publication, otherSnapshot].map(conversationArtifactDisplayState)).toEqual([
    { query: "华东", tablePageIndex: 0 },
    { query: "components", tablePageIndex: 1 },
    { query: "华南", tableSorting: [{ id: "count", desc: false }] },
  ])
})

test("returning to a source restores its values across deselection and other sources", () => {
  const authority = { revision: 103 }
  const task = { kind: "task" as const, id: "reading-source" }
  loadConversationUiStateForSource(task, authority)
  setConversationArtifactDisplayState(resource, { query: "task-original", tablePageIndex: 1 })
  clearConversationUiState()
  loadConversationUiStateForSource({ kind: "session", id: task.id }, authority)
  setConversationArtifactDisplayState(resource, { query: "session-other", tablePageIndex: 0 })
  expect(conversationArtifactDisplayState(resource)).toEqual({ query: "session-other", tablePageIndex: 0 })
  loadConversationUiStateForSource(task, { revision: 104 })
  setConversationArtifactDisplayState(resource, { query: "new-authority", tablePageIndex: 2 })
  expect(conversationArtifactDisplayState(resource)).toEqual({ query: "new-authority", tablePageIndex: 2 })
  loadConversationUiStateForSource(task, authority)
  expect(conversationArtifactDisplayState(resource)).toEqual({ query: "task-original", tablePageIndex: 1 })
})

test("artifact reading retains the most recent two hundred presentation entries", () => {
  loadConversationUiStateForSource({ kind: "session", id: "reading-bound" }, { revision: 105 })
  for (let index = 0; index < 205; index++) {
    setConversationArtifactDisplayState(`artifact-${index}`, { query: `row-${index}`, tablePageIndex: index })
  }
  const entries = conversationUiStore.conversations[conversationUiStore.activeKey]!.artifactDisplays
  expect(Object.keys(entries)).toEqual(Array.from({ length: 200 }, (_, index) => `artifact-${index + 5}`))
  expect(entries["artifact-204"]).toEqual({ query: "row-204", tablePageIndex: 204 })
})
