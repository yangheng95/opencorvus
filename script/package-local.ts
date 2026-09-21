#!/usr/bin/env bun
/**
 * Local host packaging script.
 *
 * Builds artifacts that can be verified on the current machine:
 *   - overlay + bound opencorvus sidecar: native build
 *   - native Tauri installer bundles without updater signatures
 *   - overlay linux-x64 / linux-arm64: Docker build
 *
 * Usage:
 *   bun run package:local                      # native + Docker Linux
 *   bun run package:local --skip-linux         # skip Docker Linux overlay builds
 *   bun run package:local --skip-native        # skip native overlay build
 *   bun run package:local --target=linux-x64   # Docker: specific Linux target only
 */

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"
import { nativeBinaryBuildEnv } from "./package-native-binary"
import { installerBundler } from "../packages/overlay/script/installer-bundler"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const overlay = path.join(repo, "packages/overlay")

const skipLinux = process.argv.includes("--skip-linux")
const skipNative = process.argv.includes("--skip-native")
const linuxTargets = process.argv.filter((a) => a.startsWith("--target=")).map((a) => a.split("=")[1])

export function localBundleTargets(platform: NodeJS.Platform = process.platform): string[] {
  if (platform === "darwin") return ["app", "dmg"]
  if (platform === "win32") return ["msi", "nsis"]
  if (platform === "linux") return ["deb", "rpm", "appimage"]
  throw new Error(`Unsupported local package platform: ${platform}`)
}

export function localTauriBundleConfig() {
  return {
    build: { beforeBuildCommand: null },
    bundle: { resources: [], createUpdaterArtifacts: false },
  }
}

export function localCargoTarget(repoRoot: string, env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.CARGO_TARGET_DIR?.trim()
  return configured
    ? path.resolve(repoRoot, configured)
    : path.join(repoRoot, "packages", "overlay", "src-tauri", "target")
}

export function localBuildEnvironment(repoRoot: string, version: string, env: NodeJS.ProcessEnv = process.env) {
  const buildEnv = nativeBinaryBuildEnv(env, version)
  if (buildEnv.OPENCORVUS_VERSION !== version) {
    throw new Error(`Local package version must match desktop metadata ${version}; received ${buildEnv.OPENCORVUS_VERSION}`)
  }
  return { ...buildEnv, CARGO_TARGET_DIR: localCargoTarget(repoRoot, env) }
}

async function main() {
  const { version } = await Bun.file(path.join(repo, "packages/opencorvus/package.json")).json()
  const nativeEnvironment = localBuildEnvironment(repo, version)
  const nativeTarget = nativeEnvironment.CARGO_TARGET_DIR
  const nativeBundle = path.join(nativeTarget, "release", "bundle")
  // ── 1. overlay — current platform (native) ─────────────────────────────────
  if (!skipNative) {
    console.log(`\n=== overlay ${process.platform}-${process.arch} (native) ===`)
    await $`bun run build:overlay --skip-dist-copy`.cwd(overlay).env(nativeEnvironment)
    const bundles = localBundleTargets()
    const bundler = await installerBundler(bundles)
    await $`${bundler} bundle --bundles ${bundles} --config ${JSON.stringify(localTauriBundleConfig())}`
      .cwd(overlay)
      .env(nativeEnvironment)
    console.log(`  overlay native done -> ${nativeBundle}`)
  } else {
    console.log("  [skip] overlay native (--skip-native)")
  }

  // ── 2. overlay — Linux targets via Docker ──────────────────────────────────
  if (!skipLinux) {
    console.log("\n=== overlay Linux targets (Docker) ===")

    // Check Docker is available
    const dockerCheck = await $`docker info`.nothrow().quiet()
    if (dockerCheck.exitCode !== 0) {
      throw new Error(
        "Docker is required for Linux overlay builds. Start Docker Desktop and re-run, or pass --skip-linux explicitly.",
      )
    } else {
      const targetArgs = linuxTargets.map((t) => `--target=${t}`).join(" ")
      await $`bun run script/build-docker.ts ${targetArgs}`.cwd(overlay)
    }
  } else {
    console.log("  [skip] overlay Linux (--skip-linux)")
  }

  if (process.platform !== "darwin") {
    console.log("\n  [info] overlay darwin-* skipped: requires macOS hardware (Apple SDK restriction)")
  }

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`
=== Package complete ===
  overlay (native):    ${nativeBundle}
  overlay (linux):     packages/overlay/dist-artifacts/{linux-x64,linux-arm64}/
  overlay (darwin):    — requires macOS machine —
`)
}

if (import.meta.main) await main()
