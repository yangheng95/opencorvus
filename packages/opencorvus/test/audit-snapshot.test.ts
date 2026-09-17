import { expect, test } from "bun:test"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { createAuditSnapshotPublisher, latestAuditSnapshotFiles } from "../script/audit-snapshot"

test("publishes complete immutable revisions while a prior snapshot remains open", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "opencorvus-audit-snapshot-"))
  const publish = createAuditSnapshotPublisher(root, "streams")
  const first = publish({ revision: 1, text: "first" })
  const reader = fs.openSync(first, "r")
  try {
    let latest = first
    for (let revision = 2; revision <= 12; revision++) latest = publish({ revision, text: "complete" })
    const sibling = createAuditSnapshotPublisher(root, "streams")({ revision: 1, text: "sibling" })
    expect((await latestAuditSnapshotFiles(root, "streams")).sort()).toEqual([latest, sibling].sort())
    expect(JSON.parse(fs.readFileSync(reader, "utf8"))).toEqual({ revision: 1, text: "first" })
    expect(JSON.parse(fs.readFileSync(latest, "utf8"))).toEqual({ revision: 12, text: "complete" })
  } finally {
    fs.closeSync(reader)
    for (const name of fs.readdirSync(root)) fs.unlinkSync(path.join(root, name))
    fs.rmdirSync(root)
  }
})
