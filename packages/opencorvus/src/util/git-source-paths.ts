import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"
import { NamedError } from "@opencorvus-ai/util/error"
import { Filesystem } from "./filesystem"
import { hostGit, type GitResult } from "./git"

export const GitSourceEnumerationError = NamedError.create(
  "GitSourceEnumerationError",
  z.object({
    reason: z.enum(["git_failure", "protocol_error", "linked_ancestor", "entry_changed", "unsupported_entry"]),
    path: z.string(),
    message: z.string(),
  }),
)

type Runner = (args: string[], input?: AsyncIterable<Uint8Array>) => Promise<GitResult>

function fail(
  reason: z.infer<typeof GitSourceEnumerationError.Schema>["data"]["reason"],
  pathname: string,
  message: string,
): never {
  throw new GitSourceEnumerationError({ reason, path: pathname, message })
}

function records(result: GitResult, label: string): string[] {
  if (result.stdout.length === 0) return []
  if (result.stdout.at(-1) !== 0) fail("protocol_error", label, `${label} returned an unterminated NUL record`)
  return result.stdout.subarray(0, -1).toString().split("\0")
}

async function checked(run: Runner, args: string[], input?: AsyncIterable<Uint8Array>) {
  const result = await run(args, input)
  if (result.exitCode !== 0)
    fail("git_failure", args[0]!, result.stderr.toString().trim() || `Git ${args[0]} exited ${result.exitCode}`)
  return result
}

function relativePath(value: string): string {
  const pathname = value.endsWith("/") ? value.slice(0, -1) : value
  if (
    !pathname ||
    path.isAbsolute(pathname) ||
    pathname.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    fail("protocol_error", value, "Git source enumeration returned an invalid relative path")
  }
  if (process.platform === "win32" && pathname.includes("\\")) {
    fail("protocol_error", value, "Git source enumeration returned a non-canonical Windows path")
  }
  return pathname
}

async function assertAncestors(root: string, pathname: string, inspected: Set<string>) {
  const parts = pathname.split("/")
  for (let index = 1; index < parts.length; index++) {
    const ancestor = parts.slice(0, index).join("/")
    if (inspected.has(ancestor)) continue
    let stat
    try {
      stat = await fs.lstat(path.join(root, ancestor))
    } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) return
      throw error
    }
    if (stat.isSymbolicLink()) fail("linked_ancestor", pathname, `Git source path ${pathname} crosses link ${ancestor}`)
    inspected.add(ancestor)
  }
}

async function included(run: Runner, candidates: string[], root: string) {
  if (candidates.length === 0) return []
  // Absolute input keeps the path meaning correct for Engine Git's external
  // git-dir and work-tree. NUL input preserves whitespace and Git metacharacters.
  const inputs = candidates.map(
    (value) => path.resolve(root, value).replaceAll(path.sep, "/") + (value.endsWith("/") ? "/" : ""),
  )
  async function* input() {
    for (const value of inputs) yield Buffer.from(value + "\0")
  }
  const result = await run(["check-ignore", "--no-index", "--verbose", "--non-matching", "-z", "--stdin"], input())
  if (result.exitCode !== 0 && result.exitCode !== 1) {
    fail("git_failure", root, result.stderr.toString().trim() || `Git check-ignore exited ${result.exitCode}`)
  }
  const fields = records(result, "Git check-ignore")
  if (fields.length !== inputs.length * 4)
    fail("protocol_error", root, "Git check-ignore returned an incomplete path projection")
  return candidates.filter((_, index) => {
    const [source, line, pattern, pathname] = fields.slice(index * 4, index * 4 + 4)
    if (pathname !== inputs[index])
      fail("protocol_error", pathname ?? root, "Git check-ignore returned a different input path")
    if (!source && !line && !pattern) return true
    if (!source || !/^\d+$/.test(line ?? "") || !pattern)
      fail("protocol_error", pathname, "Git check-ignore returned an invalid rule")
    return pattern.startsWith("!")
  })
}

/** One physical entry enumeration, with the caller's index and Git ignore rules. */
export async function gitSourceIndexEntries(run: Runner) {
  const result = await checked(run, ["ls-files", "--stage", "-z", "--", "."])
  return records(result, "Git index entries").map((record) => {
    const separator = record.indexOf("\t")
    const [mode, object, stage] = record.slice(0, separator).split(" ")
    if (
      separator < 0 ||
      !/^[0-7]{6}$/.test(mode ?? "") ||
      !/^[a-f0-9]{40,64}$/.test(object ?? "") ||
      !/^[0-3]$/.test(stage ?? "")
    )
      fail("protocol_error", record, "Git index returned an invalid stage entry")
    return { mode: mode!, object: object!, stage: Number(stage), pathname: relativePath(record.slice(separator + 1)) }
  })
}

export async function gitSourcePaths(
  root: string,
  run: Runner = (args, input) => hostGit(args, { cwd: root, input, timeoutProfile: "default" }),
) {
  const indexed = await gitSourceIndexEntries(run)
  const tracked = [...new Set(indexed.map((entry) => entry.pathname))].sort()
  const inspected = new Set<string>()
  for (const pathname of tracked) await assertAncestors(root, pathname, inspected)
  const other = await checked(run, ["ls-files", "--others", "--exclude-standard", "--directory", "-z", "--", "."])
  const trackedSet = new Set(tracked)
  const untracked = new Set<string>()
  const gitlinks = new Set(indexed.filter((entry) => entry.mode === "160000").map((entry) => entry.pathname))
  const replacedDirectories: string[] = []
  for (const pathname of tracked) {
    if (gitlinks.has(pathname)) continue
    const entry = await fs.lstat(path.join(root, pathname)).catch((error: NodeJS.ErrnoException) => {
      if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return undefined
      throw error
    })
    if (entry?.isDirectory() && !entry.isSymbolicLink() && !Filesystem.isGitRepo(path.join(root, pathname)))
      replacedDirectories.push(pathname)
  }

  async function visit(pathname: string, candidates: string[]) {
    await assertAncestors(root, pathname, inspected)
    const absolute = path.join(root, pathname)
    const before = await fs.lstat(absolute)
    if (before.isSymbolicLink() || before.isFile()) {
      if (!trackedSet.has(pathname)) untracked.add(pathname)
      return
    }
    if (!before.isDirectory())
      fail("unsupported_entry", pathname, `Git source entry ${pathname} is not a file, link or directory`)
    if (gitlinks.has(pathname)) return
    if (pathname && Filesystem.isGitRepo(absolute)) {
      if (!trackedSet.has(pathname)) untracked.add(pathname)
      return
    }
    const children = await fs.readdir(absolute, { withFileTypes: true })
    const after = await fs.lstat(absolute)
    if (after.isSymbolicLink() || !after.isDirectory() || before.dev !== after.dev || before.ino !== after.ino) {
      fail("entry_changed", pathname, `Git source directory ${pathname} changed during enumeration`)
    }
    candidates.push(
      ...children
        .filter((entry) => entry.name !== ".git")
        .map(
          (entry) =>
            `${pathname ? pathname + "/" : ""}${entry.name}${entry.isDirectory() && !entry.isSymbolicLink() ? "/" : ""}`,
        ),
    )
  }

  // In a subdirectory Git can aggregate all new entries as the current ./ boundary.
  // The empty traversal prefix is internal; returned source paths remain canonical.
  let pending = [
    ...new Set([
      ...records(other, "Git other paths").map((value) => (value === "./" ? "" : relativePath(value))),
      ...replacedDirectories,
    ]),
  ]
  while (pending.length > 0) {
    const candidates: string[] = []
    for (const pathname of pending) await visit(pathname, candidates)
    pending = [...new Set((await included(run, candidates, root)).map(relativePath))]
  }
  const others = [...untracked].sort()
  return { tracked, untracked: others, paths: [...new Set([...tracked, ...others])].sort() }
}
