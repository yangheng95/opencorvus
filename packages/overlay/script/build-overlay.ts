#!/usr/bin/env bun

/**
 * Full overlay build script — single command for the complete pipeline.
 *
 * Steps:
 *   1. build:vite — bundle main.tsx + CSS + HTML → dist-vite/
 *   2. Remove stale opencorvus binary — force rebuild on every overlay build
 *   3. Generate OpenCorvus build artifacts consumed while rebuilding the SDK
 *   4. Rebuild SDK — regenerate src/gen/ + src/defaults.ts from live opencorvus spec
 *   5. Build opencorvus + tauri build --no-bundle — compile Rust → overlay binary
 *   6. Copy binary to dist/<platform>/
 *
 * Usage:
 *   bun run build:overlay                                # full pipeline (host triple)
 *   bun run build:overlay --target <triple>              # cross-compile to triple (e.g. aarch64-pc-windows-msvc)
 *   bun run build:overlay --skip-tauri                   # UI only (step 1)
 *   bun run build:overlay --skip-dist-copy               # keep target/release only for an installer bundle
 *
 * Note: the caller is responsible for stopping any running overlay process
 * before invoking this script. On Windows, Cargo's linker will fail with
 * LNK1104 on `target/release/deps/opencorvus_overlay.exe` if a live overlay
 * still holds the hardlinked release binary open.
 */

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import { fileURLToPath } from "url"
import { generateOpencorvusGeneratedBuildArtifacts } from "../../opencorvus/script/generate-build-artifacts"

import {
  overlayArchFromTriple,
  overlayExecutableFileName,
  overlayPackageName,
  overlayPlatformFromNode,
  overlayPlatformFromTriple,
  overlayServerDistName,
  overlayServerFileName,
} from "./artifact-names"

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const repo = path.resolve(dir, "../..")
const opencorvus = path.resolve(repo, "packages/opencorvus")
const sdk = path.resolve(repo, "packages/sdk/js")
const tauri = path.resolve(dir, "src-tauri")

// ── Args ──
const argv = process.argv.slice(2)
const skipTauri = argv.includes("--skip-tauri")
const skipDistCopy = argv.includes("--skip-dist-copy")
const targetTripleArg = (() => {
  const i = argv.indexOf("--target")
  return i >= 0 ? argv[i + 1] : undefined
})()

// Triple resolution: explicit --target wins; otherwise derive from host.
function hostTriple() {
  const arch = process.arch === "x64" ? "x86_64" : process.arch === "arm64" ? "aarch64" : process.arch
  if (process.platform === "win32") return `${arch}-pc-windows-msvc`
  if (process.platform === "darwin") return `${arch}-apple-darwin`
  return `${arch}-unknown-linux-gnu`
}
const triple = targetTripleArg ?? hostTriple()
const tripleIsWindows = triple.includes("windows")
const tripleArch = overlayArchFromTriple(triple)
const triplePlatform = overlayPlatformFromTriple(triple)

// Host capability check: cross-OS Tauri builds don't work in this script.
const hostPlatform = overlayPlatformFromNode()
if (triplePlatform !== hostPlatform) {
  throw new Error(
    `Cross-OS build not supported (host=${hostPlatform}, target=${triplePlatform}). ` +
      `Use the GitHub Actions matrix in .github/workflows/build-overlays.yml instead.`,
  )
}

const isWindows = tripleIsWindows
const overlayFile = overlayExecutableFileName(triplePlatform)
const serverFile = overlayServerFileName(triplePlatform)

const serverDistName = overlayServerDistName(triplePlatform, tripleArch)
const packageName = overlayPackageName(triplePlatform, tripleArch)

const distServerDir = path.join(opencorvus, "dist", serverDistName)
const distServer = path.join(distServerDir, serverFile)
const distRoot = path.join(dir, "dist", packageName)
const packagedOverlay = path.join(distRoot, overlayFile)

const target = path.join(tauri, "target")
// `--target` is only forwarded to cargo when the operator explicitly passed
// it (cross-compile / matrix CI). For host builds we let cargo use its
// default host triple and write to `target/release` — this preserves the
// pre-existing fingerprint cache the operator's incremental builds rely on
// (cargo invalidates the cache when artifacts move between target/release
// and target/<triple>/release because fingerprint paths are absolute).
const useExplicitTarget = !!targetTripleArg
const release = useExplicitTarget ? path.join(target, triple, "release") : path.join(target, "release")

function step(label: string) {
  console.log(`\n── ${label} ──`)
}

async function exists(file: string) {
  return fs
    .access(file)
    .then(() => true)
    .catch(() => false)
}

// fs.copyFile fails with EPERM on Windows when the destination already exists
// with the ReadOnly attribute (left behind by a prior extracted/archived copy).
// Unlink the dest first — same `force: true` removal convention used for the
// stale-binary cleanup above — so the copy always overwrites cleanly.
async function copyFileForce(src: string, dst: string) {
  await fs.rm(dst, { force: true })
  await fs.copyFile(src, dst)
}

async function cargoPath() {
  if (!isWindows) return process.env.PATH
  const cargoDir = process.env.USERPROFILE ? path.join(process.env.USERPROFILE, ".cargo", "bin") : ""
  if (!cargoDir) return process.env.PATH
  if (!(await exists(path.join(cargoDir, "cargo.exe")))) return process.env.PATH
  const list = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean)
  if (list.includes(cargoDir)) return process.env.PATH
  return [cargoDir, ...list].join(path.delimiter)
}

function tauriArgs() {
  return [
    "--config",
    JSON.stringify({
      build: { frontendDist: "../dist-vite" },
      bundle: { resources: [] },
    }),
  ]
}

// ── Step 1: build:vite ──
step("Build Vite → dist-vite/")
await $`bun run build:vite`.cwd(dir)

if (skipTauri) {
  console.log("\n✓ UI build complete (--skip-tauri). dist-vite/ is ready.")
  process.exit(0)
}

// ── Step 2: Remove stale opencorvus binary ──
//
// The overlay embeds the opencorvus sidecar payload at build time via OPENCORVUS_EMBED_PATH.
// If we skip this step, a stale binary from a previous build is reused — the Tauri
// overlay compiles successfully but runs old runtime code, silently
// masking source changes. Always delete the binary first to force a fresh rebuild.
step("Remove stale opencorvus binary")
const serverDistDir = path.join(opencorvus, "dist", serverDistName)
await fs.rm(serverDistDir, { recursive: true, force: true })
console.log(`removed ${serverDistDir}`)

// ── Step 3: Generate OpenCorvus build artifacts ──
//
// SDK generation imports the live OpenCorvus server to obtain its OpenAPI document.
// Generated server modules therefore must already match repository package sources;
// waiting for the later server build is too late because that import happens first.
step("Generate OpenCorvus build artifacts")
await generateOpencorvusGeneratedBuildArtifacts({
  packageRoot: opencorvus,
  repoRoot: repo,
  log: console.log,
})

// ── Step 4: Rebuild SDK ──
//
// SDK regenerates src/gen/ from opencorvus's live OpenAPI spec and src/defaults.ts
// from server-defaults.json. opencorvus imports @opencorvus-ai/sdk, so a stale gen/
// would compile against an out-of-sync API surface — silent type drift, runtime 404s,
// or wrong default host/port. Rebuild SDK before the opencorvus build below.
step("Rebuild SDK")
await $`bun run build`.cwd(sdk)

// ── Step 5: Tauri build ──
step("Tauri build → overlay binary")

console.log("Building opencorvus overlay server first...")
await $`bun run build --overlay-server`.cwd(opencorvus)
if (!(await exists(distServer))) {
  throw new Error(`opencorvus binary still not found at ${distServer}`)
}

// Clean previous build artifacts that may be locked by Windows
const builtOverlay = path.join(release, overlayFile)
try {
  await fs.rm(builtOverlay, { force: true })
} catch {
  // File locked — try rename then delete (Windows file locking workaround)
  const stale = builtOverlay + ".old"
  await fs.rm(stale, { force: true }).catch(() => undefined)
  try {
    await fs.rename(builtOverlay, stale)
    await fs.rm(stale, { force: true }).catch(() => undefined)
  } catch {
    // Last resort: PowerShell force removal
    if (isWindows) {
      console.log("Binary locked, attempting PowerShell removal...")
      await $`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Force -LiteralPath $args[0] -ErrorAction SilentlyContinue" ${builtOverlay}`
        .quiet()
        .nothrow()
    }
  }
}

// Forward --target to cargo only when the operator explicitly requested
// a cross-compile. Host builds skip the flag so cargo writes to
// target/release and reuses the existing fingerprint cache.
const tauriTargetArgs = useExplicitTarget ? ["--target", triple] : []
await $`tauri build --no-bundle ${tauriTargetArgs} ${tauriArgs()}`.cwd(dir).env({
  ...process.env,
  CARGO_TARGET_DIR: target,
  OPENCORVUS_EMBED_PATH: distServerDir,
  PATH: await cargoPath(),
})

if (!(await exists(builtOverlay))) {
  throw new Error(`Overlay binary not found at ${builtOverlay}`)
}

// ── Step 6: Copy to dist/ ──
step("Copy binary to dist/")
if (skipDistCopy) {
  console.log("skipped (--skip-dist-copy); target/release remains the installer input")
} else {
  await fs.mkdir(distRoot, { recursive: true })
  await copyFileForce(builtOverlay, packagedOverlay)
  console.log(`→ ${packagedOverlay}`)
}

// WebView2Loader.dll — only present under the *-pc-windows-gnu target.
// On MSVC, `webview2-com-sys` static-links `WebView2LoaderStatic.lib` and the
// exe has no IAT import for the dll. On GNU, the loader is dynamically imported
// and `tauri-build` copies the dll into target/<triple>/release/. Copy it
// alongside the exe iff cargo produced one — don't fail if absent.
if (isWindows && !skipDistCopy) {
  const dllSrc = path.join(release, "WebView2Loader.dll")
  if (await exists(dllSrc)) {
    const dllDst = path.join(distRoot, "WebView2Loader.dll")
    await copyFileForce(dllSrc, dllDst)
    console.log(`→ ${dllDst}`)
  } else {
    console.log("WebView2Loader.dll not present (statically linked) — skip")
  }
}

console.log("\n✓ Full overlay build complete.")
