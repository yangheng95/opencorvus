import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import {
  GUI_INSTALLER_MATRIX,
  guiInstallerBuildCommands,
  guiInstallerStagePaths,
  stageGuiInstallerArtifacts,
  parseGuiInstallerMatrixArgs,
} from "./package-gui-installer-matrix"
import { parseOverlayReleaseBuildArgs } from "../packages/overlay/script/release-build-options"

describe("GUI installer staging", () => {
  test("selects explicit compile, bundle and assembly phases", () => {
    expect(parseGuiInstallerMatrixArgs([])).toEqual({})
    expect(parseGuiInstallerMatrixArgs(["--build-only"])).toEqual({ buildOnly: true })
    expect(parseGuiInstallerMatrixArgs(["--skip-build"])).toEqual({ skipBuild: true })
    expect(() => parseGuiInstallerMatrixArgs(["--build-only", "--skip-build"])).toThrow("Usage:")
    expect(guiInstallerBuildCommands("source", true).at(-1)?.argv).toEqual([
      "bun",
      "run",
      "script/build.ts",
      "--no-bundle",
    ])
    for (const kind of ["deb", "rpm", "appimage"]) {
      expect(parseOverlayReleaseBuildArgs(["--bundle", kind], "linux")).toEqual({ compile: false, bundles: [kind] })
    }
    expect(parseOverlayReleaseBuildArgs(["--no-bundle"], "linux")).toEqual({ compile: true, bundles: [] })
    expect(parseOverlayReleaseBuildArgs([], "linux")).toEqual({ compile: true, bundles: ["deb", "rpm", "appimage"] })
    expect(parseOverlayReleaseBuildArgs([], "darwin")).toEqual({ compile: true, bundles: ["app", "dmg"] })
    expect(parseOverlayReleaseBuildArgs([], "win32")).toEqual({ compile: true, bundles: ["msi", "nsis"] })
    for (const argv of [["--bundle", "msi"], ["--bundle"], ["--no-bundle", "--bundle", "rpm"]]) {
      expect(() => parseOverlayReleaseBuildArgs(argv, "linux")).toThrow("Usage:")
    }
    expect(() => parseOverlayReleaseBuildArgs(["--bundle", "rpm"], "win32")).toThrow("Usage:")
  })

  for (const [platform, debArch, appArch, rpmArch] of [
    ["linux-x64", "amd64", "amd64", "x86_64"],
    ["linux-arm64", "arm64", "aarch64", "aarch64"],
  ] as const) {
    test(`assembles independent ${platform} bundles through the real release checker`, async () => {
      const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-linux-staging-"))
      const row = GUI_INSTALLER_MATRIX.find((candidate) => candidate.id === platform)!
      const paths = guiInstallerStagePaths(repoRoot, row)
      const bundles = [
        ["deb", `OpenCorvus_0.1.6_${debArch}.deb`],
        ["rpm", `OpenCorvus-0.1.6-1.${rpmArch}.rpm`],
        ["appimage", `OpenCorvus_0.1.6_${appArch}.AppImage`],
        ["appimage", `OpenCorvus_0.1.6_${appArch}.AppImage.sig`],
      ]
      try {
        await fs.mkdir(path.dirname(paths.executable), { recursive: true })
        await fs.writeFile(paths.executable, "shared compilation")
        for (const [kind, name] of bundles) {
          await fs.mkdir(path.join(paths.bundleRoot, kind!), { recursive: true })
          await fs.writeFile(path.join(paths.bundleRoot, kind!, name!), name!)
        }
        const staged = await stageGuiInstallerArtifacts(repoRoot, row, "0.1.6")
        expect(staged.map((file) => path.basename(file)).sort()).toEqual(
          ["opencorvus-overlay", ...bundles.map(([, name]) => name!)].sort(),
        )
        expect(await fs.readFile(path.join(paths.output, "opencorvus-overlay"), "utf8")).toBe("shared compilation")
        const checked = Bun.spawnSync([
          process.execPath,
          path.join(import.meta.dir, "check-release-assets.ts"),
          "overlay",
          "--dir",
          paths.output,
          "--platform",
          platform,
          "--version",
          "0.1.6",
          "--require-bundle",
          "--require-updater",
        ])
        expect({ code: checked.exitCode, output: checked.stdout.toString().trim() }).toEqual({
          code: 0,
          output: `Overlay assets validated for ${platform}`,
        })
        await fs.rm(path.join(paths.bundleRoot, "rpm", bundles[1]![1]!))
        await expect(stageGuiInstallerArtifacts(repoRoot, row, "0.1.6")).rejects.toThrow(
          "Linux RPM bundle must resolve to exactly one file",
        )
      } finally {
        await fs.rm(repoRoot, { recursive: true, force: true })
      }
    })
  }

  test("builds the public runtime package dependency chain before the embedded Overlay backend", () => {
    const repoRoot = path.resolve("clean-gui-installer-source")

    expect(guiInstallerBuildCommands(repoRoot)).toEqual([
      {
        label: "Util build",
        cwd: path.join(repoRoot, "packages", "util"),
        argv: ["bun", "run", "build"],
      },
      {
        label: "SDK build",
        cwd: repoRoot,
        argv: ["bun", "packages/sdk/js/script/build.ts"],
      },
      {
        label: "Plugin build",
        cwd: path.join(repoRoot, "packages", "plugin"),
        argv: ["bun", "run", "build"],
      },
      {
        label: "Overlay release build",
        cwd: path.join(repoRoot, "packages", "overlay"),
        argv: ["bun", "run", "script/build.ts"],
      },
    ])
  })

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
