import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

describe("GitHub Release asset staging", () => {
  test("stages each validated Windows installer as an independent upload file", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-release-assets-"))
    const source = path.join(root, "source", "overlay-windows-x64")
    const output = path.join(root, "output")
    const assets = [
      "OpenCorvus_0.0.35-beta_x64.msi",
      "OpenCorvus_0.0.35-beta_x64-setup.exe",
    ]
    await fs.mkdir(source, { recursive: true })
    await Promise.all(assets.map((asset) => fs.writeFile(path.join(source, asset), asset)))

    try {
      const child = Bun.spawn(
        [
          Bun.which("bun")!,
          path.join(import.meta.dir, "stage-release-upload-assets.ts"),
          "--source",
          path.join(root, "source"),
          "--out",
          output,
          "--version",
          "0.0.35-beta",
        ],
        { stdout: "pipe", stderr: "pipe" },
      )
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])

      expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: "" })
      expect((await fs.readdir(output)).sort()).toEqual(assets.toSorted())
      expect(stdout.trim().split(/\r?\n/).sort()).toEqual(assets.toSorted())
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
