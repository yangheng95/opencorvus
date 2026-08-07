import { Hono, type Context } from "hono"
import path from "path"
import fs from "fs"
import fsp from "fs/promises"
import { EMBEDDED_OVERLAY_UI, type EmbeddedOverlayUiFile } from "./overlay-ui-embedded.generated"

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".json": "application/json",
}

export const OVERLAY_UI_SOURCE_HEADER = "X-Opencorvus-Overlay-Ui-Source"
export const OVERLAY_UI_ASSETS_HEADER = "X-Opencorvus-Overlay-Ui-Assets"

type OverlayUiConcreteSource = "directory" | "embedded"

export function overlayUiAssetRefs(html: string): string[] {
  return Array.from(
    new Set(
      Array.from(html.matchAll(/\b(?:src|href)=["'](?:\.?\/)?(assets\/[^"']+\.(?:js|css))["']/g), (match) => match[1]),
    ),
  ).sort()
}

function overlayUiFingerprintHeaders(source: OverlayUiConcreteSource, html: string): Record<string, string> {
  return {
    [OVERLAY_UI_SOURCE_HEADER]: source,
    [OVERLAY_UI_ASSETS_HEADER]: overlayUiAssetRefs(html).join(","),
  }
}

function resolveOverlayDir(): string | undefined {
  // 1. Compiled binary: look for ui/ next to the executable
  const binDir = path.dirname(process.execPath)
  const distUi = path.join(binDir, "ui")
  if (fs.existsSync(path.join(distUi, "index.html"))) return distUi

  // import.meta.dir = .../packages/opencorvus/src/server
  const pkgRoot = import.meta.dir.replace(/[/\\]src[/\\]server$/, "")

  // 2. Workspace bundle: keep runtime and packaged acceptance on the same built UI.
  const viteUi = path.resolve(pkgRoot, "../overlay/dist-vite")
  if (fs.existsSync(path.join(viteUi, "index.html"))) return viteUi

  return undefined
}

const EMBEDDED_OVERLAY_UI_BY_PATH = new Map<string, EmbeddedOverlayUiFile>(
  EMBEDDED_OVERLAY_UI.map((file) => [file.path, file]),
)

function hasEmbeddedOverlayUi(): boolean {
  return EMBEDDED_OVERLAY_UI_BY_PATH.has("/index.html")
}

export type OverlayUiServingSource = { kind: "directory"; dir: string } | { kind: "embedded" } | { kind: "missing" }

export interface OverlayUiServingSourceInput {
  dirOverride?: string
  resolvedDir?: string
  embeddedAvailable: boolean
}

export function selectOverlayUiServingSource(input: OverlayUiServingSourceInput): OverlayUiServingSource {
  if (input.dirOverride) return { kind: "directory", dir: input.dirOverride }
  if (input.resolvedDir) return { kind: "directory", dir: input.resolvedDir }
  if (input.embeddedAvailable) return { kind: "embedded" }
  return { kind: "missing" }
}

function normalizeOverlayReqPath(reqPath: string): string | null {
  if (reqPath.includes("\0")) return null
  const normalized = reqPath === "/" ? "/index.html" : reqPath
  if (normalized.split("/").includes("..")) return null
  return normalized
}

function normalizePublicPrefix(prefix: string | undefined): string {
  const firstPrefix = prefix?.split(",")[0]?.trim()
  if (!firstPrefix || firstPrefix === "/") return ""
  if (/[<>"'\0]/.test(firstPrefix)) return ""
  const withLeadingSlash = firstPrefix.startsWith("/") ? firstPrefix : `/${firstPrefix}`
  return withLeadingSlash.replace(/\/+/g, "/").replace(/\/$/, "")
}

function overlayRelativeBase(reqPath: string): string {
  const suffix = reqPath.replace(/^\/ui\/?/, "")
  if (!suffix || suffix === "index.html") return "."

  const parts = suffix.split("/").filter(Boolean)
  const directoryDepth = reqPath.endsWith("/") ? parts.length : Math.max(0, parts.length - 1)
  return directoryDepth === 0 ? "." : Array.from({ length: directoryDepth }, () => "..").join("/")
}

function isOverlayStaticRequest(reqPath: string): boolean {
  return reqPath.startsWith("/assets/") || reqPath.startsWith("/i18n/")
}

function overlayPublicBase(c: Context): string {
  const prefix = normalizePublicPrefix(c.req.header("x-forwarded-prefix"))
  if (prefix) return `${prefix}/ui`
  return overlayRelativeBase(c.req.path)
}

export namespace OverlayUI {
  /**
   * Validate that a `/ui/...` request path stays inside the overlay
   * dir. Returns the absolute filesystem path on success, or null
   * when the request must be rejected with 403.
   *
   * Defends against:
   *  - audit-2026-04-29 opencorvus F7 — `..` traversal (literal or
   *    URL-encoded `%2e%2e/`). path.resolve normalises both, then a
   *    `${dir}${sep}` prefix compare blocks sibling-dir leakage
   *    (e.g. `/foo/ui-private/secret` no longer satisfies a naive
   *    `startsWith("/foo/ui")`).
   *  - audit-2026-04-29 opencorvus V6.a — NUL byte poisoning.
   *    Bun.file / Node fs treat the NUL terminator inconsistently;
   *    `path.resolve(dir, "./index.html\0/etc/passwd")` may serve
   *    either depending on libc. Reject up-front rather than picking
   *    a side.
   *  - audit-2026-04-29 opencorvus V6.b — symlink escape. Once the
   *    resolved path is inside dir, a malicious symlink at that path
   *    pointing outside (e.g. planted by a tampered VSIX or a
   *    misconfigured dev tree) would still leak the target's bytes
   *    via Bun.file's transparent follow. realpath comparison closes
   *    the gap; for non-existent paths we let the handler fall
   *    through to its SPA index.html fallback (no escape there
   *    because we re-validate inside the resolved dir).
   *
   * Note: input `reqPath` is already URL-decoded by Hono's parser
   * (so `%2e%2e/` arrives as `../`, `%00` arrives as `\0`).
   */
  export async function validatePath(dir: string, reqPath: string): Promise<string | null> {
    if (reqPath.includes("\0")) return null
    const resolved = path.resolve(dir, "." + reqPath)
    const dirWithSep = dir.endsWith(path.sep) ? dir : dir + path.sep
    if (resolved !== dir && !resolved.startsWith(dirWithSep)) return null
    // realpath throws ENOENT on non-existent paths; the SPA fallback
    // handler handles that case downstream by serving index.html.
    // For any OTHER error (EACCES on a hostile symlink target,
    // ELOOP on a cycle), fail closed — refuse the request.
    try {
      const realFile = await fsp.realpath(resolved)
      const realDir = await fsp.realpath(dir)
      const realDirWithSep = realDir.endsWith(path.sep) ? realDir : realDir + path.sep
      if (realFile !== realDir && !realFile.startsWith(realDirWithSep)) return null
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      if (code !== "ENOENT" && code !== "ENOTDIR") return null
    }
    return resolved
  }

  /**
   * `dirOverride` is a test-only seam — production callers pass no
   * argument and resolveOverlayDir's exec-path probing kicks in.
   * Tests can supply a fixture dir without monkey-patching
   * `process.execPath` (CLAUDE.md §五-23: prefer fixing tools over
   * fragile mocks).
   */
  export function routes(dirOverride?: string) {
    const app = new Hono()

    // Vite builds HTML with absolute asset paths (e.g. `/assets/...`).
    // Prefer proxy-prefix absolute paths when the proxy reports one;
    // otherwise emit paths relative to the current `/ui/...` document
    // so `/opencorvus/ui/` works even when the proxy strips the prefix
    // without sending `X-Forwarded-Prefix`.
    const rewriteHtmlAssets = (c: Context, html: string): string =>
      html.replace(/(src|href)="\/(assets|i18n)\//g, `$1="${overlayPublicBase(c)}/$2/`)

    const serveEmbedded = async (c: Context) => {
      const requested = normalizeOverlayReqPath(c.req.path.replace(/^\/ui/, "") || "/")
      if (requested === null) return c.text("Forbidden", 403)

      const entry =
        EMBEDDED_OVERLAY_UI_BY_PATH.get(requested) ??
        (isOverlayStaticRequest(requested) ? undefined : EMBEDDED_OVERLAY_UI_BY_PATH.get("/index.html"))
      if (!entry) return c.text("Not Found", 404)

      const ext = path.extname(entry.path)
      const contentType = MIME[ext] || "application/octet-stream"
      const file = Bun.file(entry.file)
      if (ext === ".html") {
        const html = await file.text()
        return c.body(rewriteHtmlAssets(c, html), 200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          ...overlayUiFingerprintHeaders("embedded", html),
        })
      }
      return c.body(await file.arrayBuffer(), 200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
      })
    }

    const handle = async (c: Context) => {
      if (c.req.path.endsWith("/ui")) {
        return c.redirect("ui/", 308)
      }

      const source = selectOverlayUiServingSource({
        dirOverride,
        resolvedDir: dirOverride ? undefined : resolveOverlayDir(),
        embeddedAvailable: hasEmbeddedOverlayUi(),
      })

      if (source.kind === "embedded") {
        return serveEmbedded(c)
      }

      if (source.kind === "missing") {
        return c.text(
          "Overlay UI not found. Run `bun run --cwd packages/overlay build:vite` or package with bundled UI assets.",
          404,
        )
      }

      const dir = source.dir
      let reqPath = c.req.path.replace(/^\/ui/, "") || "/"
      if (reqPath === "/") reqPath = "/index.html"

      const filePath = await validatePath(dir, reqPath)
      if (filePath === null) {
        return c.text("Forbidden", 403)
      }

      try {
        const file = Bun.file(filePath)
        if (!(await file.exists())) {
          if (isOverlayStaticRequest(reqPath)) {
            return c.text("Not Found", 404)
          }
          // SPA fallback — always serves the (rewritten) index.html
          const indexHtml = await Bun.file(path.join(dir, "index.html")).text()
          return c.body(rewriteHtmlAssets(c, indexHtml), 200, {
            "Content-Type": "text/html; charset=utf-8",
            ...overlayUiFingerprintHeaders("directory", indexHtml),
          })
        }
        const ext = path.extname(filePath)
        const contentType = MIME[ext] || "application/octet-stream"
        if (ext === ".html") {
          const html = await file.text()
          return c.body(rewriteHtmlAssets(c, html), 200, {
            "Content-Type": contentType,
            "Cache-Control": "no-cache",
            ...overlayUiFingerprintHeaders("directory", html),
          })
        }
        return c.body(await file.arrayBuffer(), 200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
        })
      } catch {
        return c.text("Not Found", 404)
      }
    }

    app.get("/", handle)
    app.get("/*", handle)

    return app
  }
}
