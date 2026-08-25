// ── Markdown Renderer (powered by marked + highlight.js) ──

import { marked } from "marked"
import { LinkifyIt } from "linkify-it"
import hljs from "highlight.js/lib/core"
import langTS from "highlight.js/lib/languages/typescript"
import langJS from "highlight.js/lib/languages/javascript"
import langPy from "highlight.js/lib/languages/python"
import langRust from "highlight.js/lib/languages/rust"
import langGo from "highlight.js/lib/languages/go"
import langJava from "highlight.js/lib/languages/java"
import langCpp from "highlight.js/lib/languages/cpp"
import langCSS from "highlight.js/lib/languages/css"
import langXML from "highlight.js/lib/languages/xml"
import langJSON from "highlight.js/lib/languages/json"
import langYAML from "highlight.js/lib/languages/yaml"
import langBash from "highlight.js/lib/languages/bash"
import langSQL from "highlight.js/lib/languages/sql"
import langMD from "highlight.js/lib/languages/markdown"
import langDiff from "highlight.js/lib/languages/diff"
import {
  fileReferenceHtmlAttributes,
  parseFileReference,
  FILE_REFERENCE_PATH_ATTRIBUTE,
  PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE,
  type FileReference,
} from "./file-reference"
import { iconHtml } from "./icon-html"
import { imagePreviewTriggerHtmlAttributes } from "./image-preview-trigger"
import { localeTag, t } from "./i18n"

export const MARKDOWN_RENDER_CHAR_LIMIT = 120_000
export const CODE_BLOCK_RENDER_CHAR_LIMIT = 120_000
export const CODE_BLOCK_RENDER_LINE_LIMIT = 2_000
export const MARKDOWN_DATA_IMAGE_CHAR_LIMIT = 120_000
const MARKDOWN_RENDER_CACHE_LIMIT = 512
const MARKDOWN_PREWARM_SOURCE_CHAR_LIMIT = 4_000
const RENDER_CLIP_NOTICE = "\n\n[Overlay display clipped; full content remains available in the task trace.]"
const DATA_IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\((data:image\/(?:png|jpe?g|gif|webp|avif);base64,[^)]+)\)/gi
const plainUrlLinkifier = new LinkifyIt({ fuzzyEmail: false, fuzzyIP: false })
const markdownRenderCache = new Map<string, string>()
let markdownPrewarmEpoch = 0
let markdownPrewarmAnimationHandle: number | null = null
let markdownPrewarmTimer: ReturnType<typeof setTimeout> | null = null

// Register languages (selective import keeps bundle small)
const LANGUAGES: [string, any][] = [
  ["typescript", langTS],
  ["javascript", langJS],
  ["python", langPy],
  ["rust", langRust],
  ["go", langGo],
  ["java", langJava],
  ["cpp", langCpp],
  ["css", langCSS],
  ["xml", langXML],
  ["json", langJSON],
  ["yaml", langYAML],
  ["bash", langBash],
  ["sql", langSQL],
  ["markdown", langMD],
  ["diff", langDiff],
]
for (const [name, lang] of LANGUAGES) hljs.registerLanguage(name, lang)

// ── Extension → language mapping ──

const EXT_LANG: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  py: "python",
  pyi: "python",
  rs: "rust",
  go: "go",
  java: "java",
  c: "cpp",
  h: "cpp",
  cpp: "cpp",
  cc: "cpp",
  cxx: "cpp",
  hpp: "cpp",
  css: "css",
  scss: "css",
  less: "css",
  html: "xml",
  htm: "xml",
  xml: "xml",
  svg: "xml",
  json: "json",
  jsonc: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "yaml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  md: "markdown",
  mdx: "markdown",
  diff: "diff",
  patch: "diff",
}

export function extToLang(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  return EXT_LANG[ext] ?? "plaintext"
}

// ── Configure marked with hljs code renderer ──

marked.setOptions({ async: false, gfm: true, breaks: false })

// Wrap a fenced code block with the language tag + copy affordance the
// overlay shows on hover. Raw source goes into a data-attribute so the
// global click listener (installed in main.tsx) can write it to the
// clipboard without needing to re-decode the highlighted HTML.
function wrapCodeBlock(rawText: string, language: string, highlightedHtml: string): string {
  const langAttr = language ? `language-${language}` : ""
  const langLabel = language || "code"
  const dataSource = escapeAttr(rawText)
  const copyLabel = escapeAttr(t("markdown.copy_code"))
  return [
    `<div class="md-code" data-lang="${escapeAttr(language)}">`,
    `<div class="md-code-toolbar">`,
    `<span class="md-code-lang">${escapeHtml(langLabel)}</span>`,
    `<button type="button" class="oc-button md-code-copy" data-variant="ghost" data-size="icon" data-tone="neutral" data-chrome="icon-action" data-ui="markdown-code-copy" data-md-copy="${dataSource}" title="${copyLabel}" aria-label="${copyLabel}">`,
    iconHtml("copy", "compact"),
    `</button>`,
    `</div>`,
    `<pre><code class="${language ? `hljs ${langAttr}` : ""}">${highlightedHtml}</code></pre>`,
    `</div>`,
  ].join("")
}

marked.use({
  tokenizer: {
    url() {
      return false
    },
  },
  extensions: [
    {
      name: "plainUrl",
      level: "inline",
      start(src: string) {
        return plainUrlLinkifier.match(src)?.[0]?.index
      },
      tokenizer(src: string) {
        const match = plainUrlLinkifier.match(src)?.[0]
        if (!match || match.index !== 0) return undefined
        const plainUrl = normalizePlainUrlMatch(match.raw)
        if (!plainUrl) return undefined
        return {
          type: "link",
          raw: plainUrl.raw,
          href: plainUrl.href,
          title: null,
          text: plainUrl.raw,
          tokens: [{ type: "text", raw: plainUrl.raw, text: plainUrl.raw }],
        }
      },
    },
  ],
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : ""
      if (!language) return wrapCodeBlock(text, "", escapeHtml(text))
      const highlighted = hljs.highlight(text, { language }).value
      return wrapCodeBlock(text, language, highlighted)
    },
    codespan({ text }: { text: string }) {
      // `text` is the raw codespan content (before HTML escaping). Always
      // escape before emitting — the default renderer does the same.
      const reference = extractFileReference(text)
      if (reference) {
        const attributes = fileReferenceHtmlAttributes(FILE_REFERENCE_PATH_ATTRIBUTE, reference.reference, escapeAttr)
        return `<code><a class="file-link" href="#"${attributes}>${escapeHtml(reference.display)}</a></code>`
      }
      return `<code>${escapeHtml(text)}</code>`
    },
    html({ text }: { text: string }) {
      return escapeHtml(text)
    },
    link(this: any, token: { href: string; title?: string | null; tokens?: any[]; text?: string }) {
      const label = token.tokens ? this.parser.parseInline(token.tokens) : escapeHtml(token.text || token.href || "")
      const projectFile = markdownProjectFileReference(token.href)
      if (projectFile) {
        const attributes = fileReferenceHtmlAttributes(PROJECT_FILE_REFERENCE_PATH_ATTRIBUTE, projectFile, escapeAttr)
        const title = token.title ? ` title="${escapeAttr(token.title)}"` : ""
        return `<a href="#"${attributes}${title}>${label}</a>`
      }
      const href = safeMarkdownHref(token.href)
      if (!href) return label
      const title = token.title ? ` title="${escapeAttr(token.title)}"` : ""
      const external = isHttpUrl(href) ? ` target="_blank" rel="noopener noreferrer"` : ""
      return `<a href="${escapeAttr(href)}"${title}${external}${browserPreviewAttrs(href)}>${label}</a>`
    },
    image({ href, title, text }: { href: string; title?: string | null; text: string }) {
      const src = safeMarkdownImageSrc(href)
      if (!src) return escapeHtml(text || href || "")
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : ""
      const alt = escapeAttr(text || "")
      const triggerAttrs = imagePreviewTriggerHtmlAttributes({ src, alt: text || "" }, escapeAttr)
      return `<button ${triggerAttrs}><img class="md-img" src="${escapeAttr(src)}" alt="${alt}"${titleAttr} loading="lazy"></button>`
    },
  },
})

function normalizePlainUrlMatch(raw: string): { raw: string; href: string } | null {
  const bounded = trimPlainUrlBoundary(raw)
  if (!bounded) return null
  const href = /^www\./i.test(bounded) ? `http://${bounded}` : bounded
  return safeMarkdownHref(href) ? { raw: bounded, href } : null
}

function trimPlainUrlBoundary(raw: string): string {
  let url = raw
  const delimiterIndex = url.search(/["'`<>]/)
  if (delimiterIndex >= 0) url = url.slice(0, delimiterIndex)
  url = url.replace(/[.,;:!?]+$/g, "")
  url = trimUnbalancedClosing(url, "(", ")")
  url = trimUnbalancedClosing(url, "[", "]")
  url = trimUnbalancedClosing(url, "{", "}")
  return url
}

function trimUnbalancedClosing(value: string, open: string, close: string): string {
  let output = value
  while (output.endsWith(close) && countChar(output, close) > countChar(output, open)) {
    output = output.slice(0, -1)
  }
  return output
}

function countChar(value: string, char: string): number {
  let count = 0
  for (const item of value) {
    if (item === char) count++
  }
  return count
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;")
}

function normaliseMarkdownUrl(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[\u0000-\u001f\u007f\s]+/g, "")
}

function protocolForMarkdownUrl(raw: string): string {
  const match = normaliseMarkdownUrl(raw).match(/^([a-z][a-z0-9+.-]*):/i)
  return match ? match[1].toLowerCase() : ""
}

function safeMarkdownHref(raw: string): string {
  const url = normaliseMarkdownUrl(raw)
  if (!url) return ""
  const protocol = protocolForMarkdownUrl(url)
  if (!protocol || protocol === "http" || protocol === "https" || protocol === "mailto") return url
  return ""
}

function safeMarkdownImageSrc(raw: string): string {
  const url = normaliseMarkdownUrl(raw)
  if (!url) return ""
  const protocol = protocolForMarkdownUrl(url)
  if (!protocol || protocol === "http" || protocol === "https") return url
  if (/^data:image\/(?:png|jpe?g|gif|webp|avif);base64,/i.test(url)) {
    return url.length <= MARKDOWN_DATA_IMAGE_CHAR_LIMIT ? url : ""
  }
  return ""
}

function isHttpUrl(raw: string): boolean {
  return /^https?:\/\//i.test(raw)
}

function browserPreviewAttrs(raw: string): string {
  return isHttpUrl(raw) ? ` data-browser-preview-url="${escapeAttr(raw)}"` : ""
}

// File-ish extensions shared by code-path references and explicit Markdown
// deliverable links. Office documents and Portable Document Format (PDF)
// outputs are project artifacts even when their names contain Unicode text.
const FILE_EXT_RE =
  /\.(?:ts|tsx|js|jsx|mts|cts|mjs|cjs|json|jsonc|md|mdx|css|scss|less|html|htm|xml|svg|yaml|yml|toml|py|pyi|rs|go|java|c|h|cpp|cc|cxx|hpp|sh|bash|zsh|sql|rb|php|lua|kt|swift|dart|vue|astro|conf|ini|env|lock|txt|pdf|csv|tsv|xls|xlsx|xlsm|ods|doc|docx|odt|ppt|pptx|odp)$/i

function markdownProjectFileReference(raw: string): FileReference | null {
  // Split the cited location off first: `src/a.ts:42` has to clear the
  // `scheme:` guard and the end-anchored extension test on its path half alone.
  const reference = parseFileReference(String(raw || "").trim())
  const value = reference.path
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null
  if (value.startsWith("#") || value.startsWith("//") || /^\/attachment(?:\/|$)/i.test(value)) return null
  const windowsAbsolutePath = /^[A-Za-z]:[\\/]/.test(value)
  if (!windowsAbsolutePath && /^[a-z][a-z0-9+.-]*:/i.test(value)) return null
  if (/[?#]/.test(value)) return null
  let decoded: string
  try {
    decoded = decodeURI(value)
  } catch {
    return null
  }
  return FILE_EXT_RE.test(decoded) ? { ...reference, path: decoded } : null
}

/**
 * Decide whether a codespan's text is a file path reference. Returns the cited
 * reference — path plus the optional `:line[:col]` location, which is what
 * makes the click land on the cited line rather than the top of the file — and
 * the display label (original text). Returns null for non-path content
 * (commands, identifiers, URLs, etc.).
 */
function extractFileReference(text: string): { display: string; reference: FileReference } | null {
  const s = text.trim()
  if (!s) return null
  // Reject URLs and protocol-ish strings.
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return null
  // Reject whitespace (multi-word commands) and shell flags.
  if (/\s/.test(s)) return null
  if (s.startsWith("-")) return null
  // Split the trailing :line[:col] off; the guards below judge the path half.
  const reference = parseFileReference(s)
  const pathPart = reference.path
  // Must look like a valid file token (letters/digits/underscore/dot/dash
  // plus path separators and optional './' or '../' prefix).
  if (!/^[\w./\\@~-]+$/.test(pathPart)) return null
  const hasSlash = /[\/\\]/.test(pathPart)
  const hasFileExt = FILE_EXT_RE.test(pathPart)
  // Require either a path separator OR a recognisable file extension —
  // this filters out bare identifiers like `foo` or `useState`.
  if (!hasSlash && !hasFileExt) return null
  // Reject isolated extensions like ".ts".
  if (/^\.\w+$/.test(pathPart)) return null
  return { display: s, reference }
}

// ── Core rendering functions ──

export function escapeHtml(str: string): string {
  if (!str) return ""
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

/** Render inline markdown only (no block-level elements). */
export function inlineMarkdown(text: string): string {
  return marked.parseInline(text) as string
}

/** Render full markdown (block + inline). */
export function renderMarkdown(text: string): string {
  const clipped = text.length > MARKDOWN_RENDER_CHAR_LIMIT
  const boundedText = clipped ? text.slice(0, MARKDOWN_RENDER_CHAR_LIMIT) : text
  const withoutOversizedImages = boundedText.replace(DATA_IMAGE_MARKDOWN_RE, (_match, alt: string, url: string) => {
    if (url.length <= MARKDOWN_DATA_IMAGE_CHAR_LIMIT) return _match
    return alt || "[image omitted]"
  })
  const source = clipped ? `${withoutOversizedImages}${RENDER_CLIP_NOTICE}` : withoutOversizedImages
  const cacheKey = `${localeTag()}\u0000${source}`
  const cached = markdownRenderCache.get(cacheKey)
  if (cached !== undefined) {
    markdownRenderCache.delete(cacheKey)
    markdownRenderCache.set(cacheKey, cached)
    return cached
  }
  const rendered = marked.parse(source) as string
  markdownRenderCache.set(cacheKey, rendered)
  if (markdownRenderCache.size > MARKDOWN_RENDER_CACHE_LIMIT) {
    const oldest = markdownRenderCache.keys().next().value
    if (typeof oldest === "string") markdownRenderCache.delete(oldest)
  }
  return rendered
}

export function cancelMarkdownRenderPrewarm(): void {
  markdownPrewarmEpoch += 1
  if (typeof window !== "undefined" && markdownPrewarmAnimationHandle !== null) {
    window.cancelAnimationFrame(markdownPrewarmAnimationHandle)
  }
  if (markdownPrewarmTimer !== null) clearTimeout(markdownPrewarmTimer)
  markdownPrewarmAnimationHandle = null
  markdownPrewarmTimer = null
}

export function prewarmMarkdownRenderCache(sources: readonly string[]): void {
  if (typeof window === "undefined") return
  cancelMarkdownRenderPrewarm()
  const unique: string[] = []
  const seen = new Set<string>()
  for (const item of sources) {
    const source = String(item || "")
    if (source.length > MARKDOWN_PREWARM_SOURCE_CHAR_LIMIT || !source.trim() || seen.has(source)) continue
    seen.add(source)
    unique.push(source)
    if (unique.length >= MARKDOWN_RENDER_CACHE_LIMIT) break
  }
  const epoch = ++markdownPrewarmEpoch
  let index = 0
  const runAfterPaint = () => {
    if (epoch !== markdownPrewarmEpoch) return
    renderMarkdown(unique[index]!)
    index += 1
    if (index < unique.length) scheduleNext()
  }
  const scheduleNext = () => {
    markdownPrewarmAnimationHandle = window.requestAnimationFrame(() => {
      markdownPrewarmAnimationHandle = null
      markdownPrewarmTimer = setTimeout(() => {
        markdownPrewarmTimer = null
        runAfterPaint()
      }, 0)
    })
  }
  if (unique.length > 0) scheduleNext()
}

/** Alias for renderMarkdown — used by some callers. */
export function renderMarkdownBlock(text: string): string {
  return renderMarkdown(text)
}

// ── Code block rendering for tool outputs ──

export function renderCodeBlock(
  content: string,
  lang: string,
  maxLines = CODE_BLOCK_RENDER_LINE_LIMIT,
): { html: string; truncated: boolean; totalLines: number } {
  const lines = content.split("\n")
  const requestedLineLimit = Number.isFinite(maxLines)
    ? Math.max(0, Math.floor(maxLines))
    : CODE_BLOCK_RENDER_LINE_LIMIT
  const lineLimit = Math.min(requestedLineLimit, CODE_BLOCK_RENDER_LINE_LIMIT)
  let clipped = lines.slice(0, lineLimit).join("\n")
  let truncated = lines.length > lineLimit
  if (clipped.length > CODE_BLOCK_RENDER_CHAR_LIMIT) {
    clipped = clipped.slice(0, CODE_BLOCK_RENDER_CHAR_LIMIT)
    truncated = true
  }
  const displayed = truncated ? `${clipped}${RENDER_CLIP_NOTICE}` : clipped
  const html = renderMarkdown("```" + lang + "\n" + displayed + "\n```")
  return { html, truncated, totalLines: lines.length }
}
