import { requireRuntimePackage } from "@/runtime/package-require"

declare const OPENCORVUS_LIBC: string | undefined

export namespace Capability {
  export type State = "ok" | "warn" | "fail"

  export type Item = {
    id: string
    title: string
    state: State
    detail: string
    hint?: string
  }

  export type Report = {
    platform: string
    arch: string
    items: Item[]
    total: {
      ok: number
      warn: number
      fail: number
    }
  }

  let cache: Report | undefined
  let pending: Promise<Report> | undefined

  function line(id: string, title: string, state: State, detail: string, hint?: string): Item {
    return { id, title, state, detail, hint }
  }

  function text(err: unknown) {
    if (err instanceof Error) return err.message
    return String(err)
  }

  function libc() {
    const built = typeof OPENCORVUS_LIBC === "string" ? OPENCORVUS_LIBC : undefined
    return built || process.env.OPENCORVUS_LIBC || "glibc"
  }

  function watcherPkg() {
    const base = `@parcel/watcher-${process.platform}-${process.arch}`
    if (process.platform !== "linux") return base
    return `${base}-${libc()}`
  }

  function watcher() {
    const pkg = watcherPkg()
    try {
      requireRuntimePackage("@parcel/watcher")
      return line("watcher", "File watcher binding", "ok", pkg)
    } catch (err) {
      return line(
        "watcher",
        "File watcher binding",
        "fail",
        `${pkg} not loadable: ${text(err)}`,
        "Reinstall dependencies for this platform, then run typecheck again.",
      )
    }
  }

  async function winFfi() {
    if (process.platform !== "win32") return line("win32_ffi", "Windows console FFI", "ok", "n/a")
    try {
      const ffi = await import("bun:ffi")
      const lib = ffi.dlopen("kernel32.dll", {
        GetStdHandle: { args: ["i32"], returns: "ptr" },
      })
      lib.close()
      return line("win32_ffi", "Windows console FFI", "ok", "kernel32.dll")
    } catch (err) {
      return line(
        "win32_ffi",
        "Windows console FFI",
        "fail",
        text(err),
        "Bun FFI failed to load kernel32.dll. Check runtime and platform compatibility.",
      )
    }
  }
  async function screenCapture() {
    try {
      requireRuntimePackage("node-screenshots")
      return line("screen_capture", "Screen capture module", "ok", "node-screenshots")
    } catch (err) {
      return line(
        "screen_capture",
        "Screen capture module",
        "warn",
        `node-screenshots unavailable: ${text(err)}`,
        "Screen tool will fail. Reinstall dependencies or platform may not be supported.",
      )
    }
  }

  async function gitBash() {
    if (process.platform !== "win32") return line("git_bash", "Git Bash (Windows only)", "ok", "n/a")
    try {
      const { Shell } = await import("@/shell/shell")
      const shellPath = Shell.acceptable()
      const base = shellPath.toLowerCase()
      if (base.endsWith("bash.exe")) {
        return line("git_bash", "Git Bash (Windows)", "ok", shellPath)
      }
      return line(
        "git_bash",
        "Git Bash (Windows)",
        "warn",
        `Falling back to ${shellPath}`,
        "Install Git for Windows to enable full bash/PID-guard support. Without it, cmd.exe is used.",
      )
    } catch (err) {
      return line("git_bash", "Git Bash (Windows)", "warn", text(err))
    }
  }

  async function collectFresh() {
    const checks = [winFfi(), screenCapture(), gitBash(), Promise.resolve(watcher())]
    const nested = await Promise.all(checks)
    const items = nested.flatMap((item) => (Array.isArray(item) ? item : [item]))
    const total = items.reduce(
      (acc, item) => ({
        ok: acc.ok + (item.state === "ok" ? 1 : 0),
        warn: acc.warn + (item.state === "warn" ? 1 : 0),
        fail: acc.fail + (item.state === "fail" ? 1 : 0),
      }),
      { ok: 0, warn: 0, fail: 0 },
    )
    return {
      platform: process.platform,
      arch: process.arch,
      items,
      total,
    } satisfies Report
  }

  export function cached() {
    return cache
  }

  export function cachedItem(id: string) {
    return cache?.items.find((item) => item.id === id)
  }

  export async function preflight(force = false) {
    if (!force && cache) return cache
    if (!force && pending) return pending
    const task = collectFresh().then((report) => {
      cache = report
      return report
    })
    pending = task.finally(() => {
      pending = undefined
    })
    return pending
  }

  export async function collect(force = false) {
    return preflight(force)
  }
}
