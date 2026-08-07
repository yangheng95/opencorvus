import { requireRuntimePackage } from "@/runtime/package-require"
import { Instance } from "@/project/instance"
import { AttachmentStore } from "@/storage/attachment-store"

type WindowInstance = InstanceType<typeof import("node-screenshots").Window>
type WindowClass = typeof import("node-screenshots").Window

function loadWindow(): WindowClass {
  return requireRuntimePackage<typeof import("node-screenshots")>("node-screenshots").Window
}

function text(value: string | undefined) {
  return String(value || "").trim()
}

function visible(win: WindowInstance) {
  return !win.isMinimized() && win.width() > 0 && win.height() > 0
}

function score(win: WindowInstance, match?: string) {
  const title = text(win.title())
  const app = text(win.appName())
  if (!title && !app) return -1

  const query = text(match)
  if (query) {
    const lower = query.toLowerCase()
    if ([title, app].some((item) => item.toLowerCase() === lower)) return 400 + (win.isFocused() ? 10 : 0)
    return [title, app].some((item) => item.toLowerCase().includes(lower)) ? 320 + (win.isFocused() ? 10 : 0) : -1
  }

  if (title === "OpenCorvus") return 300 + (win.isFocused() ? 10 : 0)
  if (title.toLowerCase().startsWith("opencorvus")) return 260 + (win.isFocused() ? 10 : 0)
  if (title.toLowerCase().includes("opencorvus")) return 220 + (win.isFocused() ? 10 : 0)
  if (app.toLowerCase().includes("opencorvus")) return 180 + (win.isFocused() ? 10 : 0)
  return -1
}

function name(value: string) {
  const safe = value
    .replace(/[<>:"/\\|?*\x00-\x1F]+/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return safe || "opencorvus-gui"
}

function listWindows(Window: WindowClass) {
  return Window.all()
    .filter(visible)
    .map((win) => text(win.title()) || text(win.appName()))
    .filter(Boolean)
    .slice(0, 5)
}

export async function captureWindowScreenshot(match?: string) {
  const Window = loadWindow()
  let wins: WindowInstance[]
  try {
    wins = Window.all().filter(visible)
  } catch (error) {
    throw new Error(`Desktop screenshot capture unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }

  const target = wins
    .map((win) => ({ win, score: score(win, match) }))
    .filter((item) => item.score >= 0)
    .sort((a, b) => b.score - a.score || b.win.z() - a.win.z())
    .map((item) => item.win)[0]

  if (!target) {
    const query = text(match)
    const seen = listWindows(Window)
    const scope = query ? ` matching "${query}"` : ""
    const tail = seen.length > 0 ? ` Available windows: ${seen.join(", ")}` : ""
    throw new Error(`No OpenCorvus GUI window found${scope}.${tail}`)
  }

  const png = target.captureImageSync().toPngSync()
  const title = text(target.title()) || text(target.appName()) || "OpenCorvus"
  const ref = await AttachmentStore.write(Instance.project.id, png, "image/png", `${name(title)}.png`)
  return {
    mime: ref.mime,
    filename: ref.filename,
    url: ref.url,
    title,
    app: text(target.appName()),
    width: target.width(),
    height: target.height(),
  }
}
