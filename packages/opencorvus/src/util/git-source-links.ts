import fs from "node:fs/promises"
import path from "node:path"
import { isUtf8 } from "node:buffer"
import { formatPatch, structuredPatch } from "diff"
import { gitSourcePaths, gitSourceIndexEntries } from "./git-source-paths"
import { checkedSourceGit, gitSourceRunner, gitSourceEntryArgs, type GitSourceOptions } from "./git-source-stage"

export type GitSourceLinkDiff = {
  changed: boolean
  status: "added" | "deleted" | "modified"
  code: string
  stat: { additions: number; deletions: number; binary: boolean }
  patch?: string
}

function nulRecords(bytes: Buffer) {
  if (bytes.length === 0) return []
  if (bytes.at(-1) !== 0) throw new Error("Git source link projection returned an unterminated NUL record")
  return bytes.subarray(0, -1).toString().split("\0")
}

/** Compare link entry bytes against the actual index or ref, never the target tree. */
export async function gitSourceLinkDiffs(options: GitSourceOptions, ref: string = "index", context = 2_147_483_647) {
  const run = gitSourceRunner(options)
  const [source, indexed, projected] = await Promise.all([
    gitSourcePaths(options.cwd, run),
    ref === "index" ? gitSourceIndexEntries(run) : Promise.resolve([]),
    ref === "index" ? Promise.resolve(undefined) : checkedSourceGit(run, ["ls-tree", "-r", "-z", ref, "--", "."]),
  ])
  const entries = new Map<string, { mode: string; object: string }>()
  const conflicts = new Set<string>()
  for (const entry of indexed) {
    if (entry.stage !== 0) {
      conflicts.add(entry.pathname)
      continue
    }
    entries.set(entry.pathname, { mode: entry.mode, object: entry.object })
  }
  for (const record of projected ? nulRecords(projected.stdout) : []) {
    const tab = record.indexOf("\t")
    const [mode, type, object] = record.slice(0, tab).split(" ")
    const pathname = record.slice(tab + 1)
    if (tab < 0 || !mode || !type || !object || !pathname)
      throw new Error("Git source link projection returned an invalid tree entry")
    entries.set(pathname, { mode, object })
  }
  const candidates = [
    ...new Set([
      ...source.paths,
      ...[...entries].filter(([, entry]) => entry.mode === "120000").map(([pathname]) => pathname),
    ]),
  ]
  const result = new Map<string, GitSourceLinkDiff>()
  for (const pathname of candidates) {
    if (conflicts.has(pathname)) continue
    const entry = await fs.lstat(path.join(options.cwd, pathname)).catch((error: NodeJS.ErrnoException) => {
      if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return undefined
      throw error
    })
    const before = entries.get(pathname)
    if (!entry?.isSymbolicLink() && !(before?.mode === "120000" && !entry)) continue
    const previous =
      before && before.mode !== "160000"
        ? (await checkedSourceGit(run, ["cat-file", "blob", before.object])).stdout
        : Buffer.alloc(0)
    const current = entry?.isSymbolicLink()
      ? await fs.readlink(path.join(options.cwd, pathname), { encoding: "buffer" })
      : Buffer.alloc(0)
    const changed = before?.mode !== (entry ? "120000" : undefined) || !previous.equals(current)
    const code = !before ? "A" : !entry ? "D" : before.mode === "120000" ? "M" : "T"
    const status = code === "A" ? "added" : code === "D" ? "deleted" : "modified"
    const binary = !isUtf8(previous) || !isUtf8(current)
    const patch = binary
      ? undefined
      : structuredPatch(
          before ? pathname : "/dev/null",
          entry ? pathname : "/dev/null",
          previous.toString(),
          current.toString(),
          undefined,
          undefined,
          { context },
        )
    const stat = { additions: 0, deletions: 0, binary }
    for (const hunk of patch?.hunks ?? [])
      for (const line of hunk.lines) {
        if (line.startsWith("+")) stat.additions++
        if (line.startsWith("-")) stat.deletions++
      }
    const mode =
      before?.mode === (entry ? "120000" : undefined)
        ? ""
        : !before
          ? "new file mode 120000\n"
          : !entry
            ? "deleted file mode 120000\n"
            : `old mode ${before.mode}\nnew mode 120000\n`
    result.set(pathname, { changed, code, status, stat, ...(patch ? { patch: mode + formatPatch(patch) } : {}) })
  }
  return result
}

/** Preserve index status and conflicts; correct only link working-entry comparisons. */
export function normalizeGitSourceLinkStatus(text: string, links: Map<string, GitSourceLinkDiff>) {
  const records = nulRecords(Buffer.from(text))
  const output: string[] = []
  for (let index = 0; index < records.length; index++) {
    let record = records[index]!
    if (record.startsWith("## ")) {
      output.push(record)
      continue
    }
    const x = record[0],
      y = record[1]
    const rename = x === "R" || x === "C" || y === "R" || y === "C"
    const link = links.get(record.slice(3))
    const conflict = x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D")
    if (link && !conflict && x !== "?" && y !== "R" && y !== "C") {
      record = `${x}${link.changed ? link.code : " "} ${record.slice(3)}`
    }
    if (record.slice(0, 2) !== "  ") output.push(record)
    if (rename) {
      const previous = records[++index]
      if (!previous) throw new Error("Git status returned an incomplete rename pair")
      output.push(previous)
    }
  }
  return output.length ? output.join("\0") + "\0" : ""
}

/** Native porcelain shape, finite untracked entries and physical link comparison. */
export async function gitSourceStatus(options: GitSourceOptions, format: "nul" | "lines" = "nul") {
  const run = gitSourceRunner(options)
  const [native, source, links] = await Promise.all([
    checkedSourceGit(run, gitSourceEntryArgs(["status", "--porcelain=v1", "-z", "--untracked-files=no"])),
    gitSourcePaths(options.cwd, run),
    gitSourceLinkDiffs(options),
  ])
  const normalized = normalizeGitSourceLinkStatus(native.text(), links)
  const records = [...nulRecords(Buffer.from(normalized)), ...source.untracked.map((pathname) => `?? ${pathname}`)]
  let text: string
  if (format === "nul") text = records.length ? records.join("\0") + "\0" : ""
  else {
    const quote = (pathname: string) => (/[\x00-\x1f\x7f"\\]/.test(pathname) ? JSON.stringify(pathname) : pathname)
    const lines: string[] = []
    for (let index = 0; index < records.length; index++) {
      const record = records[index]!
      const rename = record[0] === "R" || record[0] === "C" || record[1] === "R" || record[1] === "C"
      const previous = rename ? records[++index] : undefined
      if (rename && !previous) throw new Error("Git source status returned an incomplete rename pair")
      lines.push(record.slice(0, 3) + (previous ? `${quote(previous)} -> ` : "") + quote(record.slice(3)))
    }
    text = lines.length ? lines.join("\n") + "\n" : ""
  }
  return { ...native, stdout: Buffer.from(text), text: () => text }
}
