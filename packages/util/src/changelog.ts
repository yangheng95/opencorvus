export type ChangelogEntry = {
  version: string
  displayVersion: string
  date: string
  markdown: string
}

export class ChangelogError extends Error {
  constructor(
    readonly code: "changelog_invalid" | "changelog_duplicate_version" | "release_notes_missing",
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
    const body = lines.join("\n").trim()
    if (!body.split("\n").some((line) => line.trim() && !line.startsWith("#") && !line.startsWith("<!--"))) {
      throw new ChangelogError("changelog_invalid", `Changelog ${version} requires written change entries`)
    }
    return [{ version, displayVersion: match[1]!, date, markdown: body }]
  })
  return entries.sort((a, b) => compareChangelogVersions(b.version, a.version))
}

export function requireReleaseNotes(entries: readonly ChangelogEntry[], version: string): ChangelogEntry {
  const normalized = versionParts(version).version
  const entry = entries.find((candidate) => candidate.version === normalized)
  if (!entry) throw new ChangelogError("release_notes_missing", `Written release notes are required for ${normalized}`)
  return entry
}

export function renderReleaseNotes(entry: ChangelogEntry): string {
  return `## ${entry.displayVersion} - ${entry.date}\n\n${entry.markdown}\n\n[完整版本历史 / Version history](https://opencorvus.com/zh-cn/changelog/${entry.version}/)`
}
