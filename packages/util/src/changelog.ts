export const CHANGELOG_LOCALES = ["zh-CN", "en-US"] as const
export type ChangelogLocale = (typeof CHANGELOG_LOCALES)[number]

export type ChangelogEntry = {
  version: string
  displayVersion: string
  date: string
  notes: Record<ChangelogLocale, string>
}

export class ChangelogError extends Error {
  constructor(
    readonly code: "changelog_invalid" | "changelog_duplicate_version" | "release_notes_missing" | "release_notes_locale_missing",
    message: string,
  ) {
    super(message)
    this.name = "ChangelogError"
  }
}

function versionParts(value: string) {
  const match = value
    .replace(/^v/, "")
    .match(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-?beta(?:\.(0|[1-9]\d*))?)?$/)
  if (!match) throw new ChangelogError("changelog_invalid", `Invalid changelog version: ${value}`)
  const beta = value.includes("beta")
  const version = `${match[1]}.${match[2]}.${match[3]}${beta ? `-beta${match[4] === undefined ? "" : `.${match[4]}`}` : ""}`
  return {
    version,
    order: [
      Number(match[1]),
      Number(match[2]),
      Number(match[3]),
      beta ? 0 : 1,
      match[4] === undefined ? -1 : Number(match[4]),
    ],
  }
}

export function compareChangelogVersions(a: string, b: string) {
  const left = versionParts(a).order
  const right = versionParts(b).order
  for (let index = 0; index < left.length; index++) {
    const difference = left[index]! - right[index]!
    if (difference) return difference
  }
  return 0
}

function localizedNotes(body: string, version: string): Record<ChangelogLocale, string> {
  const sections = new Map<ChangelogLocale, string[]>()
  let current: string[] | undefined
  let fence: { marker: string; length: number } | undefined
  for (const line of body.split("\n")) {
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (boundary) {
      const marker = boundary[1]![0]!
      const length = boundary[1]!.length
      if (!fence) fence = { marker, length }
      else if (fence.marker === marker && length >= fence.length) fence = undefined
    } else if (!fence && line.startsWith("### ")) {
      const locale = line.slice(4).trim() as ChangelogLocale
      if (!CHANGELOG_LOCALES.includes(locale) || sections.has(locale))
        throw new ChangelogError("changelog_invalid", `Invalid or duplicate changelog language for ${version}: ${locale}`)
      current = []
      sections.set(locale, current)
      continue
    }
    if (current) current.push(line)
    else if (line.trim())
      throw new ChangelogError("changelog_invalid", `Changelog ${version} content requires an explicit language section`)
  }
  const notes = {} as Record<ChangelogLocale, string>
  for (const locale of CHANGELOG_LOCALES) {
    const lines = sections.get(locale)
    if (!lines)
      throw new ChangelogError("release_notes_locale_missing", `Written ${locale} release notes are required for ${version}`)
    const text = lines.join("\n").trim()
    if (!text.split("\n").some((line) => line.trim() && !line.startsWith("#") && !line.startsWith("<!--")))
      throw new ChangelogError("changelog_invalid", `Changelog ${version} requires written ${locale} change entries`)
    notes[locale] = text
  }
  return notes
}

export function parseChangelog(markdown: string): ChangelogEntry[] {
  const sections: string[] = []
  let section: string[] | undefined
  let fence: { marker: string; length: number } | undefined
  for (const line of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (boundary) {
      const marker = boundary[1]![0]!
      const length = boundary[1]!.length
      if (!fence) fence = { marker, length }
      else if (fence.marker === marker && length >= fence.length) fence = undefined
      section?.push(line)
      continue
    }
    if (!fence && line.startsWith("## ")) {
      if (section) sections.push(section.join("\n"))
      section = [line.slice(3)]
    } else section?.push(line)
  }
  if (section) sections.push(section.join("\n"))
  const seen = new Set<string>()
  const entries = sections.flatMap((section) => {
    const [heading, ...lines] = section.split("\n")
    if (heading?.trim() === "未发布") return []
    const match = heading?.match(/^(\S+) - (\d{4}-\d{2}-\d{2})\s*$/)
    if (!match) throw new ChangelogError("changelog_invalid", `Invalid dated changelog heading: ${heading}`)
    const version = versionParts(match[1]!).version
    if (seen.has(version))
      throw new ChangelogError("changelog_duplicate_version", `Duplicate changelog version: ${version}`)
    seen.add(version)
    const date = match[2]!
    const parsed = new Date(`${date}T00:00:00Z`)
    if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new ChangelogError("changelog_invalid", `Invalid changelog date: ${date}`)
    }
    return [{ version, displayVersion: match[1]!, date, notes: localizedNotes(lines.join("\n"), version) }]
  })
  return entries.sort((a, b) => compareChangelogVersions(b.version, a.version))
}

export function requireReleaseNotes(entries: readonly ChangelogEntry[], version: string): ChangelogEntry {
  const normalized = versionParts(version).version
  const entry = entries.find((candidate) => candidate.version === normalized)
  if (!entry) throw new ChangelogError("release_notes_missing", `Written release notes are required for ${normalized}`)
  return entry
}

/** Project the language body beneath a standalone version heading, preserving
 * literal code examples. The source and bilingual publication keep their full hierarchy. */
export function standaloneReleaseNotes(entry: ChangelogEntry, locale: ChangelogLocale): string {
  let fence: { marker: string; length: number } | undefined
  return entry.notes[locale].split("\n").map((line) => {
    const boundary = line.match(/^ {0,3}(`{3,}|~{3,})/)
    if (boundary) {
      const marker = boundary[1]![0]!
      const length = boundary[1]!.length
      if (!fence) fence = { marker, length }
      else if (fence.marker === marker && length >= fence.length) fence = undefined
    } else if (!fence && /^#{4,6} /.test(line)) return line.slice(1)
    return line
  }).join("\n")
}

export function renderReleaseNotes(entry: ChangelogEntry): string {
  return `## ${entry.displayVersion} - ${entry.date}\n\n### 简体中文\n\n${entry.notes["zh-CN"]}\n\n[完整版本历史](https://opencorvus.com/zh-cn/changelog/${entry.version}/)\n\n### English\n\n${entry.notes["en-US"]}\n\n[Version history](https://opencorvus.com/changelog/${entry.version}/)`
}
