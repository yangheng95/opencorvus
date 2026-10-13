import { Hono, type Context } from "hono"
import { createHash } from "node:crypto"
import path from "path"
import fs from "fs"
import { EMBEDDED_OVERLAY_UI } from "./overlay-ui-embedded.generated"

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
      readResource: (path: string) => Blob | undefined
    }
  | {
      kind: "embedded"
      indexHtml: string
      assetRefs: readonly string[]
      identity: string
      indexSHA256: string
      assetClosureSHA256: string
      assetCount: number
      readResource: (path: string) => Blob | undefined
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

/** Capture bytes once; only immutable Blobs escape the capture boundary. */
function freezeResourceBytes(files: ReadonlyMap<string, Buffer>) {
  const index = files.get("index.html")
  if (!index) throw new Error("Overlay UI source is missing index.html")
  const indexHtml = index.toString("utf8")
  const resources = new Map<string, Blob>()
  const closure: string[] = []
  for (const [relativePath, bytes] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    const type = MIME[path.extname(relativePath).toLowerCase()] || "application/octet-stream"
    resources.set(`/${relativePath}`, new Blob([bytes], { type }))
    closure.push(`${relativePath}\0${bytes.byteLength}\0${sha256(bytes)}`)
  }
  return {
    indexHtml,
    indexSHA256: sha256(index),
    assetRefs: Object.freeze(overlayUiAssetRefs(indexHtml)),
    assetClosureSHA256: sha256(closure.join("\n")),
    assetCount: resources.size,
    readResource: (resourcePath: string) => resources.get(resourcePath),
  }
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
  // Workers, dynamic imports, fonts and other late requests need the same
  // ownership as the entry point, including when no build manifest is supplied.
  collectDirectoryFiles(directory, directory, files)
  const bytes = new Map([...files].map(([relative, absolute]) => [relative, fs.readFileSync(absolute)]))
  const requireResource = (relativePath: string): Buffer => {
    const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "")
    if (!normalized || normalized.split("/").includes("..")) {
      throw new Error(`Overlay UI resource path is invalid: ${relativePath}`)
    }
    const content = bytes.get(normalized)
    if (!content) throw new Error(`Overlay UI resource is missing from its captured directory: ${relativePath}`)
    return content
  }
  for (const resource of localDocumentResourceRefs(requireResource("index.html").toString("utf8"))) {
    requireResource(decodeURIComponent(resource))
  }

  let manifestSHA256: string | undefined
  if (input.manifestPath) {
    const manifestCandidate = path.isAbsolute(input.manifestPath)
      ? path.resolve(input.manifestPath)
      : path.resolve(directory, input.manifestPath)
    if (!isInsideDirectory(directory, manifestCandidate)) {
      throw new Error(`Overlay UI manifest escapes its frozen directory: ${input.manifestPath}`)
    }
    const manifestBytes = requireResource(path.relative(directory, manifestCandidate))
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
        requireResource(resource)
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
  }

  const captured = freezeResourceBytes(bytes)
  return Object.freeze({
    kind: "directory" as const,
    directory,
    ...captured,
    identity: `directory:${captured.assetClosureSHA256}`,
    ...(manifestSHA256 ? { manifestSHA256 } : {}),
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
  if (!EMBEDDED_OVERLAY_UI.some((entry) => entry.path === "/index.html")) {
    return Object.freeze({ kind: "missing" as const, identity: "missing" as const })
  }
  const captured = freezeResourceBytes(new Map(EMBEDDED_OVERLAY_UI.map((entry) => [entry.path.replace(/^\//, ""), fs.readFileSync(entry.file)])))
  return Object.freeze({
    kind: "embedded" as const,
    ...captured,
    identity: `embedded:${captured.assetClosureSHA256}`,
  })
}

function normalizeOverlayReqPath(reqPath: string): string | null {
  try {
    reqPath = decodeURIComponent(reqPath)
  } catch {
    return null
  }
  if (reqPath.includes("\0") || reqPath.includes("\\")) return null
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
   * The caller freezes the complete source before route registration. A
   * running server reads only immutable resources owned by that source.
   */
  export function routes(source: FrozenOverlayUiSource) {
    const app = new Hono()

    // Vite builds can use absolute or relative asset paths.
    // Prefer proxy-prefix absolute paths when the proxy reports one;
    // otherwise emit paths relative to the current `/ui/...` document
    // so `/opencorvus/ui/` works even when the proxy strips the prefix
    // without sending `X-Forwarded-Prefix`.
    const rewriteHtmlAssets = (c: Context, html: string): string =>
      html.replace(/(src|href)=(["'])(?:\.?\/)?(assets|i18n)\//g, `$1=$2${overlayPublicBase(c)}/$3/`)

    const handle = async (c: Context) => {
      if (c.req.path.endsWith("/ui")) {
        return c.redirect("ui/", 308)
      }

      if (source.kind === "missing") {
        return c.text(
          "Overlay UI not found. Run `bun run --cwd packages/overlay build:vite` or package with bundled UI assets.",
          404,
        )
      }

      const requested = normalizeOverlayReqPath(c.req.path.replace(/^\/ui/, "") || "/")
      if (requested === null) return c.text("Forbidden", 403)
      const resource = source.readResource(requested) ??
        (isOverlayStaticRequest(requested) ? undefined : source.readResource("/index.html"))
      if (!resource) return c.text("Not Found", 404)
      const body = resource.type.startsWith("text/html")
        ? rewriteHtmlAssets(c, await resource.text())
        : resource.stream()
      return c.body(body, 200, {
        "Content-Type": resource.type,
        "Cache-Control": "no-cache",
        ...overlayUiFingerprintHeaders(source),
      })
    }

    app.get("/", handle)
    app.get("/*", handle)

    return app
  }
}
