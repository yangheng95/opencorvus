#!/usr/bin/env bun
/**
 * Local full-platform packaging script.
 *
 * Builds all possible platform artifacts from the current machine:
 *   - opencorvus overlay-server sidecar: all platforms (Bun cross-compile)
 *   - overlay windows-x64: native build (Windows only)
 *   - overlay linux-x64 / linux-arm64: Docker build
 *   - overlay darwin-*: skipped (requires macOS hardware)
 *
 * Usage:
 *   bun run package:local                      # all of the above
 *   bun run package:local --skip-cli           # skip opencorvus --all
 *   bun run package:local --skip-linux         # skip Docker Linux overlay builds
 *   bun run package:local --skip-native        # skip native overlay build
 *   bun run package:local --target=linux-x64   # Docker: specific Linux target only
 */

import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const opencorvus = path.join(repo, "packages/opencorvus")
const overlay = path.join(repo, "packages/overlay")

const skipCli = process.argv.includes("--skip-cli")
const skipLinux = process.argv.includes("--skip-linux")
const skipNative = process.argv.includes("--skip-native")
const linuxTargets = process.argv.filter((a) => a.startsWith("--target=")).map((a) => a.split("=")[1])

// ── 1. opencorvus overlay server — all platforms ─────────────────────────────
if (!skipCli) {
  console.log("\n=== overlay UI assets ===")
  await $`bun run build:vite`.cwd(overlay)

  console.log("\n=== opencorvus overlay server (all platforms) ===")
  await $`bun run build --overlay-server --all`.cwd(opencorvus)
  console.log("  opencorvus overlay server done -> packages/opencorvus/dist/")
} else {
  console.log("  [skip] opencorvus overlay server (--skip-cli)")
}

// ── 2. overlay — current platform (native) ───────────────────────────────────
if (!skipNative && process.platform !== "linux") {
  // On Linux CI we skip native since Docker handles it; on Windows/macOS we build native
  console.log(`\n=== overlay ${process.platform}-${process.arch} (native) ===`)
  await $`bun run build --skip-opencorvus-build`.cwd(overlay)
  console.log(`  overlay native done → packages/overlay/src-tauri/target/release/bundle/`)
} else if (!skipNative && process.platform === "linux") {
  console.log("\n=== overlay linux-x64 (native, Linux host) ===")
  await $`bun run build --skip-opencorvus-build`.cwd(overlay)
} else {
  console.log("  [skip] overlay native (--skip-native)")
}

// ── 3. overlay — Linux targets via Docker ────────────────────────────────────
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

// ── 4. darwin — reminder ─────────────────────────────────────────────────────
if (process.platform !== "darwin") {
  console.log("\n  [info] overlay darwin-* skipped: requires macOS hardware (Apple SDK restriction)")
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(`
=== Package complete ===
  opencorvus server:   packages/opencorvus/dist/opencorvus-overlay-server-{platform}-{arch}/
  overlay (native):    packages/overlay/src-tauri/target/release/bundle/
  overlay (linux):     packages/overlay/dist-artifacts/{linux-x64,linux-arm64}/
  overlay (darwin):    — requires macOS machine —
`)
