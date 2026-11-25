import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "../src/project/instance"
import { ProjectRuntimePaths } from "../src/project/runtime-paths"
import { SessionSummary } from "../src/session/summary"
import { Snapshot } from "../src/snapshot"
import { Filesystem } from "../src/util/filesystem"
import { tmpdir } from "./fixture/fixture"

test("saved Git trees establish both sides of text and binary comparisons", async () => {
  await using directory = await tmpdir({ git: true })
  await Instance.provide({
    directory: directory.path,
    fn: async () => {
      const textPath = "literal [review] 字.txt"
      const write = (file: string, content: string | Uint8Array) =>
        fs.writeFile(path.join(directory.path, file), content)
      const addedText = "\uFEFFFirst line.\nSecond line.\n"
      const originalText = "Last saved line.\n"
      const modifiedText = "Previously present.\n"
      await Promise.all([write("was-empty.txt", ""), write("removed.txt", originalText)])
      const before = await Snapshot.trackRequired()
      await Promise.all([
        write(textPath, addedText),
        write("empty.txt", ""),
        write("binary.dat", Uint8Array.of(83, 0, 1, 255)),
        write("was-empty.txt", modifiedText),
        fs.unlink(path.join(directory.path, "removed.txt")),
      ])
      const after = await Snapshot.trackRequired()
      const changes = await Snapshot.diffFull(before, after)

      expect(Object.fromEntries(changes.map(({ file, ...comparison }) => [file, comparison]))).toEqual({
        [textPath]: {
          before: "", after: addedText, additions: 2, deletions: 0, status: "added", comparisonKind: "text",
        },
        "was-empty.txt": {
          before: "", after: modifiedText, additions: 1, deletions: 0, status: "modified", comparisonKind: "text",
        },
        "removed.txt": {
          before: originalText, after: "", additions: 0, deletions: 1, status: "deleted", comparisonKind: "text",
        },
        "empty.txt": {
          before: "", after: "", additions: 0, deletions: 0, status: "added", comparisonKind: "text",
        },
        "binary.dat": {
          before: "", after: "", additions: 0, deletions: 0, status: "added", comparisonKind: "binary",
        },
      })
    },
  })
})

test("saved session comparison upgrades existing data and retains a concurrent current write", async () => {
  await using directory = await tmpdir({ git: true })
  await Instance.provide({
    directory: directory.path,
    fn: async () => {
      const previous = {
        file: "review.txt", before: "Previous review.\n", after: "Updated review.\n",
        additions: 1, deletions: 1, status: "modified" as const,
      }
      const originalFile = "brief-字-😀\t.txt"
      const legacy = { ...previous, file: '"brief-字-😀\\t.txt"', retained: { source: "original record" } }
      const quotedWithOctal = { ...legacy, file: '"brief-\\345\\255\\227-\\360\\237\\230\\200\\t.txt"' }
      const migrated = { ...legacy, file: originalFile, comparisonKind: "unknown" }
      const current = { ...previous, after: "Verified review.\n", comparisonKind: "text" as const }
      const recordPath = (id: string) => ProjectRuntimePaths.sessionDiffPath(directory.path, Instance.project.id, id)
      const sessionID = "ses_saved_snapshot_migration"
      const concurrentID = "ses_saved_snapshot_concurrent"
      expect(await SessionSummary.readDiff(sessionID)).toEqual([])
      await Filesystem.writeAtomic(recordPath(sessionID), JSON.stringify([legacy, quotedWithOctal]))
      expect(await SessionSummary.readDiff(sessionID)).toEqual([migrated, migrated])
      expect(await Filesystem.readJson(recordPath(sessionID))).toEqual({ version: 2, changes: [migrated, migrated] })
      expect(await SessionSummary.readDiff(sessionID)).toEqual([migrated, migrated])

      await Filesystem.writeAtomic(recordPath(concurrentID), JSON.stringify([legacy]))
      await Promise.all([SessionSummary.readDiff(concurrentID), SessionSummary.writeDiff(concurrentID, [current])])
      expect(await SessionSummary.readDiff(concurrentID)).toEqual([current])
      expect(await Filesystem.readJson(recordPath(concurrentID))).toEqual({ version: 2, changes: [current] })
    },
  })
})
