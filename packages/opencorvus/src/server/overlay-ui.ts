import { Hono, type Context } from "hono"
import { createHash } from "node:crypto"
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
export const OVERLAY_UI_IDENTITY_HEADER = "X-Opencorvus-Overlay-Ui-Identity"

type OverlayUiConcreteSource = "directory" | "embedded"

export function overlayUiAssetRefs(html: string): string[] {
  return Array.from(
    new Set(
      Array.from(html.matchAll(/\b(?:src|href)=["'](?:\.?\/)?(assets\/[^"']+\.(?:js|css))["']/g), (match) => match[1]),
    ),
  ).sort()
}

export type FrozenOverlayUiSource = Readonly<
  | {
      kind: "directory"
      directory: string
      indexHtml: string
      assetRefs: readonly string[]
      identity: string
      indexSHA256: string
      manifestSHA256?: string
      assetClosureSHA256: string
      assetCount: number
    }
  | {
      kind: "embedded"
      indexHtml: string
      assetRefs: readonly string[]
      identity: string
      indexSHA256: string
      assetClosureSHA256: string
      assetCount: number
    }
  | {
      kind: "missing"
      identity: "missing"
    }
>

function overlayUiFingerprintHeaders(
  source: Extract<FrozenOverlayUiSource, { kind: OverlayUiConcreteSource }>,
): Record<string, string> {
  return {
    [OVERLAY_UI_SOURCE_HEADER]: source.kind,
    [OVERLAY_UI_ASSETS_HEADER]: source.assetRefs.join(","),
    [OVERLAY_UI_IDENTITY_HEADER]: source.identity,
  }
}

function sha256(value: string | Uint8Array): string {
  return createHash("sha256").update(value).digest("hex")
}

function resolveDefaultOverlayDir(): string | undefined {
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

function isInsideDirectory(root: string, candidate: string): boolean {
  const rootWithSeparator = root.endsWith(path.sep) ? root : root + path.sep
  return candidate === root || candidate.startsWith(rootWithSeparator)
}

function localDocumentResourceRefs(html: string): string[] {
  const refs = Array.from(html.matchAll(/\b(?:src|href)=["']([^"']+)["']/g), (match) => match[1])
  return Array.from(
    new Set(
      refs
        .map((value) => value.split(/[?#]/, 1)[0] ?? "")
        .filter((value) => value && !value.startsWith("#") && !/^(?:[a-z]+:|\/\/)/i.test(value))
        .map((value) => value.replace(/^\.?\//, "")),
    ),
  ).sort()
}

function regularFileWithin(root: string, relativePath: string): { absolutePath: string; relativePath: string } {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
  if (!normalized || normalized.split("/").includes("..")) {
    throw new Error(`Overlay UI resource path is invalid: ${relativePath}`)
  }
  const candidate = path.resolve(root, normalized)
  if (!isInsideDirectory(root, candidate)) {
    throw new Error(`Overlay UI resource escapes its frozen directory: ${relativePath}`)
  }
  const realCandidate = fs.realpathSync(candidate)
  if (!isInsideDirectory(root, realCandidate)) {
    throw new Error(`Overlay UI resource resolves outside its frozen directory: ${relativePath}`)
  }
  if (!fs.statSync(realCandidate).isFile()) {
    throw new Error(`Overlay UI resource must be a regular file: ${relativePath}`)
  }
  return { absolutePath: realCandidate, relativePath: path.relative(root, realCandidate).replace(/\\/g, "/") }
}

function collectDirectoryFiles(root: string, directory: string, files: Map<string, string>): void {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    const realEntry = fs.realpathSync(entryPath)
    if (!isInsideDirectory(root, realEntry)) {
      throw new Error(`Overlay UI static resource resolves outside its frozen directory: ${entryPath}`)
    }
    if (entry.isDirectory()) {
      collectDirectoryFiles(root, realEntry, files)
      continue
    }
    if (!entry.isFile()) throw new Error(`Overlay UI static resource must be a regular file: ${entryPath}`)
    files.set(path.relative(root, realEntry).replace(/\\/g, "/"), realEntry)
  }
}

type ViteManifestEntry = {
  file?: unknown
  css?: unknown
  assets?: unknown
  imports?: unknown
  dynamicImports?: unknown
}

export function freezeOverlayUiDirectory(input: {
  directory: string
  manifestPath?: string
  requiredStaticDirectories?: readonly string[]
}): Extract<FrozenOverlayUiSource, { kind: "directory" }> {
  const directory = fs.realpathSync(path.resolve(input.directory))
  if (!fs.statSync(directory).isDirectory()) throw new Error(`Overlay UI source is not a directory: ${directory}`)

  const files = new Map<string, string>()
  const index = regularFileWithin(directory, "index.html")
  files.set(index.relativePath, index.absolutePath)
  const indexHtml = fs.readFileSync(index.absolutePath, "utf8")
  for (const resource of localDocumentResourceRefs(indexHtml)) {
    const file = regularFileWithin(directory, resource)
    files.set(file.relativePath, file.absolutePath)
  }

  let manifestSHA256: string | undefined
  if (input.manifestPath) {
    const manifestCandidate = path.isAbsolute(input.manifestPath)
      ? path.resolve(input.manifestPath)
      : path.resolve(directory, input.manifestPath)
    if (!isInsideDirectory(directory, manifestCandidate)) {
      throw new Error(`Overlay UI manifest escapes its frozen directory: ${input.manifestPath}`)
    }
    const manifestFile = regularFileWithin(directory, path.relative(directory, manifestCandidate))
    files.set(manifestFile.relativePath, manifestFile.absolutePath)
    const manifestBytes = fs.readFileSync(manifestFile.absolutePath)
    manifestSHA256 = sha256(manifestBytes)
    const manifest = JSON.parse(manifestBytes.toString("utf8")) as Record<string, ViteManifestEntry>
    const manifestKeys = new Set(Object.keys(manifest))
    for (const [key, entry] of Object.entries(manifest)) {
      if (!entry || typeof entry !== "object") throw new Error(`Overlay UI manifest entry is invalid: ${key}`)
      for (const dependencyKey of [...arrayStrings(entry.imports), ...arrayStrings(entry.dynamicImports)]) {
        if (!manifestKeys.has(dependencyKey)) {
          throw new Error(`Overlay UI manifest entry ${key} references missing chunk ${dependencyKey}`)
        }
      }
      for (const resource of [entry.file, ...arrayStrings(entry.css), ...arrayStrings(entry.assets)]) {
        if (typeof resource !== "string" || !resource.trim()) {
          throw new Error(`Overlay UI manifest entry ${key} has an invalid resource`)
        }
        const file = regularFileWithin(directory, resource)
        files.set(file.relativePath, file.absolutePath)
      }
    }
  }

  for (const requiredDirectory of input.requiredStaticDirectories ?? []) {
    const normalized = requiredDirectory.replace(/\\/g, "/").replace(/^\/+/, "")
    if (!normalized || normalized.split("/").includes("..")) {
      throw new Error(`Overlay UI static directory path is invalid: ${requiredDirectory}`)
    }
    const staticDirectory = fs.realpathSync(path.resolve(directory, normalized))
    if (!isInsideDirectory(directory, staticDirectory) || !fs.statSync(staticDirectory).isDirectory()) {
      throw new Error(`Overlay UI static directory is invalid: ${requiredDirectory}`)
    }
    collectDirectoryFiles(directory, staticDirectory, files)
  }

  const closure = Array.from(files.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([relativePath, absolutePath]) =>
        `${relativePath}\0${fs.statSync(absolutePath).size}\0${sha256(fs.readFileSync(absolutePath))}`,
    )
    .join("\n")
  const indexSHA256 = sha256(indexHtml)
  const assetClosureSHA256 = sha256(closure)
  return Object.freeze({
    kind: "directory" as const,
    directory,
    indexHtml,
    assetRefs: Object.freeze(overlayUiAssetRefs(indexHtml)),
    identity: `directory:${assetClosureSHA256}`,
    indexSHA256,
    ...(manifestSHA256 ? { manifestSHA256 } : {}),
    assetClosureSHA256,
    assetCount: files.size,
  })
}

function arrayStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  if (!value.every((entry) => typeof entry === "string" && entry.trim())) {
    throw new Error("Overlay UI manifest string array is invalid")
  }
  return value
}

export function freezeDefaultOverlayUiSource(): FrozenOverlayUiSource {
  const directory = resolveDefaultOverlayDir()
  if (directory) return freezeOverlayUiDirectory({ directory })
  const index = EMBEDDED_OVERLAY_UI_BY_PATH.get("/index.html")
  if (!index) return Object.freeze({ kind: "missing" as const, identity: "missing" as const })
  const indexHtml = fs.readFileSync(index.file, "utf8")
  const assetRefs = Object.freeze(overlayUiAssetRefs(indexHtml))
  const indexSHA256 = sha256(indexHtml)
  const assetClosureSHA256 = sha256(
    EMBEDDED_OVERLAY_UI.map((entry) => `${entry.path}\0${sha256(fs.readFileSync(entry.file))}`)
      .sort()
      .join("\n"),
  )
  return Object.freeze({
    kind: "embedded" as const,
    indexHtml,
    assetRefs,
    identity: `embedded:${assetClosureSHA256}`,
    indexSHA256,
    assetClosureSHA256,
    assetCount: EMBEDDED_OVERLAY_UI.length,
  })
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
   * The caller freezes the complete source before route registration. A
   * running server therefore never re-resolves a mutable shared build path.
   */
  export function routes(source: FrozenOverlayUiSource) {
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
          ...overlayUiFingerprintHeaders(source as Extract<FrozenOverlayUiSource, { kind: "embedded" }>),
        })
      }
      return c.body(await file.arrayBuffer(), 200, {
        "Content-Type": contentType,
        "Cache-Control": "no-cache",
        ...overlayUiFingerprintHeaders(source as Extract<FrozenOverlayUiSource, { kind: "embedded" }>),
      })
    }

    const handle = async (c: Context) => {
      if (c.req.path.endsWith("/ui")) {
        return c.redirect("ui/", 308)
      }

      if (source.kind === "embedded") {
        return serveEmbedded(c)
      }

      if (source.kind === "missing") {
        return c.text(
          "Overlay UI not found. Run `bun run --cwd packages/overlay build:vite` or package with bundled UI assets.",
          404,
        )
      }

      const dir = source.directory
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
          const indexHtml = source.indexHtml
          return c.body(rewriteHtmlAssets(c, indexHtml), 200, {
            "Content-Type": "text/html; charset=utf-8",
            ...overlayUiFingerprintHeaders(source),
          })
        }
        const ext = path.extname(filePath)
        const contentType = MIME[ext] || "application/octet-stream"
        if (ext === ".html") {
          const html = await file.text()
          return c.body(rewriteHtmlAssets(c, html), 200, {
            "Content-Type": contentType,
            "Cache-Control": "no-cache",
            ...overlayUiFingerprintHeaders(source),
          })
        }
        return c.body(await file.arrayBuffer(), 200, {
          "Content-Type": contentType,
          "Cache-Control": "no-cache",
          ...overlayUiFingerprintHeaders(source),
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
