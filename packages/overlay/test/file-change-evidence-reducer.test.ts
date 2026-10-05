import { expect, test } from "bun:test"
import {
  reduceToolFileChangeGroups,
  toolFileChangesFromState,
  mergeChangeGroups,
  conversationArtifactFileRows,
} from "../src/utils/file-change-summary"
import { summarizeChangeGroups, savedSessionChangeGroups, changeGroupsRevisionKey } from "../src/services/diff"
import type { ProjectedMessageFacts } from "../src/services/tree-writer"
import {
  CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY,
  CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES,
} from "@opencorvus-ai/transport-protocol"
const base = "D:/project",
  file = "D:/project/value.txt"
function tool(index: number, before: string, after: string) {
  return {
    type: "tool",
    tool: "edit",
    id: `part_${index}`,
    sessionID: "ses_owner",
    messageID: `msg_${index}`,
    state: {
      status: "completed",
      input: { filePath: file, oldString: before, newString: after },
      time: { start: index * 100 + 10, end: index * 100 + 20 },
      output: "Edit applied successfully.",
      metadata: { filediff: { file, before, after, additions: 1, deletions: 1 } },
    },
  }
}
function fact(index: number, toolName = "edit"): ProjectedMessageFacts {
  return {
    id: `msg_${index}`,
    sessionID: "ses_owner",
    sessionAgentID: "ses_owner",
    agentID: "work",
    role: "assistant",
    orderKey: `${index}`,
    time: index * 100,
    completed: index * 100 + 30,
    finish: "tool-calls",
    hasError: false,
    acceptedInputMessageIDs: ["msg_user"],
    stepParts: [
      { id: `start_${index}`, orderKey: `${index}:1`, type: "step-start" },
      { id: `finish_${index}`, orderKey: `${index}:3`, type: "step-finish", reason: "tool-calls" },
    ],
    toolParts: [
      {
        id: `part_${index}`,
        orderKey: `${index}:2`,
        tool: toolName,
        status: "completed",
        start: index * 100 + 10,
        end: index * 100 + 20,
      },
    ],
  }
}
function inputs(...parts: unknown[]) {
  return parts.map((part) => ({ part, agentID: "work" }))
}
function marker() {
  return {
    [CONVERSATION_DEFERRED_TOOL_STATE_METADATA_KEY]: {
      kind: "deferred",
      outputBytes: 100,
      stateBytes: CONVERSATION_INLINE_TOOL_STATE_MAX_BYTES + 1,
      stateSha256: "a".repeat(64),
    },
  }
}
test("individual completed comparison preserves empty existing after and original receipt", () => {
  const part = tool(0, "value=1\n", "")
  const changes = toolFileChangesFromState(part.state, base, {
    sessionID: part.sessionID,
    messageID: part.messageID,
    partID: part.id,
  })
  expect(changes[0]).toEqual({
    file: "value.txt",
    openPath: file,
    displayPath: "value.txt",
    status: undefined,
    isText: true,
    before: "value=1\n",
    after: "",
    additions: 0,
    deletions: 1,
    evidence: {
      kind: "complete",
      receipts: [{ sessionID: "ses_owner", messageID: "msg_0", partID: "part_0", fileIndex: 0 }],
    },
  })
})
test("normal cross-assistant original controls and intervening Read compose exact net interval", () => {
  const groups = reduceToolFileChangeGroups(
    inputs(tool(0, "value=0\n", "value=1\n"), tool(2, "value=1\n", "value=2\n")),
    [fact(0), fact(1, "read"), fact(2)],
    base,
  )
  expect(groups[0]).toMatchObject({
    observationKind: "tool_interval",
    additions: 1,
    deletions: 1,
    changes: [{ before: "value=0\n", after: "value=2\n", evidence: { kind: "complete" } }],
  })
  expect(groups[0].changes[0].evidence.receipts).toHaveLength(2)
})
test("Write receipt and multiple step observations preserve the recorded two-Edit interval", () => {
  const write = {
    ...tool(0, "", "one\n"),
    tool: "write",
    state: {
      status: "completed",
      input: { filePath: file, content: "one\n" },
      metadata: { filepath: file, exists: false },
      output: "Wrote file successfully.",
      time: { start: 10, end: 20 },
    },
  }
  const groups = reduceToolFileChangeGroups(
    inputs(write, tool(1, "one\n", "two\n"), tool(3, "two\n", "three\n")),
    [fact(0, "write"), fact(1), fact(2, "read"), fact(3)],
    base,
  )
  expect(groups).toHaveLength(1)
  expect(groups[0].changes[0]).toMatchObject({
    before: "one\n",
    after: "three\n",
    additions: 1,
    deletions: 1,
    evidence: {
      kind: "complete",
      receipts: [
        { sessionID: "ses_owner", messageID: "msg_1", partID: "part_1", fileIndex: 0 },
        { sessionID: "ses_owner", messageID: "msg_3", partID: "part_3", fileIndex: 0 },
      ],
    },
  })
})
test("exact replay deduplicates while conflicting receipt is explicit incomplete", () => {
  const original = tool(0, "one\n", "two\n")
  expect(
    reduceToolFileChangeGroups(inputs(original, structuredClone(original)), [], base)[0].changes[0].evidence.receipts,
  ).toHaveLength(1)
  const result = reduceToolFileChangeGroups(inputs(original, tool(0, "one\n", "three\n")), [], base)[0].changes[0]
  expect(result).toMatchObject({
    additions: null,
    deletions: null,
    evidence: { kind: "incomplete", reason: "conflicting_receipt" },
  })
  const conflictingPath = structuredClone(original)
  conflictingPath.state.metadata.filediff.file = "D:/project/other.txt"
  expect(
    reduceToolFileChangeGroups(inputs(original, conflictingPath), [], base)[0].changes.map((change) => change.evidence),
  ).toEqual([
    {
      kind: "incomplete",
      reason: "conflicting_receipt",
      receipts: [{ sessionID: "ses_owner", messageID: "msg_0", partID: "part_0", fileIndex: 0 }],
    },
    {
      kind: "incomplete",
      reason: "conflicting_receipt",
      receipts: [{ sessionID: "ses_owner", messageID: "msg_0", partID: "part_0", fileIndex: 0 }],
    },
  ])
})
test("unqualified batch, controls, step membership, branch and endpoint have precise incomplete reasons", () => {
  const parts = inputs(tool(0, "one\n", "two\n"), tool(2, "two\n", "three\n"))
  const cases: [ProjectedMessageFacts[], string][] = [
    [[{ ...fact(0), stepParts: undefined }, fact(1, "read"), fact(2)], "missing_message_facts"],
    [[fact(0), fact(1, "read"), { ...fact(2), acceptedInputMessageIDs: ["another_input"] }], "changed_input_batch"],
    [[fact(0), { ...fact(1, "read"), hasError: true }, fact(2)], "non_normal_step"],
    [[fact(0), fact(1, "delegate_agent"), fact(2)], "non_normal_step"],
    [
      [
        fact(0),
        {
          ...fact(1, "read"),
          toolParts: [...fact(1, "read").toolParts!, { ...fact(1, "read").toolParts![0], id: "extra" }],
        },
        fact(2),
      ],
      "ambiguous_tool_step",
    ],
    [[{ ...fact(0), stepParts: [] }, fact(1, "read"), fact(2)], "non_normal_step"],
  ]
  for (const [facts, reason] of cases)
    expect(reduceToolFileChangeGroups(parts, facts, base)[0].changes[0]).toMatchObject({
      additions: null,
      deletions: null,
      evidence: { kind: "incomplete", reason },
    })
  expect(
    reduceToolFileChangeGroups(
      inputs(tool(0, "one\n", "two\n"), tool(2, "wrong\n", "three\n")),
      [fact(0), fact(1, "read"), fact(2)],
      base,
    )[0].changes[0].evidence,
  ).toMatchObject({ kind: "incomplete", reason: "endpoint_discontinuity" })
})
test("canonical Patch keeps path-only coverage independently of exact Edit interval", () => {
  const patch = { id: "patch_0", type: "patch", sessionID: "ses_owner", messageID: "msg_0", files: [file] }
  const groups = reduceToolFileChangeGroups(inputs(tool(0, "one\n", "two\n"), patch), [], base)
  expect(groups.map((group) => group.observationKind)).toEqual(["tool_interval", "path_coverage"])
  expect(summarizeChangeGroups(groups)).toEqual({
    files: 1,
    additions: null,
    deletions: null,
    hasUnresolvedChanges: true,
  })
  expect(conversationArtifactFileRows(groups)).toHaveLength(2)
})
test("actual deferred mutation without observed path retains unknown receipts", () => {
  const edit = { ...tool(0, "one", "two"), state: { ...tool(0, "one", "two").state, metadata: marker() } }
  const groups = reduceToolFileChangeGroups(inputs(edit), [], base)
  expect(groups[0]).toMatchObject({
    observationKind: "path_coverage",
    changes: [],
    additions: null,
    deletions: null,
    unavailableReceipts: [{ sessionID: "ses_owner", messageID: "msg_0", partID: "part_0" }],
  })
  expect(summarizeChangeGroups(groups)).toEqual({
    files: 0,
    additions: null,
    deletions: null,
    hasUnresolvedChanges: true,
  })
})
test("distinct saved/live intervals retain honest flags and revision includes endpoint changes", () => {
  const live = reduceToolFileChangeGroups(inputs(tool(0, "one\n", "two\n")), [], base)
  const saved = savedSessionChangeGroups(
    [{ file: "value.txt", before: "", after: "binary-erased", additions: 0, deletions: 0 }],
    "ses_owner",
  )
  const groups = mergeChangeGroups([...live, ...saved, ...live])
  expect(groups.map((group) => group.observationKind)).toEqual(["tool_interval", "saved_session_interval"])
  expect(saved[0].changes[0].evidence).toMatchObject({ kind: "incomplete", reason: "saved_session_flags_missing" })
  expect(summarizeChangeGroups(groups)).toMatchObject({ files: 1, additions: null, deletions: null })
  const other = reduceToolFileChangeGroups(inputs(tool(0, "one\n", "six\n")), [], base)
  const identity = (after: string) => [
    {
      id: "tool_interval:ses_owner:work",
      observationKind: "tool_interval",
      sessionID: "ses_owner",
      agentID: "work",
      changes: [
        {
          file: "value.txt",
          before: "one\n",
          after,
          additions: 1,
          deletions: 1,
          evidence: {
            kind: "complete",
            receipts: [{ sessionID: "ses_owner", messageID: "msg_0", partID: "part_0", fileIndex: 0 }],
          },
        },
      ],
    },
  ]
  expect(JSON.parse(changeGroupsRevisionKey(live))).toMatchObject(identity("two\n"))
  expect(JSON.parse(changeGroupsRevisionKey(other))).toMatchObject(identity("six\n"))
})
test("separate actual Session and actor scopes retain their own recorded endpoints", () => {
  const one = tool(0, "one\n", "two\n"),
    two = { ...tool(0, "old\n", "new\n"), sessionID: "ses_second" }
  const groups = reduceToolFileChangeGroups([...inputs(one), { part: two, agentID: "second" }], [], base)
  expect(
    groups.map((group) => ({
      session: group.sessionID,
      actor: group.agentID,
      before: group.changes[0].before,
      after: group.changes[0].after,
    })),
  ).toEqual([
    { session: "ses_owner", actor: "work", before: "one\n", after: "two\n" },
    { session: "ses_second", actor: "second", before: "old\n", after: "new\n" },
  ])
})
