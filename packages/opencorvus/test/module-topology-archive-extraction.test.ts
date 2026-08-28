import { spawnSync } from "node:child_process"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { afterEach, expect, test } from "bun:test"
import { extractSnapshotArchive } from "../script/check/module-topology"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test("module-topology extracts a local snapshot archive from a Windows-safe basename", async () => {
  const snapshotRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus topology snapshot "))
  temporaryRoots.push(snapshotRoot)
  await writeFile(path.join(snapshotRoot, "protocol-owner.txt"), "single-source")

  const archive = spawnSync("tar", ["-cf", "snapshot.tar", "protocol-owner.txt"], {
    cwd: snapshotRoot,
    encoding: "utf8",
    windowsHide: true,
  })
  if (archive.error) throw archive.error
  expect(archive.status).toBe(0)
  await rm(path.join(snapshotRoot, "protocol-owner.txt"))

  extractSnapshotArchive(snapshotRoot, "snapshot.tar")

  expect(await readFile(path.join(snapshotRoot, "protocol-owner.txt"), "utf8")).toBe("single-source")
})
