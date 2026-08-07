#!/usr/bin/env bun

import fs from "fs"
import path from "path"
import { artifactEmbeddedExecutableRelativePaths } from "../packages/opencorvus/script/build-artifact"
import { overlayBundlePatterns } from "./release-asset-contract"

const args = process.argv.slice(2)
const mode = args[0]

if (!mode || !["cli", "overlay"].includes(mode)) {
  throw new Error("Usage: bun ./script/check-release-assets.ts <cli|overlay> ...")
}

function flag(name: string) {
  const idx = args.indexOf(name)
  return idx >= 0 ? args[idx + 1] : undefined
}

function version(name: string) {
  const value = flag(name)?.trim()
  if (!value) return undefined
  return value.replace(/^v(?=\d)/, "")
}

function exists(p: string) {
  return fs.existsSync(p)
}

function list(dir: string) {
  return exists(dir) ? fs.readdirSync(dir) : []
}

function requireFile(file: string) {
  if (!exists(file)) {
    throw new Error(`Missing required file: ${file}`)
  }
}

function requireMatchingFile(dir: string, pattern: RegExp, label: string) {
  const files = list(dir)
  if (!files.some((file) => pattern.test(file))) {
    throw new Error(`Missing ${label} in ${dir}. Found: ${files.join(", ") || "none"}`)
  }
}

function overlayExecutablePattern(platform: string): RegExp {
  if (platform.startsWith("windows")) return /^opencorvus-overlay\.exe$/
  if (platform.startsWith("darwin") || platform.startsWith("linux")) return /^opencorvus-overlay$/
  throw new Error(`Unsupported overlay platform: ${platform}`)
}

// Walk dir recursively and return every file path relative to it, in
// posix-separator form. Used by ui/ asset checks since Vite emits
// hashed filenames under chunk-specific subpaths and the validator
// previously hardcoded `app.js` / `styles.css` (a stale assumption from
// when the panel was a single hand-written bundle).
function walk(dir: string, base: string = dir): string[] {
  if (!exists(dir)) return []
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      out.push(...walk(full, base))
    } else if (entry.isFile()) {
      out.push(path.relative(base, full).replaceAll("\\", "/"))
    }
  }
  return out
}

function requireUiBundle(uiRoot: string) {
  requireFile(path.join(uiRoot, "index.html"))
  const all = walk(uiRoot)
  if (!all.some((f) => f.endsWith(".js"))) {
    throw new Error(`Missing UI script (.js) under ${uiRoot}. Found: ${all.join(", ") || "none"}`)
  }
  if (!all.some((f) => f.endsWith(".css"))) {
    throw new Error(`Missing UI stylesheet (.css) under ${uiRoot}. Found: ${all.join(", ") || "none"}`)
  }
}

if (mode === "cli") {
  const dir = path.resolve(flag("--dir") || "")
  const rawPlatforms = flag("--platforms")
  const current = version("--version")
  const requireArchives = args.includes("--require-archives")
  if (!dir || !rawPlatforms) {
    throw new Error("cli mode requires --dir and --platforms")
  }
  const platforms = rawPlatforms
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  for (const platform of platforms) {
    const root = path.join(dir, `opencorvus-${platform}`)
    const ui = path.join(root, "ui")
    if (!exists(root)) throw new Error(`Missing CLI platform directory: ${root}`)
    for (const executable of artifactEmbeddedExecutableRelativePaths(platform)) requireFile(path.join(root, executable))
    requireFile(path.join(root, "licenses", "OfficeCLI-LICENSE"))
    requireFile(path.join(root, "licenses", "OfficeCLI-RUNTIME-LOCK.json"))
    requireFile(path.join(root, "browser-mcp-node", "browser.mjs"))
    requireFile(path.join(root, "browser-mcp-node", "node_modules", "playwright", "package.json"))
    requireUiBundle(ui)
    if (requireArchives) {
      const archive = path.join(dir, `opencorvus-${platform}.tar.gz`)
      requireFile(archive)
    }
  }
  console.log(`CLI assets validated for ${platforms.join(", ")}`)
  process.exit(0)
}

const dir = path.resolve(flag("--dir") || "")
const platform = flag("--platform")
const current = version("--version")
const requireBundle = args.includes("--require-bundle")
if (!dir || !platform || !current) {
  throw new Error("overlay mode requires --dir, --platform and --version")
}

requireMatchingFile(dir, overlayExecutablePattern(platform), `${platform} overlay binary`)

// build-overlay.ts runs `tauri build --no-bundle`, so per-platform
// installer bundles (deb/rpm/AppImage on Linux, dmg on macOS, msi/nsis on
// Windows) are NOT produced for dev snapshot runs. Release workflow uses
// overlay/script/build.ts, which must keep producing bundles because it opts
// in to this validator with `--require-bundle`.
if (requireBundle) {
  for (const { pattern, label } of overlayBundlePatterns(platform, current)) {
    requireMatchingFile(dir, pattern, label)
  }
}

console.log(`Overlay assets validated for ${platform}`)
