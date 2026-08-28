import fs from "node:fs"
import path from "node:path"
import ts from "typescript"

const OVERLAY_ROOT = path.resolve(import.meta.dir, "..")
const SOURCE_ROOT = path.join(OVERLAY_ROOT, "src")
const ENTRY_DOCUMENTS = ["index.html", "native-menu.html"]
const GLOBAL_TOKEN_ROOTS = [path.join(SOURCE_ROOT, "styles", "tokens"), path.join(SOURCE_ROOT, "styles", "cascade")]
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
  "--oc-disabled-opacity",
  "--title-weight",
  "--title-track",
  "--subhead-weight",
  "--subhead-track",
  "--title-size",
  "--subhead-size",
  "--ui-font-display",
  "--ui-font-heading",
  "--ui-font-title",
  "--ui-font-brand",
  "--ui-font-control",
  "--ui-font-compact-row",
  "--ui-font-meta",
  "--ui-font-small",
  "--ui-font-tiny",
  "--ui-font-navigation",
  "--ui-line-height-snug",
  "--ui-line-height-relaxed",
  "--oc-header-title-font",
  "--oc-header-title-line-height",
])
const RETIRED_TYPOGRAPHY_ALIASES = new Set([
  "--card-title-size",
  "--card-sub-size",
  "--card-meta-size",
  "--chat-composer-font-size",
  "--chat-textarea-line-height",
  "--project-runtime-menu-type-size",
  "--settings-font-nav",
  "--settings-font-body",
  "--settings-font-section-title",
  "--settings-font-page-title",
  "--transcript-activity-font-size",
  "--transcript-activity-line-height",
  "--ui-font-label",
  "--work-row-font-size",
  "--work-row-line-height",
])
const TYPOGRAPHY_ROLE_VALUES = new Map([
  ["--ui-font-emphasis", "calc(16px * var(--ui-scale))"],
  ["--ui-font-body", "calc(14px * var(--ui-scale))"],
  ["--ui-font-code", "calc(13px * var(--ui-scale))"],
  ["--ui-font-caption", "calc(12px * var(--ui-scale))"],
  ["--ui-line-height-flat", "1"],
  ["--ui-line-height-tight", "1.35"],
  ["--ui-line-height-normal", "1.5"],
  ["--ui-line-height-reading", "1.68"],
])
const TYPOGRAPHY_FAMILY_VALUES = new Map([
  ["--font", '"Geist Variable", "Noto Sans SC Variable"'],
  ["--mono", '"JetBrains Mono Variable", "Noto Sans SC Variable"'],
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
const PRIMITIVE_RUNTIME_TOKENS = new Set(["--kb-progress-fill-width", "--kb-tooltip-content-transform-origin"])
const RUNTIME_TOKENS = new Set([...HOST_RUNTIME_TOKENS, ...PRIMITIVE_RUNTIME_TOKENS])

interface TokenUse {
  token: string
  file: string
  line: number
}

function lineNumberAt(source: string, offset: number): number {
  return source.slice(0, offset).split(/\r?\n/).length
}

function withoutComments(source: string): string {
  return source.replaceAll(/\/\*[\s\S]*?\*\//g, (comment) => comment.replaceAll(/[^\r\n]/g, " "))
}

interface DocumentStyleGraph {
  files: string[]
  inlineStyles: Array<{ source: string; startLine: number }>
}

function stylesForEntry(entry: string): DocumentStyleGraph {
  const documentPath = path.join(SOURCE_ROOT, entry)
  const source = fs.readFileSync(documentPath, "utf8")
  return {
    files: Array.from(
      source.matchAll(/<link\s+[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+\.css)["'][^>]*>/gi),
      ({ 1: href }) => path.resolve(SOURCE_ROOT, href!),
    ),
    inlineStyles: Array.from(source.matchAll(/<style(?:\s[^>]*)?>([\s\S]*?)<\/style>/gi), (match) => ({
      source: withoutComments(match[1]!),
      startLine: lineNumberAt(source, match.index + match[0].indexOf(match[1]!)) - 1,
    })),
  }
}

const sourceByFile = new Map<string, string>()
function cssSource(file: string): string {
  const cached = sourceByFile.get(file)
  if (cached !== undefined) return cached
  const source = withoutComments(fs.readFileSync(file, "utf8"))
  sourceByFile.set(file, source)
  return source
}

function filesRecursively(directory: string, extension: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    if (entry.isDirectory()) return filesRecursively(target, extension)
    return entry.isFile() && entry.name.endsWith(extension) ? [target] : []
  })
}

const applicationCssFiles = filesRecursively(SOURCE_ROOT, ".css")
const designLanguageCssFiles = applicationCssFiles.filter((file) => {
  const relative = path.relative(SOURCE_ROOT, file).replaceAll("\\", "/")
  return !relative.startsWith("components/interactive-artifact/")
})

function declarationsIn(file: string): Set<string> {
  return new Set(
    Array.from(cssSource(file).matchAll(/(?:^|[;{]\s*)(--[A-Za-z0-9_-]+)\s*:/gm), ({ 1: token }) => token!),
  )
}

function usesIn(file: string): TokenUse[] {
  const source = cssSource(file)
  return Array.from(source.matchAll(/var\((--[A-Za-z0-9_-]+)/g), (match) => ({
    token: match[1]!,
    file,
    line: lineNumberAt(source, match.index),
  }))
}

function declarationsInSource(source: string): Set<string> {
  return new Set(Array.from(source.matchAll(/(?:^|[;{]\s*)(--[A-Za-z0-9_-]+)\s*:/gm), ({ 1: token }) => token!))
}

function usesInSource(source: string, file: string, startLine = 0): TokenUse[] {
  return Array.from(source.matchAll(/var\((--[A-Za-z0-9_-]+)/g), (match) => ({
    token: match[1]!,
    file,
    line: startLine + lineNumberAt(source, match.index),
  }))
}

const unresolved: Array<TokenUse & { entry: string }> = []
let referenceCount = 0
for (const entry of ENTRY_DOCUMENTS) {
  const { files, inlineStyles } = stylesForEntry(entry)
  const inlineFile = path.join(SOURCE_ROOT, entry)
  const declarations = new Set([
    ...files.flatMap((file) => [...declarationsIn(file)]),
    ...inlineStyles.flatMap(({ source }) => [...declarationsInSource(source)]),
  ])
  for (const file of files) {
    for (const use of usesIn(file)) {
      referenceCount += 1
      if (!declarations.has(use.token) && !RUNTIME_TOKENS.has(use.token)) unresolved.push({ ...use, entry })
    }
  }
  for (const { source, startLine } of inlineStyles) {
    for (const use of usesInSource(source, inlineFile, startLine)) {
      referenceCount += 1
      if (!declarations.has(use.token) && !RUNTIME_TOKENS.has(use.token)) unresolved.push({ ...use, entry })
    }
  }
}

if (unresolved.length > 0) {
  const details = unresolved
    .map(
      ({ token, file, line, entry }) => `${entry} -> ${path.relative(OVERLAY_ROOT, file)}:${line}: unresolved ${token}`,
    )
    .join("\n")
  throw new Error(`Overlay CSS contains custom properties missing from their document entry graph:\n${details}`)
}

const globalFiles = GLOBAL_TOKEN_ROOTS.flatMap((directory) =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => (entry.isFile() && entry.name.endsWith(".css") ? [path.join(directory, entry.name)] : [])),
)
const globalTokens = new Set(globalFiles.flatMap((file) => [...declarationsIn(file)]))
function entryUses(entry: string): TokenUse[] {
  const { files, inlineStyles } = stylesForEntry(entry)
  const documentPath = path.join(SOURCE_ROOT, entry)
  return [
    ...files.flatMap(usesIn),
    ...inlineStyles.flatMap(({ source, startLine }) => usesInSource(source, documentPath, startLine)),
  ]
}

function entryDeclarations(entry: string): Array<{ token: string; file: string }> {
  const { files, inlineStyles } = stylesForEntry(entry)
  const documentPath = path.join(SOURCE_ROOT, entry)
  return [
    ...files.flatMap((file) => [...declarationsIn(file)].map((token) => ({ token, file }))),
    ...inlineStyles.flatMap(({ source }) =>
      [...declarationsInSource(source)].map((token) => ({ token, file: documentPath })),
    ),
  ]
}

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
  return new RegExp(`(?:setProperty\\(\\s*["']${name}["']|["']${name}["']\\s*(?:\\]|:)|${name}\\s*:)`).test(source)
}
const missingRuntimeAssignments = [...HOST_RUNTIME_TOKEN_OWNERS].flatMap(([token, owners]) =>
  owners.filter((owner) => !ownerAssignsToken(token, owner)).map((owner) => `${token} -> ${owner}`),
)
if (missingRuntimeAssignments.length > 0) {
  throw new Error(
    `Overlay CSS runtime tokens have no TS/TSX/HTML assignment owner:\n${missingRuntimeAssignments.join("\n")}`,
  )
}
const nonCanonicalUses = ENTRY_DOCUMENTS.flatMap((entry) =>
  entryUses(entry)
    .filter(({ token }) => {
      return (
        RETIRED_DESIGN_TOKENS.has(token) ||
        (CANONICAL_TOKEN_NAMESPACE.test(token) && !globalTokens.has(token) && !RUNTIME_TOKENS.has(token))
      )
    })
    .map((use) => ({ ...use, entry })),
)
const retiredDeclarations = [
  ...applicationCssFiles.flatMap((file) =>
    [...declarationsIn(file)]
      .filter((token) => RETIRED_DESIGN_TOKENS.has(token) || RETIRED_TYPOGRAPHY_ALIASES.has(token))
      .map((token) => ({ token, file, entry: "all stylesheets" })),
  ),
  ...ENTRY_DOCUMENTS.flatMap((entry) => {
    const documentPath = path.join(SOURCE_ROOT, entry)
    return stylesForEntry(entry).inlineStyles.flatMap(({ source }) =>
      [...declarationsInSource(source)]
        .filter((token) => RETIRED_DESIGN_TOKENS.has(token) || RETIRED_TYPOGRAPHY_ALIASES.has(token))
        .map((token) => ({ token, file: documentPath, entry })),
    )
  }),
]
if (nonCanonicalUses.length > 0 || retiredDeclarations.length > 0) {
  const details = nonCanonicalUses
    .map(
      ({ token, file, line, entry }) =>
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

const designLanguagePath = path.join(SOURCE_ROOT, "styles", "tokens", "design-language.css")
const designLanguageSource = cssSource(designLanguagePath)
const designLanguageRoot = ruleBody(designLanguageSource, ":root")
const typographyAuthorityValues = new Map([...TYPOGRAPHY_ROLE_VALUES, ...TYPOGRAPHY_FAMILY_VALUES])
const typographyRoleMismatches = [...typographyAuthorityValues].flatMap(([token, expected]) => {
  const declarationPattern = new RegExp(`(?:^|[;{]\\s*)${escapeRegExp(token)}\\s*:\\s*([^;{}]+);`, "gm")
  const documentMatches = [...designLanguageSource.matchAll(declarationPattern)]
  const rootMatches = [...designLanguageRoot.matchAll(declarationPattern)]
  if (rootMatches.length === 0) return [`${token}: missing canonical :root declaration`]
  if (rootMatches.length > 1) return [`${token}: expected one :root declaration, received ${rootMatches.length}`]
  if (documentMatches.length !== 1) {
    return [`${token}: expected one design-language declaration, received ${documentMatches.length}`]
  }
  const actual = rootMatches[0]![1]!.trim()
  return actual === expected ? [] : [`${token}: expected ${expected}, received ${actual}`]
})
if (typographyRoleMismatches.length > 0) {
  throw new Error(`Overlay typography role values are not canonical:\n${typographyRoleMismatches.join("\n")}`)
}

const canonicalTypographyTokens = new Set(typographyAuthorityValues.keys())
const typographyOwnerViolations = [
  ...applicationCssFiles
    .filter((file) => path.resolve(file) !== path.resolve(designLanguagePath))
    .flatMap((file) =>
      [...declarationsIn(file)]
        .filter((token) => canonicalTypographyTokens.has(token))
        .map((token) => `${path.relative(OVERLAY_ROOT, file)}: redeclares ${token}`),
    ),
  ...ENTRY_DOCUMENTS.flatMap((entry) => {
    const documentPath = path.join(SOURCE_ROOT, entry)
    return stylesForEntry(entry).inlineStyles.flatMap(({ source, startLine }) =>
      [...declarationsInSource(source)]
        .filter((token) => canonicalTypographyTokens.has(token))
        .map((token) => `${path.relative(OVERLAY_ROOT, documentPath)}:${startLine}: redeclares ${token}`),
    )
  }),
]
if (typographyOwnerViolations.length > 0) {
  throw new Error(
    `Overlay typography roles must be declared only by styles/tokens/design-language.css:\n${typographyOwnerViolations.join("\n")}`,
  )
}

interface TypographyDeclaration {
  property: "font" | "font-family" | "font-size" | "line-height"
  value: string
  selector: string
  line: number
}

function selectorAt(source: string, offset: number): string {
  const openingBrace = source.lastIndexOf("{", offset)
  if (openingBrace < 0) return "<inline>"
  const previousBoundary = Math.max(source.lastIndexOf("}", openingBrace), source.lastIndexOf("{", openingBrace - 1))
  return source.slice(previousBoundary + 1, openingBrace).trim()
}

function typographyDeclarations(source: string): TypographyDeclaration[] {
  return Array.from(
    source.matchAll(/(?:^|[;{])\s*(font-family|font-size|line-height|font)\s*:\s*([^;{}]+)(?=;|})/gm),
    (match) => ({
      property: match[1]! as TypographyDeclaration["property"],
      value: match[2]!.trim(),
      selector: selectorAt(source, match.index),
      line: lineNumberAt(source, match.index),
    }),
  )
}

const FONT_SIZE_VALUES = new Set([
  "var(--ui-font-emphasis)",
  "var(--ui-font-body)",
  "var(--ui-font-code)",
  "var(--ui-font-caption)",
  "inherit",
  "inherit !important",
])
const FONT_FAMILY_VALUES = new Set(["var(--font)", "var(--mono)", "inherit"])
const LINE_HEIGHT_VALUES = new Set([
  "var(--ui-line-height-flat)",
  "var(--ui-line-height-tight)",
  "var(--ui-line-height-normal)",
  "var(--ui-line-height-reading)",
  "inherit",
  "0",
])

function isArtifactOwnedTypography(file: string, _selector: string): boolean {
  const relative = path.relative(SOURCE_ROOT, file).replaceAll("\\", "/")
  return relative.startsWith("components/interactive-artifact/")
}

function typographyViolation(file: string, declaration: TypographyDeclaration): string | undefined {
  if (isArtifactOwnedTypography(file, declaration.selector)) return undefined
  if (declaration.property === "font-size" && !FONT_SIZE_VALUES.has(declaration.value)) {
    return `font-size must consume a canonical role, received ${declaration.value}`
  }
  if (declaration.property === "font-family" && !FONT_FAMILY_VALUES.has(declaration.value)) {
    return `font-family must consume a canonical family, received ${declaration.value}`
  }
  if (declaration.property === "line-height" && !LINE_HEIGHT_VALUES.has(declaration.value)) {
    return `line-height must consume a canonical role, received ${declaration.value}`
  }
  if (declaration.property === "font") {
    const familyOnlyValues = new Set(["inherit"])
    const consumesCanonicalSize = [...FONT_SIZE_VALUES].some(
      (fontSize) =>
        fontSize.startsWith("var(") &&
        new RegExp(`(?:^|\\s)${escapeRegExp(fontSize)}(?=\\s|/|$)`).test(declaration.value),
    )
    if (!familyOnlyValues.has(declaration.value) && !consumesCanonicalSize) {
      return `font shorthand must consume a canonical size role, received ${declaration.value}`
    }
    const consumesCanonicalLineHeight = [...LINE_HEIGHT_VALUES].some(
      (lineHeight) =>
        lineHeight.startsWith("var(") &&
        new RegExp(`/\\s*${escapeRegExp(lineHeight)}(?=\\s|$)`).test(declaration.value),
    )
    if (consumesCanonicalSize && !consumesCanonicalLineHeight) {
      return `font shorthand with a size role must also consume a canonical line-height role, received ${declaration.value}`
    }
    const consumesCanonicalPair = [...LINE_HEIGHT_VALUES].some(
      (lineHeight) =>
        lineHeight.startsWith("var(") &&
        [...FONT_FAMILY_VALUES].some(
          (family) =>
            family.startsWith("var(") &&
            new RegExp(`/\\s*${escapeRegExp(lineHeight)}\\s+${escapeRegExp(family)}\\s*$`).test(declaration.value),
        ),
    )
    if (consumesCanonicalSize && !consumesCanonicalPair) {
      return `font shorthand must end with one canonical line-height/family pair, received ${declaration.value}`
    }
  }
  return undefined
}

const typographyViolations = applicationCssFiles.flatMap((file) =>
  typographyDeclarations(cssSource(file)).flatMap((declaration) => {
    const violation = typographyViolation(file, declaration)
    return violation
      ? [`${path.relative(OVERLAY_ROOT, file)}:${declaration.line} (${declaration.selector}): ${violation}`]
      : []
  }),
)
for (const entry of ENTRY_DOCUMENTS) {
  const documentPath = path.join(SOURCE_ROOT, entry)
  for (const { source, startLine } of stylesForEntry(entry).inlineStyles) {
    for (const declaration of typographyDeclarations(source)) {
      const violation = typographyViolation(documentPath, declaration)
      if (violation) {
        typographyViolations.push(
          `${path.relative(OVERLAY_ROOT, documentPath)}:${startLine + declaration.line} (${declaration.selector}): ${violation}`,
        )
      }
    }
  }
}
if (typographyViolations.length > 0) {
  throw new Error(`Overlay application typography escapes the bounded role scale:\n${typographyViolations.join("\n")}`)
}

function sourceLabel(file: string): string {
  return path.relative(SOURCE_ROOT, file).replaceAll("\\", "/")
}

function isArtifactSource(file: string): boolean {
  return sourceLabel(file).startsWith("components/interactive-artifact/")
}

const applicationScriptFiles = [
  ...filesRecursively(SOURCE_ROOT, ".ts"),
  ...filesRecursively(SOURCE_ROOT, ".tsx"),
].filter((file) => !isArtifactSource(file))

const INLINE_TYPOGRAPHY_PROPERTIES = new Set([
  "font",
  "fontSize",
  "font-size",
  "fontFamily",
  "font-family",
  "lineHeight",
  "line-height",
])

function syntaxPropertyName(name: ts.PropertyName | undefined): string | undefined {
  if (!name) return undefined
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text
  return undefined
}

function syntaxMemberName(expression: ts.Expression): string | undefined {
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text
  if (ts.isElementAccessExpression(expression) && expression.argumentExpression) {
    const argument = expression.argumentExpression
    if (ts.isStringLiteral(argument)) return argument.text
  }
  return undefined
}

function isStyleReceiver(expression: ts.Expression): boolean {
  return syntaxMemberName(expression) === "style"
}

const scriptTypographyViolations = applicationScriptFiles.flatMap((file) => {
  const source = fs.readFileSync(file, "utf8")
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  )
  const violations: string[] = []
  const report = (node: ts.Node, description: string): void => {
    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
    violations.push(`${sourceLabel(file)}:${line}: ${description}`)
  }
  const inspectStyleObject = (object: ts.ObjectLiteralExpression): void => {
    for (const property of object.properties) {
      if (!ts.isPropertyAssignment(property) && !ts.isShorthandPropertyAssignment(property)) continue
      const name = syntaxPropertyName(property.name)
      if (name && INLINE_TYPOGRAPHY_PROPERTIES.has(name)) {
        report(property, `inline style property ${name} must be expressed by a CSS class`)
      }
    }
  }
  const inspectStyleExpression = (expression: ts.Expression): void => {
    if (ts.isObjectLiteralExpression(expression)) inspectStyleObject(expression)
    else if (ts.isParenthesizedExpression(expression)) inspectStyleExpression(expression.expression)
    else if (ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)) {
      inspectStyleExpression(expression.expression)
    }
  }
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) || ts.isShorthandPropertyAssignment(node)) {
      const name = syntaxPropertyName(node.name)
      if (name && canonicalTypographyTokens.has(name)) {
        report(node, `runtime assignment to canonical typography authority ${name} is forbidden`)
      }
    }
    if (ts.isJsxAttribute(node) && node.name.text === "style" && node.initializer) {
      if (ts.isStringLiteral(node.initializer)) {
        if (/(?:^|;)\s*(?:font|font-size|font-family|line-height)\s*:/.test(node.initializer.text)) {
          report(node, "inline JSX typography must be expressed by a CSS class")
        }
      } else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        inspectStyleExpression(node.initializer.expression)
      }
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      (ts.isPropertyAccessExpression(node.left) || ts.isElementAccessExpression(node.left)) &&
      isStyleReceiver(node.left.expression)
    ) {
      const name = syntaxMemberName(node.left)
      if (name && INLINE_TYPOGRAPHY_PROPERTIES.has(name)) {
        report(node.left, `DOM style property ${name} must be expressed by a CSS class`)
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const receiver = node.expression.expression
      if (node.expression.name.text === "setProperty" && isStyleReceiver(receiver)) {
        const property = node.arguments[0]
        if (property && ts.isStringLiteral(property)) {
          if (INLINE_TYPOGRAPHY_PROPERTIES.has(property.text)) {
            report(property, `DOM style property ${property.text} must be expressed by a CSS class`)
          }
          if (canonicalTypographyTokens.has(property.text)) {
            report(property, `runtime assignment to canonical typography authority ${property.text} is forbidden`)
          }
        }
      }
      if (
        node.expression.expression.getText(sourceFile) === "Object" &&
        node.expression.name.text === "assign" &&
        node.arguments[0] &&
        isStyleReceiver(node.arguments[0]!)
      ) {
        for (const argument of node.arguments.slice(1)) inspectStyleExpression(argument)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return violations
})
if (scriptTypographyViolations.length > 0) {
  throw new Error(
    `Overlay TS/TSX bypasses the CSS-owned typography authority:\n${scriptTypographyViolations.join("\n")}`,
  )
}

function ruleBody(source: string, selector: string): string {
  const selectorStart = source.indexOf(selector)
  if (selectorStart < 0) throw new Error(`Overlay palette selector not found: ${selector}`)
  const openingBrace = source.indexOf("{", selectorStart)
  if (openingBrace < 0) throw new Error(`Overlay palette selector has no rule body: ${selector}`)
  let depth = 1
  let cursor = openingBrace + 1
  for (; cursor < source.length && depth > 0; cursor += 1) {
    if (source[cursor] === "{") depth += 1
    else if (source[cursor] === "}") depth -= 1
  }
  if (depth !== 0) throw new Error(`Overlay palette selector has an unbalanced rule body: ${selector}`)
  return source.slice(openingBrace + 1, cursor - 1)
}

function declaredTokens(source: string): Set<string> {
  return new Set([...source.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gm)].map((match) => match[1]!))
}

const themeSelectors = new Map([
  ["light", ':root[data-theme="light"]'],
  ["dark", ':root[data-theme="dark"]'],
  ["vscode-dark", ':root[data-theme="vscode-dark"]'],
])
const themeTokenSets = [...themeSelectors].map(([name, selector]) => {
  const file = path.join(SOURCE_ROOT, "styles", "cascade", `${name}.css`)
  return [name, declaredTokens(ruleBody(cssSource(file), selector))] as const
})
const themeTokenUnion = new Set(themeTokenSets.flatMap(([, tokens]) => [...tokens]))
const paletteGaps = [...themeTokenUnion].sort().flatMap((token) => {
  const missing = themeTokenSets.filter(([, tokens]) => !tokens.has(token)).map(([name]) => name)
  return missing.length > 0 ? [`${token} missing from ${missing.join(", ")}`] : []
})
if (paletteGaps.length > 0) {
  throw new Error(`Overlay theme palettes must declare the same token set:\n${paletteGaps.join("\n")}`)
}

const durationScale = new Set(
  [...designLanguageSource.matchAll(/--ui-duration-[a-z-]+:\s*([0-9.]+m?s)/g)].map((match) => match[1]!),
)
if (durationScale.size === 0) throw new Error("Overlay motion scale has no duration roles")
const motionViolations = designLanguageCssFiles.flatMap((file) => {
  const source = cssSource(file)
  const violations: string[] = []
  for (const declaration of source.matchAll(/(?:transition|animation)(?:-duration)?\s*:\s*([^;]+);/g)) {
    for (const literal of declaration[1]!.matchAll(/(?<![\w-])(\d*\.?\d+m?s)(?![\w-])/g)) {
      if (durationScale.has(literal[1]!) || literal[1] === "9999s") continue
      violations.push(`${sourceLabel(file)}:${lineNumberAt(source, declaration.index)}: duration ${literal[1]}`)
    }
  }
  for (const match of source.matchAll(
    /(?:transition|animation)[^;]*calc\([0-9.]+m?s\s*\*\s*var\(--ui-scale[^)]*\)\)/g,
  )) {
    violations.push(`${sourceLabel(file)}:${lineNumberAt(source, match.index)}: duration must not track --ui-scale`)
  }
  return violations
})
if (motionViolations.length > 0) {
  throw new Error(`Overlay motion escapes the canonical duration scale:\n${motionViolations.join("\n")}`)
}

const SPACING_PROPERTIES = new Set([
  "gap",
  "row-gap",
  "column-gap",
  ...["padding", "margin"].flatMap((property) => [
    property,
    `${property}-top`,
    `${property}-right`,
    `${property}-bottom`,
    `${property}-left`,
    `${property}-block`,
    `${property}-block-start`,
    `${property}-block-end`,
    `${property}-inline`,
    `${property}-inline-start`,
    `${property}-inline-end`,
  ]),
])
const spacingViolations = designLanguageCssFiles.flatMap((file) => {
  const source = cssSource(file)
  const violations: string[] = []
  for (const declaration of source.matchAll(/(?:^|[;{])\s*([a-z][-a-z]*)\s*:\s*([^;{}]*)/g)) {
    const property = declaration[1]!
    if (!SPACING_PROPERTIES.has(property)) continue
    for (const literal of declaration[2]!.matchAll(/calc\((\d+(?:\.\d+)?)px \* var\(--ui-scale(?:, 1)?\)\)/g)) {
      if (Number(literal[1]) > 32) continue
      violations.push(`${sourceLabel(file)}:${lineNumberAt(source, declaration.index)}: ${property} ${literal[1]}px`)
    }
  }
  return violations
})
if (spacingViolations.length > 0) {
  throw new Error(`Overlay rhythm spacing escapes the canonical gap ladder:\n${spacingViolations.join("\n")}`)
}

const vscodeDarkPath = path.join(SOURCE_ROOT, "styles", "cascade", "vscode-dark.css")
const vscodeHostTokens = [...cssSource(vscodeDarkPath).matchAll(/var\((--vscode-[a-z-]+)/g)].map((match) => match[1]!)
if (vscodeHostTokens.length > 0) {
  throw new Error(`Overlay-owned vscode-dark palette depends on host tokens:\n${vscodeHostTokens.join("\n")}`)
}

console.log(
  `CSS token entry graphs valid: ${referenceCount} references across ${ENTRY_DOCUMENTS.length} documents; ${globalTokens.size} global tokens have an acyclic dependency graph; ${designLanguageCssFiles.length} application stylesheets and ${applicationScriptFiles.length} application TS/TSX files conform to the bounded design-language roles; ${applicationCssFiles.length - designLanguageCssFiles.length} Interactive Artifact stylesheets are content-owned and exempt. Selector inheritance is intentionally outside this static check.`,
)
