import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  GUI_INSTALLER_MATRIX,
  guiInstallerStagePaths,
  stageGuiInstallerArtifacts,
} from "./package-gui-installer-matrix"

describe("GUI installer staging", () => {
  test("stages Tauri's signed macOS archive under its canonical public name", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-gui-staging-"))
    const row = GUI_INSTALLER_MATRIX.find((candidate) => candidate.id === "darwin-arm64")!
    const paths = guiInstallerStagePaths(repoRoot, row)
    const archive = path.join(paths.bundleRoot, "macos", "OpenCorvus.app.tar.gz")
    const dmg = path.join(paths.bundleRoot, "dmg", "OpenCorvus_0.0.37-beta_aarch64.dmg")

    try {
      await Promise.all([
        fs.mkdir(path.dirname(paths.executable), { recursive: true }),
        fs.mkdir(path.dirname(archive), { recursive: true }),
        fs.mkdir(path.dirname(dmg), { recursive: true }),
      ])
      await Promise.all([
        fs.writeFile(paths.executable, "overlay"),
        fs.writeFile(archive, "signed updater archive"),
        fs.writeFile(`${archive}.sig`, "updater signature"),
        fs.writeFile(dmg, "disk image"),
      ])

      const staged = await stageGuiInstallerArtifacts(repoRoot, row, "0.0.37-beta")

      expect(staged.map((file) => path.basename(file)).sort()).toEqual(
        [
          "OpenCorvus_0.0.37-beta_aarch64.app.tar.gz",
          "OpenCorvus_0.0.37-beta_aarch64.app.tar.gz.sig",
          "OpenCorvus_0.0.37-beta_aarch64.dmg",
          path.basename(paths.executable),
        ].sort(),
      )
      expect(await fs.readFile(path.join(paths.output, "OpenCorvus_0.0.37-beta_aarch64.app.tar.gz"), "utf8")).toBe(
        "signed updater archive",
      )
      expect(await fs.readFile(path.join(paths.output, "OpenCorvus_0.0.37-beta_aarch64.app.tar.gz.sig"), "utf8")).toBe(
        "updater signature",
      )
    } finally {
      await fs.rm(repoRoot, { recursive: true, force: true })
    }
  })
})
