import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

describe("GitHub Release asset staging", () => {
  test("stages every validated native installer and CLI archive as an independent upload file", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-release-assets-"))
    const sourceRoot = path.join(root, "source")
    const output = path.join(root, "output")
    const artifacts = {
      "overlay-linux-x64": [
        "OpenCorvus_0.0.35-beta_amd64.AppImage",
        "OpenCorvus_0.0.35-beta_amd64.deb",
        "OpenCorvus-0.0.35-beta-1.x86_64.rpm",
      ],
      "overlay-linux-arm64": [
        "OpenCorvus_0.0.35-beta_aarch64.AppImage",
        "OpenCorvus_0.0.35-beta_arm64.deb",
        "OpenCorvus-0.0.35-beta-1.aarch64.rpm",
      ],
      "overlay-darwin-x64": ["OpenCorvus_0.0.35-beta_x64.dmg", "OpenCorvus_0.0.35-beta_x64.app.tar.gz"],
      "overlay-darwin-arm64": ["OpenCorvus_0.0.35-beta_aarch64.dmg", "OpenCorvus_0.0.35-beta_aarch64.app.tar.gz"],
      "overlay-windows-x64": ["OpenCorvus_0.0.35-beta_x64.msi", "OpenCorvus_0.0.35-beta_x64-setup.exe"],
      "cli-linux-x64": ["opencorvus-linux-x64.tar.gz", "opencorvus-linux-x64-baseline.tar.gz"],
      "cli-linux-arm64": ["opencorvus-linux-arm64.tar.gz"],
      "cli-darwin-x64": ["opencorvus-darwin-x64.tar.gz", "opencorvus-darwin-x64-baseline.tar.gz"],
      "cli-darwin-arm64": ["opencorvus-darwin-arm64.tar.gz"],
      "cli-windows-x64": ["opencorvus-windows-x64.tar.gz", "opencorvus-windows-x64-baseline.tar.gz"],
    } as const
    await Promise.all(
      Object.keys(artifacts).map((artifact) => fs.mkdir(path.join(sourceRoot, artifact), { recursive: true })),
    )
    await Promise.all(
      Object.entries(artifacts).flatMap(([artifact, assets]) =>
        assets.map((asset) => fs.writeFile(path.join(sourceRoot, artifact, asset), asset)),
      ),
    )

    try {
      const child = Bun.spawn(
        [
          Bun.which("bun")!,
          path.join(import.meta.dir, "stage-release-upload-assets.ts"),
          "--source",
          sourceRoot,
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
      const assets = Object.values(artifacts).flat().toSorted()
      expect((await fs.readdir(output)).sort()).toEqual(assets)
      expect(stdout.trim().split(/\r?\n/).sort()).toEqual(assets)
    } finally {
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
