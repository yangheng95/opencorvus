import fs from "node:fs"
import path from "node:path"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const SOURCE_ROOT = path.join(OVERLAY_ROOT, "src")
const ENTRY_DOCUMENTS = ["index.html", "native-menu.html"]
const GLOBAL_TOKEN_ROOTS = [
  path.join(SOURCE_ROOT, "styles", "tokens"),
  path.join(SOURCE_ROOT, "styles", "cascade"),
]
// These namespaces are the public design language. A surface-local declaration
// must never revive one of them as an alias because that would make only one
// selector subtree look correct while the same token remains invalid elsewhere.
const CANONICAL_TOKEN_NAMESPACE =
  /^--(?:oc-(?:radius|density|border-width|duration|ease|focus-ring|icon-size|header-gap|font|shadow)|ui-(?:font|gap|line-height|btn|list|control|header|row|state|duration|ease)|text-|surface-|divider|border(?:-|$)|accent(?:-|$)|bad(?:-|$)|good(?:-|$)|warn(?:-|$)|font$|mono$|shadow)/
const RETIRED_DESIGN_TOKENS = new Set([
  "--ok",
  "--warning",
  "--danger",
  "--radius",
  "--radius-lg",
  "--panel-radius",
  "--card-radius",
  "--section-corner",
  "--oc-button-radius",
  "--oc-titlebar-status-radius",
  "--oc-radius-panel",
  "--oc-radius-card",
  "--oc-radius-control",
  "--text-dim",
  "--text-subtle",
  "--surface-raised",
  "--border-subtle",
  "--focus-ring",
])

// These variables are assigned by a component or generated document at
// runtime. Every other fallback-free var() must resolve from the CSS graph
// loaded by the document that consumes it.
const HOST_RUNTIME_TOKEN_OWNERS = new Map<string, string[]>([
  ["--card-sticky-inline-size", ["src/components/Card.tsx"]],
  ["--composer-mention-listbox-available-height", ["src/components/ComposerMentionMenu.tsx"]],
  ["--dialog-drag-x", ["src/components/ui/Dialog.tsx"]],
  ["--dialog-drag-y", ["src/components/ui/Dialog.tsx"]],
  ["--file-explorer-row-gap", ["src/components/FileExplorerPanel.tsx"]],
  ["--file-explorer-row-height", ["src/components/FileExplorerPanel.tsx"]],
  ["--file-explorer-row-indent", ["src/components/FileExplorerPanel.tsx"]],
  ["--file-explorer-row-padding-end", ["src/components/FileExplorerPanel.tsx"]],
  ["--file-explorer-row-padding-start", ["src/components/FileExplorerPanel.tsx"]],
  ["--image-preview-rendered-height", ["src/components/ImagePreview.tsx"]],
  ["--image-preview-rendered-width", ["src/components/ImagePreview.tsx"]],
  ["--mailbox-progress", ["src/components/MailboxPanel.tsx"]],
  ["--mcp-app-height", ["src/components/interactive-artifact/McpAppArtifact.tsx"]],
  ["--native-menu-maximum-height", ["src/native-menu.tsx"]],
  ["--screenshot-browser-card-width", ["src/components/ScreenshotBrowserPanel.tsx"]],
  ["--screenshot-browser-columns", ["src/components/ScreenshotBrowserPanel.tsx"]],
  ["--ui-left-rail-scrollbar-gutter-x", ["src/main.tsx"]],
  ["--ui-overlay-min-aspect-ratio", ["script/overlay-size-contract.ts"]],
  ["--ui-overlay-min-height", ["script/overlay-size-contract.ts"]],
  ["--ui-overlay-min-width", ["script/overlay-size-contract.ts"]],
  ["--ui-scale", ["src/services/theme.ts", "src/native-menu.tsx"]],
  ["--work-row-child-insertion-index", ["src/components/WorkLedger.tsx"]],
])
const HOST_RUNTIME_TOKENS = new Set(HOST_RUNTIME_TOKEN_OWNERS.keys())
// Kobalte owns these values on the rendered primitive elements.
const PRIMITIVE_RUNTIME_TOKENS = new Set([
  "--kb-progress-fill-width",
  "--kb-tooltip-content-transform-origin",
])
const RUNTIME_TOKENS = new Set([...HOST_RUNTIME_TOKENS, ...PRIMITIVE_RUNTIME_TOKENS])

interface TokenUse {
  token: string
  file: string
  line: number
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/).length
}

function cssFilesForEntry(entry: string): string[] {
  const documentPath = path.join(SOURCE_ROOT, entry)
  const source = fs.readFileSync(documentPath, "utf8")
  return Array.from(source.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["'][^>]*>/gi), ({ 1: href }) =>
    path.resolve(SOURCE_ROOT, href!),
  )
}

const sourceByFile = new Map<string, string>()
function cssSource(file: string): string {
  const cached = sourceByFile.get(file)
  if (cached !== undefined) return cached
  const source = fs.readFileSync(file, "utf8").replaceAll(/\/\*[\s\S]*?\*\//g, "")
  sourceByFile.set(file, source)
  return source
}

function declarationsIn(file: string): Set<string> {
  return new Set(Array.from(cssSource(file).matchAll(/(?:^|[;{]\s*)(--[A-Za-z0-9_-]+)\s*:/gm), ({ 1: token }) => token!))
}

function usesIn(file: string): TokenUse[] {
  const source = cssSource(file)
  return Array.from(source.matchAll(/var\((--[A-Za-z0-9_-]+)/g), (match) => ({
    token: match[1]!,
    file,
    line: lineNumberAt(source, match.index),
  }))
}

const unresolved: Array<TokenUse & { entry: string }> = []
let referenceCount = 0
for (const entry of ENTRY_DOCUMENTS) {
  const files = cssFilesForEntry(entry)
  const declarations = new Set(files.flatMap((file) => [...declarationsIn(file)]))
  for (const file of files) {
    for (const use of usesIn(file)) {
      referenceCount += 1
      if (!declarations.has(use.token) && !RUNTIME_TOKENS.has(use.token)) unresolved.push({ ...use, entry })
    }
  }
}

if (unresolved.length > 0) {
  const details = unresolved
    .map(({ token, file, line, entry }) => `${entry} -> ${path.relative(OVERLAY_ROOT, file)}:${line}: unresolved ${token}`)
    .join("\n")
  throw new Error(`Overlay CSS contains custom properties missing from their document entry graph:\n${details}`)
}

const globalFiles = GLOBAL_TOKEN_ROOTS.flatMap((directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isFile() && entry.name.endsWith(".css") ? [path.join(directory, entry.name)] : [],
  ),
)
const globalTokens = new Set(globalFiles.flatMap((file) => [...declarationsIn(file)]))
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}
function ownerAssignsToken(token: string, relativeOwner: string): boolean {
  const source = fs
    .readFileSync(path.join(OVERLAY_ROOT, relativeOwner), "utf8")
    .replaceAll(/\/\*[\s\S]*?\*\//g, "")
    .split(/\r?\n/)
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n")
  const name = escapeRegExp(token)
  return new RegExp(
    `(?:setProperty\\(\\s*["']${name}["']|["']${name}["']\\s*(?:\\]|:)|${name}\\s*:)`,
  ).test(source)
}
const missingRuntimeAssignments = [...HOST_RUNTIME_TOKEN_OWNERS].flatMap(([token, owners]) =>
  owners.filter((owner) => !ownerAssignsToken(token, owner)).map((owner) => `${token} -> ${owner}`),
)
if (missingRuntimeAssignments.length > 0) {
  throw new Error(`Overlay CSS runtime tokens have no TS/TSX/HTML assignment owner:\n${missingRuntimeAssignments.join("\n")}`)
}
const nonCanonicalUses = ENTRY_DOCUMENTS.flatMap((entry) =>
  cssFilesForEntry(entry).flatMap((file) =>
    usesIn(file)
      .filter(({ token }) => {
        return (
          RETIRED_DESIGN_TOKENS.has(token) ||
          (CANONICAL_TOKEN_NAMESPACE.test(token) && !globalTokens.has(token) && !RUNTIME_TOKENS.has(token))
        )
      })
      .map((use) => ({ ...use, entry })),
  ),
)
const retiredDeclarations = ENTRY_DOCUMENTS.flatMap((entry) =>
  cssFilesForEntry(entry).flatMap((file) =>
    [...declarationsIn(file)]
      .filter((token) => RETIRED_DESIGN_TOKENS.has(token))
      .map((token) => ({ token, file, entry })),
  ),
)
if (nonCanonicalUses.length > 0 || retiredDeclarations.length > 0) {
  const details = nonCanonicalUses
    .map(({ token, file, line, entry }) =>
      `${entry} -> ${path.relative(OVERLAY_ROOT, file)}:${line}: ${token} is outside the canonical token authority`,
    )
    .concat(
      retiredDeclarations.map(
        ({ token, file, entry }) =>
          `${entry} -> ${path.relative(OVERLAY_ROOT, file)}: retired declaration ${token} is forbidden`,
      ),
    )
    .join("\n")
  throw new Error(`Overlay CSS revives design-token aliases outside styles/tokens or styles/cascade:\n${details}`)
}
const globalDependencies = new Map<string, Set<string>>()
for (const file of globalFiles) {
  const source = cssSource(file)
  for (const declaration of source.matchAll(/(--[A-Za-z0-9_-]+)\s*:\s*([^;{}]+);/g)) {
    const token = declaration[1]!
    const dependencies = globalDependencies.get(token) ?? new Set<string>()
    for (const dependency of declaration[2]!.matchAll(/var\((--[A-Za-z0-9_-]+)/g)) {
      if (globalTokens.has(dependency[1]!)) dependencies.add(dependency[1]!)
    }
    globalDependencies.set(token, dependencies)
  }
}

const visiting = new Set<string>()
const visited = new Set<string>()
function assertAcyclic(token: string, route: string[]): void {
  if (visiting.has(token)) {
    const start = route.indexOf(token)
    throw new Error(`Overlay global CSS token cycle: ${[...route.slice(start), token].join(" -> ")}`)
  }
  if (visited.has(token)) return
  visiting.add(token)
  for (const dependency of globalDependencies.get(token) ?? []) assertAcyclic(dependency, [...route, token])
  visiting.delete(token)
  visited.add(token)
}
for (const token of globalDependencies.keys()) assertAcyclic(token, [])

console.log(
  `CSS token entry graphs valid: ${referenceCount} references across ${ENTRY_DOCUMENTS.length} documents; ${globalTokens.size} global tokens have an acyclic dependency graph. Selector inheritance is intentionally outside this static check.`,
)
