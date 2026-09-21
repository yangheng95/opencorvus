#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { copyReleaseFile } from "../../../script/copy-release-file"
import { runTimedStage } from "../../../script/timed-stage"
import { writeOverlayPayloadStamp } from "../../opencorvus/script/build-overlay-payload-stamp"
import { finalizeWorkArtifactPackage } from "../../opencorvus/script/finalize-work-artifact-package"
import { parseOverlayReleaseBuildArgs } from "./release-build-options"
import { installerBundler } from "./installer-bundler"

import {
  overlayArchFromNode,
  overlayExecutableFileName,
  overlayPlatformFromNode,
  overlayServerDistName,
  overlayServerFileName,
} from "./artifact-names"

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = path.resolve(dir, "../..")
const opencorvus = path.resolve(repo, "packages/opencorvus")
const tauri = path.resolve(dir, "src-tauri")
const configuredCargoTarget = process.env.CARGO_TARGET_DIR?.trim()
const target = configuredCargoTarget ? path.resolve(configuredCargoTarget) : path.join(tauri, "target")
const release = path.join(target, "release")

const hostPlatform = overlayPlatformFromNode()
const hostArch = overlayArchFromNode()
const serverFile = overlayServerFileName(hostPlatform)
const overlayFile = overlayExecutableFileName(hostPlatform)
const serverDistName = overlayServerDistName(hostPlatform, hostArch)

const distServerDir = path.join(opencorvus, "dist", serverDistName)
const distServer = path.join(distServerDir, serverFile)
const packagingSnapshot = path.join(release, "package-input", overlayFile)
const stagedResources = path.join(tauri, "resources")
const options = parseOverlayReleaseBuildArgs(process.argv.slice(2))

async function exists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

async function cargoPath() {
  if (process.platform !== "win32") return process.env.PATH
  const dir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".cargo", "bin") : ""
  if (!dir) return process.env.PATH
  if (!(await exists(path.join(dir, "cargo.exe")))) return process.env.PATH
  const list = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)
  if (list.includes(dir)) return process.env.PATH
  return [dir, ...list].join(path.delimiter)
}

function tauriArgs() {
  return [
    "--config",
    JSON.stringify({
      build: { beforeBuildCommand: null },
      bundle: {
        resources: [],
        windows: { nsis: { compression: "zlib" } },
      },
    }),
  ]
}

async function removeDirIfEmpty(dir: string) {
  const entries = await fs.readdir(dir).catch(() => null)
  if (entries && entries.length === 0) {
    await fs.rmdir(dir).catch(() => undefined)
  }
}

async function cleanBuildResidue() {
  await Promise.all([
    fs.rm(path.join(target, "build-resources"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(target, "bundle-build"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(release, "bundle"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(release, "nsis"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(release, "wix"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(release, "package-input"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(release, serverFile), { force: true }).catch(() => undefined),
    fs.rm(path.join(release, "ui"), { recursive: true, force: true }).catch(() => undefined),
    fs.rm(path.join(stagedResources, serverFile), { force: true }).catch(() => undefined),
    fs.rm(path.join(stagedResources, "ui"), { recursive: true, force: true }).catch(() => undefined),
  ])
  await removeDirIfEmpty(stagedResources)
  const files = await fs.readdir(release).catch(() => [])
  await Promise.all(
    files
      .filter((file) => /^OpenCorvus_.*\.(?:msi|exe)$/i.test(file))
      .map((file) => fs.rm(path.join(release, file), { force: true }).catch(() => undefined)),
  )
}

const tauriEnvironment = {
  ...process.env,
  CARGO_TARGET_DIR: target,
  OPENCORVUS_EMBED_PATH: distServerDir,
  PATH: await cargoPath(),
}

if (options.compile) {
  await runTimedStage("Overlay Vite build", async () => {
    await $`bun run build:vite`.cwd(dir)
  })

  await runTimedStage("Embedded backend build", async () => {
    await $`bun run build --overlay-server`.cwd(opencorvus)
  })

  if (!(await exists(distServer))) {
    throw new Error(`Bundled opencorvus binary not found at ${distServer}`)
  }
  await finalizeWorkArtifactPackage({
    root: distServerDir,
    target: {
      os: hostPlatform === "windows" ? "win32" : hostPlatform,
      arch: hostArch,
    },
  })
  await writeOverlayPayloadStamp(distServerDir)

  await cleanBuildResidue()

  await runTimedStage("Tauri executable build", async () => {
    await $`tauri build --no-bundle ${tauriArgs()}`.cwd(dir).env(tauriEnvironment)
  })

  const builtOverlay = path.join(release, overlayFile)
  if (!(await exists(builtOverlay))) {
    throw new Error(`Overlay binary not found at ${builtOverlay}`)
  }

  await copyReleaseFile(builtOverlay, packagingSnapshot)
}

// The same bundle phase serves local full builds and independent Linux CI jobs.
// Keep the paired macOS/Windows invocation; Linux formats each get their own timer.
const groups = process.platform === "linux" ? options.bundles.map((kind) => [kind]) : [options.bundles]
for (const bundles of groups.filter((group) => group.length > 0)) {
  if (!(await exists(packagingSnapshot))) throw new Error(`Missing compiled installer input: ${packagingSnapshot}`)
  if (process.platform === "linux") await copyReleaseFile(packagingSnapshot, path.join(release, overlayFile))
  const bundler = await installerBundler(bundles)
  await runTimedStage(`Tauri installer bundle (${bundles.join(", ")})`, async () => {
    await $`${bundler} bundle --bundles ${bundles} ${tauriArgs()}`.cwd(dir).env(tauriEnvironment)
  })
}
