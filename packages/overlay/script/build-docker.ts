#!/usr/bin/env bun
/**
 * Build overlay for Linux targets using Docker.
 * Requires: Docker Desktop running, opencorvus binaries pre-built with --all.
 *
 * Usage:
 *   bun run script/build-docker.ts                         # linux-x64 + linux-arm64
 *   bun run script/build-docker.ts --target=linux-x64      # single target
 */

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"

import { overlayPackageName, overlayServerDistName, overlayServerFileName } from "./artifact-names"
import { writeOverlayPayloadStamp } from "../../opencorvus/script/build-overlay-payload-stamp"
import { finalizeWorkArtifactPackage } from "../../opencorvus/script/finalize-work-artifact-package"

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = path.resolve(dir, "../..")
const opencorvus = path.resolve(repo, "packages/opencorvus")
const tauriDir = path.resolve(dir, "src-tauri")
const dockerDir = path.join(dir, "docker")
const stagedResources = path.join(tauriDir, "resources")

const IMAGE_NAME = "opencorvus-overlay-builder"
const { packageManager, engines } = await Bun.file(path.join(repo, "package.json")).json()
const bunVersion = /^bun@([^+]+)$/.exec(packageManager)?.[1]
if (!bunVersion) throw new Error("Root packageManager must declare an exact Bun version")
const nodeVersion = engines?.node
if (typeof nodeVersion !== "string" || !/^\d+$/.test(nodeVersion)) {
  throw new Error("Root engines.node must declare the build Node.js major version")
}

type Target = "linux-x64" | "linux-arm64"

const argTargets = process.argv.filter((a) => a.startsWith("--target=")).map((a) => a.split("=")[1] as Target)
const targets: Target[] = argTargets.length > 0 ? argTargets : ["linux-x64", "linux-arm64"]

async function fileExists(p: string) {
  return fs
    .access(p)
    .then(() => true)
    .catch(() => false)
}

async function removeDirIfEmpty(dir: string) {
  const entries = await fs.readdir(dir).catch(() => null)
  if (entries && entries.length === 0) {
    await fs.rmdir(dir).catch(() => undefined)
  }
}

async function cleanupStaging(serverFile: string) {
  await Promise.all([
    fs.rm(path.join(stagedResources, serverFile), { force: true }).catch(() => undefined),
    fs.rm(path.join(stagedResources, "ui"), { recursive: true, force: true }).catch(() => undefined),
  ])
  await removeDirIfEmpty(stagedResources)
}

function tauriArgs() {
  return ["--config", JSON.stringify({ build: { beforeBuildCommand: "" }, bundle: { resources: [] } })]
}

/** Convert Windows path to Docker-compatible path (for -v mounts in Git Bash/MINGW). */
function toDockerPath(p: string): string {
  if (process.platform === "win32") {
    return p.replace(/^([A-Za-z]):[/\\]/, (_, d) => `/${d.toLowerCase()}/`).replaceAll("\\", "/")
  }
  return p
}

async function ensureDockerImage(platform: "linux/amd64" | "linux/arm64") {
  const platformTag = platform.replace("/", "-")
  const tag = `${IMAGE_NAME}:${platformTag}-bun-${bunVersion}-node-${nodeVersion}`
  console.log(`Building current Docker inputs for ${tag} (cached layers are reused)...`)
  await $`docker buildx build --load --platform ${platform} --build-arg BUN_VERSION=${bunVersion} --build-arg NODE_VERSION=${nodeVersion} -t ${tag} ${dockerDir}`
  return tag
}

// Frontend dependencies belong to the host workspace. Mount the completed
// frontend rather than asking the native builder to use host node_modules.
await $`bun run build:vite`.cwd(dir)

for (const target of targets) {
  const [, arch] = target.split("-") as [string, "x64" | "arm64"]
  const dockerPlatform = arch === "x64" ? "linux/amd64" : "linux/arm64"
  const packageName = overlayPackageName("linux", arch)

  console.log(`\n=== overlay ${target} (Docker) ===`)

  // Verify pre-built opencorvus binary exists
  const serverDir = path.join(opencorvus, "dist", overlayServerDistName("linux", arch))
  const serverBin = path.join(serverDir, overlayServerFileName("linux"))
  if (!(await fileExists(serverBin))) {
    console.error(`ERROR: opencorvus binary not found: ${serverBin}`)
    console.error("Run first: cd packages/opencorvus && bun run build --overlay-server --all")
    process.exit(1)
  }
  await finalizeWorkArtifactPackage({ root: serverDir, target: { os: "linux", arch } })
  await writeOverlayPayloadStamp(serverDir)

  // Enable QEMU for arm64 if needed
  if (arch === "arm64") {
    console.log("  enabling QEMU arm64 emulation...")
    await $`docker run --privileged --rm tonistiigi/binfmt --install arm64`.nothrow().quiet()
  }

  // Let Docker validate current inputs and reuse its layer cache.
  const image = await ensureDockerImage(dockerPlatform as "linux/amd64" | "linux/arm64")
  await cleanupStaging("opencorvus")

  // Named volumes for Cargo and build cache (avoids recompiling on every run)
  const cargoVol = `opencorvus-cargo-home-${arch}`
  const targetVol = `opencorvus-overlay-target-${arch}`

  // Run tauri build inside Docker
  await $`docker run --rm
    --platform ${dockerPlatform}
    -v ${toDockerPath(path.join(dir, "src"))}:/repo/packages/overlay/src:ro
    -v ${toDockerPath(tauriDir)}:/repo/packages/overlay/src-tauri
    -v ${toDockerPath(path.join(dir, "dist-vite"))}:/repo/packages/overlay/dist-vite:ro
    -v ${toDockerPath(path.join(repo, "patches/rust"))}:/repo/patches/rust:ro
    -v ${toDockerPath(path.join(opencorvus, "server-defaults.json"))}:/repo/packages/opencorvus/server-defaults.json:ro
    -v ${toDockerPath(serverDir)}:/repo/embedded/opencorvus:ro
    -v ${cargoVol}:/root/.cargo
    -v ${targetVol}:/repo/packages/overlay/src-tauri/target
    -w /repo/packages/overlay/src-tauri
    -e CARGO_TARGET_DIR=/repo/packages/overlay/src-tauri/target
    -e OPENCORVUS_EMBED_PATH=/repo/embedded/opencorvus
    ${image}
    tauri build --no-bundle ${tauriArgs()} -- --locked`

  // Collect artifacts into a flat portable package directory
  const outDir = path.join(dir, "dist", packageName)
  await fs.rm(outDir, { recursive: true, force: true }).catch(() => undefined)
  await fs.mkdir(outDir, { recursive: true })

  // The target volume is a named Docker volume — copy artifacts out of it
  const releaseInVol = `/repo/packages/overlay/src-tauri/target/release`
  await $`docker run --rm
    -v ${targetVol}:/repo/packages/overlay/src-tauri/target:ro
    -v ${toDockerPath(outDir)}:/out
    --platform ${dockerPlatform}
    ${image}
    sh -c "cp -f ${releaseInVol}/opencorvus-overlay /out/opencorvus-overlay"`
  await cleanupStaging("opencorvus")

  console.log(`  portable package → packages/overlay/dist/${packageName}/`)
}

console.log("\nDocker overlay builds complete.")
