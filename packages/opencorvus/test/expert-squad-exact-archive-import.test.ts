
import { describe, expect, setDefaultTimeout, test } from "bun:test"
import { rm } from "node:fs/promises"
import { ExpertSquadPackageManager } from "../src/expert-squad/manager"
import { Global } from "../src/global"

setDefaultTimeout(30_000)

describe("Expert Squad exact archive handoff", () => {
  test("imports the canonical archive only for its bound identity, version, and package digest", async () => {
    const projectDirectory = await Global.createTemporaryDirectory("expert-squad-exact-archive-")

    try {
      const installed = await ExpertSquadPackageManager.installPayloadPackage({
        projectDirectory,
        id: "frontend-replica",
        installationScope: "project",
      })
      const exported = await ExpertSquadPackageManager.exportArchive({
        projectDirectory,
        id: "frontend-replica",
        installationScope: "project",
      })

      const receipt = await ExpertSquadPackageManager.importArchive({
        projectDirectory,
        archiveBase64: Buffer.from(exported.bytes).toString("base64"),
        filename: exported.filename,
        installationScope: "project",
        expectedNamespace: exported.namespace,
        expectedID: exported.id,
        expectedVersion: exported.version,
        expectedPackageDigest: exported.packageDigest,
      })

      expect(receipt).toEqual({
        operation: "unchanged",
        before: installed.after,
        after: installed.after,
      })
      expect(exported).toMatchObject({
        namespace: installed.after.namespace,
        id: installed.after.id,
        version: installed.after.version,
        packageDigest: installed.after.packageDigest,
        archiveSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      })

      await expect(
        ExpertSquadPackageManager.importArchive({
          projectDirectory,
          archiveBase64: Buffer.from(exported.bytes).toString("base64"),
          filename: exported.filename,
          installationScope: "project",
          expectedNamespace: "different-namespace",
          expectedID: exported.id,
          expectedVersion: exported.version,
          expectedPackageDigest: exported.packageDigest,
        }),
      ).rejects.toThrow("Expert squad update namespace mismatch")
    } finally {
      await rm(projectDirectory, { recursive: true, force: true })
    }
  })
})
