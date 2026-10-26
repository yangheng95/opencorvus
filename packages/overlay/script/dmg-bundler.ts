import { $ } from "bun"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { overlayBundleArchitecture } from "../../../script/release-asset-contract"
import type { OverlayArtifactArch } from "./artifact-names"

export const CREATE_DMG_VERSION = "1.3.0"

type Point = { x: number; y: number }
export type DmgConfiguration = {
  productName: string
  version: string
  bundle: {
    icon: string[]
    macOS: {
      dmg: { windowSize: { width: number; height: number }; appPosition: Point; applicationFolderPosition: Point }
    }
  }
}

export function requireCreateDmgVersion(observed: string): string {
  const version = observed.trim()
  if (version !== CREATE_DMG_VERSION)
    throw new Error(`DMG packaging requires create-dmg ${CREATE_DMG_VERSION}; observed ${JSON.stringify(version)}`)
  return version
}

export function dmgCommand(input: {
  configuration: DmgConfiguration
  arch: OverlayArtifactArch
  configurationDirectory: string
  source: string
  outputDirectory: string
  ci: boolean
}) {
  const { configuration: config } = input
  if (
    path.basename(config.productName) !== config.productName ||
    !config.productName ||
    [".", ".."].includes(config.productName)
  )
    throw new Error("DMG product name must be a single filename")
  const { appPosition, applicationFolderPosition, windowSize } = config.bundle.macOS.dmg
  const icon = config.bundle.icon.find((file) => path.extname(file) === ".icns")
  if (!icon) throw new Error("DMG packaging requires the configured ICNS icon")
  const volumeIcon = path.resolve(input.configurationDirectory, icon)
  const arch = overlayBundleArchitecture(`darwin-${input.arch}`).mac
  const image = path.join(input.outputDirectory, `${config.productName}_${config.version}_${arch}.dmg`)
  const app = `${config.productName}.app`
  const args = [
    "--volname",
    config.productName,
    "--icon",
    app,
    String(appPosition.x),
    String(appPosition.y),
    "--app-drop-link",
    String(applicationFolderPosition.x),
    String(applicationFolderPosition.y),
    "--window-size",
    String(windowSize.width),
    String(windowSize.height),
    "--hide-extension",
    app,
    "--volicon",
    volumeIcon,
    ...(input.ci ? ["--skip-jenkins"] : []),
    image,
    input.source,
  ]
  return { executable: "create-dmg", args, image, app, volumeIcon }
}

/** One DMG producer; Tauri remains the app and signed updater-archive owner. */
export async function prepareDmgBundler() {
  if (process.platform !== "darwin") throw new Error("DMG packaging requires its native macOS host")
  const environment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("TAURI_SIGNING_")),
  )
  const version = requireCreateDmgVersion(await $`create-dmg --pure-version`.env(environment).text())
  console.log(`[package] create-dmg ${version}`)
  return async (input: {
    configuration: DmgConfiguration
    arch: OverlayArtifactArch
    configurationDirectory: string
    release: string
  }) => {
    const output = path.join(input.release, "bundle", "dmg")
    await fs.mkdir(output, { recursive: true })
    const source = await fs.mkdtemp(path.join(output, "source-"))
    const mount = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-dmg-verify-"))
    const command = dmgCommand({ ...input, source, outputDirectory: output, ci: process.env.CI === "true" })
    let mounted = false
    try {
      await fs.access(command.volumeIcon)
      const app = path.join(input.release, "bundle", "macos", command.app)
      const staged = path.join(source, command.app)
      await $`ditto ${app} ${staged}`.env(environment)
      await $`codesign --verify --deep --strict ${staged}`.env(environment)
      await $`${command.executable} ${command.args}`.env(environment)
      await $`hdiutil verify ${command.image}`.env(environment)
      await $`hdiutil attach -readonly -nobrowse -noautoopen -mountpoint ${mount} ${command.image}`.env(environment)
      mounted = true
      const installedApp = path.join(mount, command.app)
      await $`codesign --verify --deep --strict ${installedApp}`.env(environment)
      const version = (
        await $`plutil -extract CFBundleShortVersionString raw -o - ${path.join(installedApp, "Contents", "Info.plist")}`
          .env(environment)
          .text()
      ).trim()
      if (version !== input.configuration.version)
        throw new Error(`Mounted DMG version mismatch: ${version}; expected ${input.configuration.version}`)
      console.log(`[package] Mounted ${command.app} ${version} verified`)
      return command.image
    } finally {
      if (mounted) await $`hdiutil detach ${mount}`.env(environment)
      await fs.rmdir(mount).catch((error) => {
        if (error.code !== "ENOENT") throw error
      })
      if (path.dirname(source) !== output || !path.basename(source).startsWith("source-"))
        throw new Error("DMG staging directory escaped its owned output")
      await fs.rm(source, { recursive: true, force: true })
    }
  }
}
