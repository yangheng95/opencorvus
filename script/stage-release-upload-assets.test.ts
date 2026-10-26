import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

describe("GitHub Release asset staging", () => {
  test("transfers and stages all five native installer and CLI rows as independent upload files", async () => {
    const temporary = path.resolve(os.tmpdir())
    const root = await fs.mkdtemp(path.join(temporary, "opencorvus-release-assets-"))
    const sourceRoot = path.join(root, "source")
    const output = path.join(root, "output")
    const artifacts = {
      "overlay-linux-x64": [
        "OpenCorvus_0.0.35-beta_amd64.AppImage",
        "OpenCorvus_0.0.35-beta_amd64.AppImage.sig",
        "OpenCorvus_0.0.35-beta_amd64.deb",
        "OpenCorvus-0.0.35-beta-1.x86_64.rpm",
      ],
      "overlay-linux-arm64": [
        "OpenCorvus_0.0.35-beta_aarch64.AppImage",
        "OpenCorvus_0.0.35-beta_aarch64.AppImage.sig",
        "OpenCorvus_0.0.35-beta_arm64.deb",
        "OpenCorvus-0.0.35-beta-1.aarch64.rpm",
      ],
      "overlay-darwin-x64": [
        "OpenCorvus_0.0.35-beta_x64.dmg",
        "OpenCorvus_0.0.35-beta_x64.app.tar.gz",
        "OpenCorvus_0.0.35-beta_x64.app.tar.gz.sig",
      ],
      "overlay-darwin-arm64": [
        "OpenCorvus_0.0.35-beta_aarch64.dmg",
        "OpenCorvus_0.0.35-beta_aarch64.app.tar.gz",
        "OpenCorvus_0.0.35-beta_aarch64.app.tar.gz.sig",
      ],
      "overlay-windows-x64": [
        "OpenCorvus_0.0.35-beta_x64.msi",
        "OpenCorvus_0.0.35-beta_x64-setup.exe",
        "OpenCorvus_0.0.35-beta_x64-setup.exe.sig",
      ],
      "cli-linux-x64": ["opencorvus-linux-x64.tar.gz", "opencorvus-linux-x64-baseline.tar.gz"],
      "cli-linux-arm64": ["opencorvus-linux-arm64.tar.gz"],
      "cli-darwin-x64": ["opencorvus-darwin-x64.tar.gz", "opencorvus-darwin-x64-baseline.tar.gz"],
      "cli-darwin-arm64": ["opencorvus-darwin-arm64.tar.gz"],
      "cli-windows-x64": ["opencorvus-windows-x64.tar.gz", "opencorvus-windows-x64-baseline.tar.gz"],
    } as const
    await Promise.all(
      Object.keys(artifacts).map((artifact) => fs.mkdir(path.join(sourceRoot, artifact), { recursive: true })),
    )
    await fs.mkdir(path.join(root, "packages/opencorvus"), { recursive: true })
    await fs.writeFile(path.join(root, "packages/opencorvus/package.json"), JSON.stringify({ version: "0.0.35-beta" }))
    await Promise.all(
      Object.entries(artifacts).map(async ([artifact, assets]) => {
        const directory = artifact.startsWith("overlay-")
          ? path.join(root, "packages/overlay/dist-artifacts", artifact.slice("overlay-".length))
          : path.join(sourceRoot, artifact)
        await fs.mkdir(directory, { recursive: true })
        await Promise.all(assets.map((asset) => fs.writeFile(path.join(directory, asset), asset)))
        if (artifact.startsWith("overlay-"))
          await fs.writeFile(path.join(directory, "opencorvus-overlay"), "bare runtime")
      }),
    )

    try {
      for (const [artifact, assets] of Object.entries(artifacts)) {
        if (!artifact.startsWith("overlay-")) continue
        const platform = artifact.slice("overlay-".length)
        const run = (canonical: boolean) =>
          Bun.spawnSync([process.execPath, path.join(import.meta.dir, "select-overlay-transfer.ts")], {
            cwd: root,
            env: { ...process.env, OVERLAY_TRANSFER_PLATFORM: platform, RELEASE_RUN_ID: canonical ? "1234" : "" },
            stdout: "pipe",
            stderr: "pipe",
          })
        const selected = run(true)
        expect({ exit: selected.exitCode, stderr: selected.stderr.toString() }).toEqual({ exit: 0, stderr: "" })
        const expected = assets.map((asset) => `packages/overlay/dist-artifacts/${platform}/${asset}`).sort()
        expect(selected.stdout.toString().trim().split(/\r?\n/)).toEqual([
          "paths<<OPENCORVUS_OVERLAY_TRANSFER_PATHS",
          ...expected,
          "OPENCORVUS_OVERLAY_TRANSFER_PATHS",
        ])
        for (const selectedPath of selected.stdout.toString().trim().split(/\r?\n/).slice(1, -1)) {
          await fs.copyFile(path.join(root, selectedPath), path.join(sourceRoot, artifact, path.basename(selectedPath)))
        }
        const debug = run(false)
        expect({
          exit: debug.exitCode,
          stderr: debug.stderr.toString(),
          output: debug.stdout.toString().trim(),
        }).toEqual({
          exit: 0,
          stderr: "",
          output: [
            "paths<<OPENCORVUS_OVERLAY_TRANSFER_PATHS",
            `packages/overlay/dist-artifacts/${platform}`,
            "OPENCORVUS_OVERLAY_TRANSFER_PATHS",
          ].join("\n"),
        })
      }
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
      expect(await Promise.all(assets.map((asset) => fs.readFile(path.join(output, asset), "utf8")))).toEqual(assets)
    } finally {
      if (
        path.dirname(path.resolve(root)) !== temporary ||
        !path.basename(root).startsWith("opencorvus-release-assets-")
      ) {
        throw new Error(`Unsafe release asset fixture cleanup: ${root}`)
      }
      if ((await fs.lstat(root)).isSymbolicLink()) throw new Error(`Linked release asset fixture: ${root}`)
      await fs.rm(root, { recursive: true, force: true })
    }
  })
})
