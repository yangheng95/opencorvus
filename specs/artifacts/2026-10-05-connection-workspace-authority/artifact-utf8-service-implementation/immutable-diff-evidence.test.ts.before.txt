import { afterEach, expect, test } from "bun:test"
import { ApiAuthorityChangedError, configure, captureApiAuthority } from "../src/services/api"
import { __setHostTransportForTest } from "../src/services/host-transport-runtime"
import { createTauriTransport } from "../src/services/tauri-transport"
import { setBoardStore } from "../src/store/board"
import { resolveDiff, immutableBuildChangeGroups, DiffSelectionError, type ChangeGroup } from "../src/services/diff"
const taskID = "tsk_evidence"
function groups(before: number | null, after: number | null, binary = false): ChangeGroup[] {
  return immutableBuildChangeGroups({
    task: { id: taskID },
    artifacts: [
      {
        id: "art_evidence",
        kind: "build_host_observation",
        payload: {
          task_id: taskID,
          diffs: [
            {
              file: "file.txt",
              status: before === null ? "added" : after === null ? "deleted" : "modified",
              is_binary: binary,
              before: before === null ? null : { oid: "a".repeat(40), bytes: before },
              after: after === null ? null : { oid: "b".repeat(40), bytes: after },
              additions: after === null || after === 0 ? 0 : 1,
              deletions: before === null || before === 0 ? 0 : 1,
            },
          ],
        },
      },
    ],
  })
}
function begin() {
  configure({ serverUrl: "http://127.0.0.1:17800", directory: "D:/owned-a" })
  setBoardStore({ selectedSource: { kind: "task", id: taskID, directory: "D:/owned-a" }, board: null, tasks: [] })
}
afterEach(() => {
  __setHostTransportForTest(undefined)
  configure({ directory: "" })
  setBoardStore({ selectedSource: null, board: null })
})
test("both immutable sides and all chunks keep original logical directory", async () => {
  begin()
  const before = "a".repeat(256 * 1024 + 3),
    after = "b".repeat(256 * 1024 + 4)
  const paths: string[] = []
  __setHostTransportForTest({
    ...createTauriTransport("browser"),
    async request(request) {
      paths.push(String(request.query?.directory))
      const value = request.query?.side === "before" ? before : after
      const offset = Number(request.query?.offset),
        length = Number(request.query?.length)
      configure({ directory: "D:/selected-b" })
      setBoardStore({ selectedSource: { kind: "task", id: "tsk_new", directory: "D:/selected-b" } })
      return {
        ok: true,
        status: 200,
        headers: {},
        body: new TextEncoder().encode(value.slice(offset, offset + length)),
      } as any
    },
  })
  const result = await resolveDiff(
    { filePath: "file.txt", groupID: "artifact:art_evidence" },
    groups(before.length, after.length),
  )
  expect(result).toEqual({ ...groups(before.length, after.length)[0].changes[0], before, after })
  expect(paths).toEqual(["D:/owned-a", "D:/owned-a", "D:/owned-a", "D:/owned-a"])
})
test("a retired logical read yields exact current authority error", async () => {
  begin()
  const authority = captureApiAuthority()
  __setHostTransportForTest({
    ...createTauriTransport("browser"),
    async request() {
      configure({ serverUrl: "http://127.0.0.1:17801" })
      return { ok: true, status: 200, headers: {}, body: new TextEncoder().encode("x") } as any
    },
  })
  const result = await resolveDiff({ filePath: "file.txt", groupID: "artifact:art_evidence" }, groups(null, 1)).catch(
    (error) => error,
  )
  expect(result).toBeInstanceOf(ApiAuthorityChangedError)
  expect(result.expectedRevision).toBe(authority.revision)
  expect(result.currentRevision).toBe(captureApiAuthority().revision)
})
test("binary refs, absent sides and empty existing objects retain explicit evidence", async () => {
  begin()
  expect(groups(null, 0)[0].changes[0]).toMatchObject({
    evidence: { kind: "complete" },
    beforeObject: null,
    afterObject: { bytes: 0 },
    isText: true,
  })
  const empty = await resolveDiff({ filePath: "file.txt", groupID: "artifact:art_evidence" }, groups(null, 0))
  expect(empty).toMatchObject({ before: "", after: "", evidence: { kind: "complete" } })
  expect(groups(3, 4, true)[0].changes[0]).toMatchObject({
    evidence: { kind: "complete" },
    isText: false,
    additions: null,
    deletions: null,
  })
  const unknown = immutableBuildChangeGroups({
    task: { id: taskID },
    artifacts: [
      {
        id: "art_missing",
        kind: "build_host_observation",
        payload: {
          diffs: [{ file: "file.txt", status: "modified", is_binary: false, after: { oid: "a".repeat(40), bytes: 0 } }],
        },
      },
    ],
  })
  expect(unknown[0].changes[0]).toEqual({
    file: "file.txt",
    status: "modified",
    additions: null,
    deletions: null,
    evidence: {
      kind: "incomplete",
      reason: "unknown_resource",
      receipts: [{ artifactID: "art_missing", fileIndex: 0 }],
    },
  })
})
test("ambiguous shorthand selection returns typed observed-group error", async () => {
  const result = await resolveDiff({ filePath: "file.txt" }, [
    ...groups(null, 0),
    { ...groups(null, 0)[0], id: "artifact:other" },
  ]).catch((error) => error)
  expect(result).toBeInstanceOf(DiffSelectionError)
  expect(result.reason).toBe("ambiguous_group")
})
