#!/usr/bin/env node
/**
 * Audit ALL mdx files: drop duplicated lead paragraph that repeats
 * frontmatter `description:`.
 *
 * Algorithm:
 *  1) Parse frontmatter; extract description value.
 *  2) Walk body; skip blank lines, `import ...` lines.
 *  3) First non-skip line: if it's a `> ...` blockquote OR a plain paragraph,
 *     compare its normalized text to description. If similar, delete that
 *     element (paragraph = until next blank line; blockquote = consecutive `>` lines).
 */

const fs = require("fs")
const path = require("path")

const ROOT = path.join(__dirname, "..", "src", "content", "docs")

function listMdx(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) out.push(...listMdx(p))
    else if (e.isFile() && e.name.endsWith(".mdx")) out.push(p)
  }
  return out
}

function parseFrontmatter(text) {
  if (!text.startsWith("---")) return null
  const end = text.indexOf("\n---", 3)
  if (end < 0) return null
  const fm = text.slice(3, end).trim()
  const bodyStart = end + 4 // past "\n---"
  // skip following newline
  let body = text.slice(bodyStart)
  if (body.startsWith("\n")) body = body.slice(1)
  // crude YAML: find description: value (single-line or quoted)
  const lines = fm.split("\n")
  let description = null
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^description:\s*(.*)$/)
    if (m) {
      let v = m[1].trim()
      // strip wrapping quotes
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      // handle YAML folded/literal block scalars (>- | etc.)
      if (v === ">-" || v === ">" || v === "|" || v === "|-") {
        // gather following indented lines
        const collected = []
        for (let j = i + 1; j < lines.length; j++) {
          if (/^\s+\S/.test(lines[j])) collected.push(lines[j].trim())
          else break
        }
        v = collected.join(" ")
      }
      description = v
      break
    }
  }
  return { description, fmEndIndex: bodyStart, body }
}

function normalize(s) {
  return s
    .toLowerCase()
    .replace(/[\s　]+/g, " ")
    .replace(/[\.,;:!?。，；：！？"'`*_()\[\]{}<>\-]/g, "")
    .trim()
}

// Levenshtein-ratio similarity for short strings.
function similarity(a, b) {
  if (!a || !b) return 0
  if (a === b) return 1
  const al = a.length,
    bl = b.length
  const m = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0))
  for (let i = 0; i <= al; i++) m[i][0] = i
  for (let j = 0; j <= bl; j++) m[0][j] = j
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost)
    }
  }
  const dist = m[al][bl]
  const max = Math.max(al, bl)
  return 1 - dist / max
}

function isSubstantiallySame(desc, paragraph) {
  const a = normalize(desc)
  const b = normalize(paragraph)
  if (!a || !b) return false
  // exact-or-near after normalization
  if (a === b) return true
  // one contains the other AND lengths are close
  const minLen = Math.min(a.length, b.length)
  const maxLen = Math.max(a.length, b.length)
  if (minLen / maxLen >= 0.6) {
    if (a.includes(b) || b.includes(a)) return true
    if (similarity(a, b) >= 0.75) return true
  }
  return false
}

function dedupeBody(description, body) {
  if (!description) return { changed: false, body, dropped: null }

  const lines = body.split("\n")
  let i = 0

  // Skip leading blank lines and import statements (they're a unit at top)
  while (i < lines.length) {
    const l = lines[i]
    if (l.trim() === "") {
      i++
      continue
    }
    if (/^import\s.+from\s+['"].+['"];?\s*$/.test(l.trim())) {
      i++
      continue
    }
    if (/^import\s+['"].+['"];?\s*$/.test(l.trim())) {
      i++
      continue
    }
    break
  }

  if (i >= lines.length) return { changed: false, body, dropped: null }

  const startBlock = i
  const firstLine = lines[i]
  const trimmed = firstLine.trim()

  // Don't touch headings, code blocks, admonitions, JSX components, tables, lists
  if (trimmed.startsWith("#")) return { changed: false, body, dropped: null }
  if (trimmed.startsWith("```")) return { changed: false, body, dropped: null }
  if (trimmed.startsWith(":::")) return { changed: false, body, dropped: null }
  if (trimmed.startsWith("<")) return { changed: false, body, dropped: null }
  if (trimmed.startsWith("|")) return { changed: false, body, dropped: null }
  if (/^[-*+]\s/.test(trimmed)) return { changed: false, body, dropped: null }
  if (/^\d+\.\s/.test(trimmed)) return { changed: false, body, dropped: null }

  // Blockquote: gather consecutive `>` lines
  if (trimmed.startsWith(">")) {
    const quoteLines = []
    let j = i
    while (j < lines.length && lines[j].trim().startsWith(">")) {
      quoteLines.push(lines[j].trim().replace(/^>\s?/, ""))
      j++
    }
    const quoteText = quoteLines.join(" ").trim()
    if (isSubstantiallySame(description, quoteText)) {
      // drop lines [i..j), and also a single trailing blank line if present
      let end = j
      if (end < lines.length && lines[end].trim() === "") end++
      const newLines = lines.slice(0, i).concat(lines.slice(end))
      return { changed: true, body: newLines.join("\n"), dropped: quoteText }
    }
    return { changed: false, body, dropped: null }
  }

  // Plain paragraph: gather until blank line
  const paraLines = []
  let j = i
  while (j < lines.length && lines[j].trim() !== "") {
    paraLines.push(lines[j])
    j++
  }
  const paraText = paraLines.join(" ").trim()
  if (isSubstantiallySame(description, paraText)) {
    let end = j
    if (end < lines.length && lines[end].trim() === "") end++
    const newLines = lines.slice(0, i).concat(lines.slice(end))
    return { changed: true, body: newLines.join("\n"), dropped: paraText }
  }
  return { changed: false, body, dropped: null }
}

function main() {
  const files = listMdx(ROOT)
  const dryRun = process.argv.includes("--dry")
  const verbose = process.argv.includes("-v")
  const edits = []
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8")
    const fm = parseFrontmatter(text)
    if (!fm) continue
    const { changed, body, dropped } = dedupeBody(fm.description, fm.body)
    if (!changed) continue
    edits.push({ file, description: fm.description, dropped })
    if (!dryRun) {
      // reconstruct: original frontmatter block + new body
      const head = text.slice(0, fm.fmEndIndex)
      // ensure exactly one newline between fm and body (mirror original convention)
      const rebuilt = head + (head.endsWith("\n") ? "" : "\n") + body
      fs.writeFileSync(file, rebuilt)
    }
    if (verbose) {
      console.log("---", path.relative(ROOT, file))
      console.log("DESC:   ", fm.description)
      console.log("DROPPED:", dropped)
    }
  }
  // summarize
  const byLang = { en: 0, "zh-cn": 0 }
  const bySection = {}
  for (const e of edits) {
    const rel = path.relative(ROOT, e.file).replace(/\\/g, "/")
    const lang = rel.startsWith("zh-cn/") ? "zh-cn" : "en"
    byLang[lang]++
    const after = lang === "zh-cn" ? rel.slice("zh-cn/".length) : rel
    const section = after.includes("/") ? after.split("/")[0] : "(root)"
    const key = `${lang}/${section}`
    bySection[key] = (bySection[key] || 0) + 1
  }
  console.log(
    JSON.stringify(
      {
        total: edits.length,
        byLang,
        bySection,
        files: edits.map((e) => path.relative(ROOT, e.file).replace(/\\/g, "/")),
      },
      null,
      2,
    ),
  )
}

main()
