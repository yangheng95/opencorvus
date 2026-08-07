import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { discoverArtifactBinaryPaths } from "../../script/runtime-executable-contract"

test("runtime executable discovery reads native binaries below a namespaced long path", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-runtime-contract-"))
  const deepDirectory = path.join(root, ...Array.from({ length: 12 }, (_, index) => `payload-segment-${index}-abcdef`))
  const magicBinary = path.join(deepDirectory, "runtime-binary")
  const extensionBinary = path.join(deepDirectory, "native-addon.node")

  try {
    await fs.mkdir(path.toNamespacedPath(deepDirectory), { recursive: true })
    await fs.writeFile(path.toNamespacedPath(magicBinary), Buffer.from([0x4d, 0x5a, 0, 0]))
    await fs.writeFile(path.toNamespacedPath(extensionBinary), Buffer.from("native addon"))

    expect(await discoverArtifactBinaryPaths(root)).toEqual([extensionBinary, magicBinary].sort((a, b) => a.localeCompare(b)))
  } finally {
    await fs.rm(path.toNamespacedPath(root), { recursive: true, force: true })
  }
})
