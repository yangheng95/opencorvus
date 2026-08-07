import { spawn } from "node:child_process"
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs"
import { readFile } from "node:fs/promises"
import { join, sep } from "node:path"
import { tmpdir } from "node:os"
import { fileURLToPath, pathToFileURL } from "node:url"

const overlayBuildDist = new URL("../dist-vite/", import.meta.url)
export let overlayDist = overlayBuildDist
const overlayPackageDir = fileURLToPath(new URL("..", import.meta.url))
let overlayDistSnapshotRoot: string | null = null
let overlayDistSnapshotReady = false

export const overlayAssetTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
}

const buildLockDir = join(tmpdir(), "opencorvus-overlay-dist-build-lock")
const buildLockHeartbeat = join(buildLockDir, "heartbeat")
const STALE_BUILD_LOCK_MS = 120_000
const sourceRoots = [
  new URL("../src/", import.meta.url),
  new URL("../script/", import.meta.url),
  new URL("../index.html", import.meta.url),
  new URL("../package.json", import.meta.url),
  new URL("../src-tauri/tauri.conf.json", import.meta.url),
  new URL("../vite.config.ts", import.meta.url),
]

async function acquireBuildLock() {
  while (true) {
    try {
      mkdirSync(buildLockDir)
      writeFileSync(buildLockHeartbeat, `${Date.now()}\n`)
      return
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | undefined)?.code
      if (code !== "EEXIST") throw error
      try {
        const lockStat = existsSync(buildLockHeartbeat) ? statSync(buildLockHeartbeat) : statSync(buildLockDir)
        const age = Date.now() - lockStat.mtimeMs
        if (age > STALE_BUILD_LOCK_MS) {
          rmSync(buildLockDir, { recursive: true, force: true })
          continue
        }
      } catch {
        rmSync(buildLockDir, { recursive: true, force: true })
        continue
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
}

function releaseBuildLock() {
  rmSync(buildLockDir, { recursive: true, force: true })
}

function distReady() {
  return (
    existsSync(new URL("index.html", overlayBuildDist)) &&
    existsSync(new URL("assets", overlayBuildDist)) &&
    existsSync(new URL("i18n", overlayBuildDist))
  )
}

function newestSourceMtimeMs(root: URL): number {
  if (!existsSync(root)) return 0
  const stat = statSync(root)
  if (!stat.isDirectory()) return stat.mtimeMs
  let newest = stat.mtimeMs
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const child = new URL(entry.name + (entry.isDirectory() ? "/" : ""), root)
    const mtime = entry.isDirectory() ? newestSourceMtimeMs(child) : statSync(child).mtimeMs
    if (mtime > newest) newest = mtime
  }
  return newest
}

function distFresh() {
  if (!distReady()) return false
  const distMtime = statSync(new URL("index.html", overlayBuildDist)).mtimeMs
  const sourceMtime = Math.max(...sourceRoots.map(newestSourceMtimeMs))
  return distMtime >= sourceMtime
}

function materializeOverlayDistSnapshot() {
  overlayDistSnapshotRoot = mkdtempSync(join(tmpdir(), "opencorvus-overlay-dist-"))
  cpSync(overlayBuildDist, overlayDistSnapshotRoot, { recursive: true })
  overlayDist = pathToFileURL(`${overlayDistSnapshotRoot}${sep}`)
  overlayDistSnapshotReady = true
}

process.once("exit", () => {
  if (overlayDistSnapshotRoot) rmSync(overlayDistSnapshotRoot, { recursive: true, force: true })
})

export async function ensureOverlayDist() {
  if (overlayDistSnapshotReady) return
  await acquireBuildLock()
  const heartbeat = setInterval(
    () => {
      writeFileSync(buildLockHeartbeat, `${Date.now()}\n`)
    },
    Math.floor(STALE_BUILD_LOCK_MS / 4),
  )
  try {
    if (!distFresh()) {
      const command = process.platform === "win32" ? (process.env.ComSpec ?? "cmd.exe") : "bun"
      const args = process.platform === "win32" ? ["/d", "/s", "/c", "bun", "run", "build:vite"] : ["run", "build:vite"]
      const proc = spawn(command, args, {
        cwd: overlayPackageDir,
        stdio: "inherit",
        windowsHide: true,
      })
      const code = await new Promise<number | null>((resolve, reject) => {
        proc.once("error", reject)
        proc.once("exit", (exitCode) => resolve(exitCode))
      })
      if (code !== 0) throw new Error(`overlay build:vite failed with exit code ${code}`)
    }
    materializeOverlayDistSnapshot()
  } finally {
    clearInterval(heartbeat)
    releaseBuildLock()
  }
}

export async function overlayStaticResponse(pathname: string): Promise<Response | null> {
  let name: string | null = null
  if (pathname === "/ui" || pathname === "/ui/") {
    return null
  }
  if (pathname.startsWith("/ui/")) {
    name = decodeURIComponent(pathname.slice(4)) || "index.html"
  } else if (pathname.startsWith("/assets/") || pathname.startsWith("/i18n/")) {
    name = decodeURIComponent(pathname.slice(1))
  }
  if (!name) return null
  if (name.includes("..")) return new Response("forbidden", { status: 403 })
  const file = new URL(name, overlayDist)
  if (!existsSync(file)) return new Response("not found", { status: 404 })
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : ""
  return new Response(await readFile(file), {
    headers: { "content-type": overlayAssetTypes[ext] || "application/octet-stream" },
  })
}
