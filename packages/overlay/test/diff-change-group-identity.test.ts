import { expect, test } from "bun:test"
import { changeGroupIdentity, type ChangeGroup } from "../src/services/diff"
import { mergeChangeGroups } from "../src/utils/file-change-summary"

const initial: ChangeGroup = {
  id: "observed-group",
  observationKind: "tool_interval",
  taskID: "task-a",
  sessionID: "session-a",
  agentID: "producer",
  additions: 1,
  deletions: 0,
  changes: [
    { file: "hello.txt", status: "added", additions: 1, deletions: 0, evidence: { kind: "complete", receipts: [] } },
  ],
}

test("a live observation retains its identity as current file evidence changes", () => {
  const selected = new Map([[changeGroupIdentity(initial), "selected producer observation"]])
  const current: ChangeGroup = {
    ...initial,
    additions: 2,
    changes: [
      ...initial.changes,
      { file: "notes.txt", status: "added", additions: 1, deletions: 0, evidence: { kind: "complete", receipts: [] } },
    ],
  }
  expect(selected.get(changeGroupIdentity(current))).toBe("selected producer observation")
  expect(
    mergeChangeGroups([current, { ...current }]).map((group) => group.changes.map((change) => change.file)),
  ).toEqual([["hello.txt", "notes.txt"]])
})

test("matching display ids retain separately scoped observation records", () => {
  const groups: ChangeGroup[] = [
    initial,
    { ...initial, taskID: "task-b", sessionID: "session-b" },
    {
      ...initial,
      observationKind: "immutable_build_interval",
      artifactID: "build-a",
      diffBaseRef: "base-a",
      diffHeadRef: "head-a",
      commitRef: "contribution-a",
      publishedCommitRef: "published-a",
    },
    {
      ...initial,
      observationKind: "immutable_build_interval",
      artifactID: "build-b",
      diffBaseRef: "base-b",
      diffHeadRef: "head-b",
      commitRef: "contribution-b",
      publishedCommitRef: "published-b",
    },
  ]
  const records = new Map(groups.map((group, index) => [changeGroupIdentity(group), index]))
  expect(mergeChangeGroups(groups).map((group) => records.get(changeGroupIdentity(group)))).toEqual([0, 1, 2, 3])
})

test("identity encoding retains literal field boundaries", () => {
  const first = { ...initial, id: "group:one", sessionID: "session" }
  const second = { ...initial, id: "group", sessionID: "one:session" }
  const records = new Map([
    [changeGroupIdentity(first), first],
    [changeGroupIdentity(second), second],
  ])
  expect([...records.values()].map((group) => [group.id, group.sessionID])).toEqual([
    ["group:one", "session"],
    ["group", "one:session"],
  ])
})
