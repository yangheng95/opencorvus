import { expect, test } from "bun:test"
import {
  clearConversationUiState,
  conversationArtifactDisplayState,
  conversationDisclosureExpanded,
  conversationUiStore,
  loadConversationUiStateForSource,
  setConversationArtifactDisplayState,
  setConversationDisclosureExpanded,
} from "../src/store/conversation-ui"

const resource = JSON.stringify(["artifact-reader", "resource", "task-sales", "snapshot-east/csv"])
const publication = JSON.stringify(["artifact-reader", "interactive", "session-files", "artifact-files"])

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
  const otherSnapshot = JSON.stringify(["artifact-reader", "resource", "task-sales", "snapshot-south/csv"])
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
    setConversationArtifactDisplayState(`artifact-${index}`, {
      query: `row-${index}`, tablePageIndex: index, dashboardFilters: { region: `region-${index}`, refund: false },
    })
  }
  const entries = conversationUiStore.conversations[conversationUiStore.activeKey]!.artifactDisplays
  expect(Object.keys(entries)).toEqual(Array.from({ length: 200 }, (_, index) => `artifact-${index + 5}`))
  expect(entries["artifact-204"]).toEqual({
    query: "row-204", tablePageIndex: 204, dashboardFilters: { region: "region-204", refund: false },
  })
})

test("tree query and explicit branch choices restore together in their original source", () => {
  const source = { kind: "task" as const, id: "tree-reading-source" }
  const authority = { revision: 106 }
  const branch = JSON.stringify(["artifact-tree-branch", resource, "region"])
  const otherBranch = JSON.stringify(["artifact-tree-branch", publication, "region"])
  loadConversationUiStateForSource(source, authority)
  setConversationArtifactDisplayState(resource, { query: "28.25" })
  setConversationDisclosureExpanded(branch, false)
  setConversationDisclosureExpanded(otherBranch, true)
  loadConversationUiStateForSource({ kind: "session", id: source.id }, authority)
  setConversationArtifactDisplayState(resource, { query: "7.35" })
  setConversationDisclosureExpanded(branch, true)
  expect([conversationArtifactDisplayState(resource), conversationDisclosureExpanded(branch, false)]).toEqual([{ query: "7.35" }, true])
  loadConversationUiStateForSource(source, authority)
  expect([conversationArtifactDisplayState(resource), conversationDisclosureExpanded(branch, true), conversationDisclosureExpanded(otherBranch, false)]).toEqual([{ query: "28.25" }, false, true])
})

test("bounded branch choices retain the artifact query in its existing presentation field", () => {
  loadConversationUiStateForSource({ kind: "session", id: "tree-branch-bound" }, { revision: 107 })
  setConversationArtifactDisplayState(publication, { query: "components" })
  for (let index = 0; index < 205; index++) setConversationDisclosureExpanded(`branch-${index}`, true)
  const choices = conversationUiStore.conversations[conversationUiStore.activeKey]!.expandedDisclosures
  expect(Object.keys(choices)).toEqual(Array.from({ length: 200 }, (_, index) => `branch-${index + 5}`))
  expect([conversationArtifactDisplayState(publication), conversationDisclosureExpanded("branch-204", false)]).toEqual([{ query: "components" }, true])
})

test("dashboard selections preserve scalar types, merge with reading state and clear to all", () => {
  loadConversationUiStateForSource({ kind: "session", id: "dashboard-scalars" }, { revision: 108 })
  const dashboardFilters = { text: "0", number: 0, boolean: false, empty: "", nullable: null }
  setConversationArtifactDisplayState(publication, { dashboardFilters })
  setConversationArtifactDisplayState(publication, { query: "retained-query" })
  expect(conversationArtifactDisplayState(publication)).toEqual({ dashboardFilters, query: "retained-query" })
  setConversationArtifactDisplayState(publication, { dashboardFilters: { region: undefined, refund: "是" } })
  expect(conversationArtifactDisplayState(publication)).toEqual({
    dashboardFilters: { region: undefined, refund: "是" }, query: "retained-query",
  })
  setConversationArtifactDisplayState(publication, { dashboardFilters: {} })
  expect(conversationArtifactDisplayState(publication)).toEqual({ dashboardFilters: {}, query: "retained-query" })
})

test("dashboard selections return to their original source, authority and publication", () => {
  const source = { kind: "session" as const, id: "dashboard-source" }
  const authority = { revision: 109 }
  loadConversationUiStateForSource(source, authority)
  setConversationArtifactDisplayState(publication, { dashboardFilters: { region: "华东", refund: "是" } })
  setConversationArtifactDisplayState("other-publication", { dashboardFilters: { region: "华南", refund: "否" } })
  loadConversationUiStateForSource({ kind: "task", id: source.id }, authority)
  setConversationArtifactDisplayState(publication, { dashboardFilters: { selected: false } })
  expect(conversationArtifactDisplayState(publication)).toEqual({ dashboardFilters: { selected: false } })
  loadConversationUiStateForSource(source, { revision: 110 })
  setConversationArtifactDisplayState(publication, { dashboardFilters: { amount: 0 } })
  expect(conversationArtifactDisplayState(publication)).toEqual({ dashboardFilters: { amount: 0 } })
  clearConversationUiState()
  loadConversationUiStateForSource(source, authority)
  expect([conversationArtifactDisplayState(publication), conversationArtifactDisplayState("other-publication")]).toEqual([
    { dashboardFilters: { region: "华东", refund: "是" } },
    { dashboardFilters: { region: "华南", refund: "否" } },
  ])
})
