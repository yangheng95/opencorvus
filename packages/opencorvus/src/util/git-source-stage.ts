import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { hostGit, type GitOptions, type GitResult } from "./git"
import { gitSourcePaths, gitSourceIndexEntries } from "./git-source-paths"
import { Filesystem } from "./filesystem"
import {
  installGitIndexLock,
  prepareGitIndexLock,
  readOptionalGitIndex,
  removeOwnedGitIndexLock,
  type OwnedGitIndexLock,
} from "./git-index-lock"

type Runner = (args: string[], options: GitOptions) => Promise<GitResult>

/** Physical entry operations do not interpret regular files as symlink placeholders. */
export function gitSourceEntryArgs(args: string[]) {
  return ["-c", "core.symlinks=true", ...args]
}

export function gitSourceEntryGit(args: string[], options: GitOptions) {
  return hostGit(gitSourceEntryArgs(args), options)
}

export type GitSourceOptions = GitOptions & { prefix?: string[]; run?: Runner }

export function gitSourceRunner(options: GitSourceOptions, indexFile?: string) {
  const { prefix = [], run = hostGit, ...opts } = options
  return (args: string[], input?: AsyncIterable<Uint8Array>) =>
    run([...prefix, ...args], {
      ...opts,
      input,
      ...(indexFile ? { env: { ...opts.env, GIT_INDEX_FILE: indexFile } } : {}),
    })
}

export async function checkedSourceGit(
  run: ReturnType<typeof gitSourceRunner>,
  args: string[],
  input?: AsyncIterable<Uint8Array>,
) {
  const result = await run(args, input)
  if (result.exitCode !== 0)
    throw new Error(`git ${args[0]} failed: ${result.stderr.toString().trim() || result.exitCode}`)
  return result
}

export async function* gitSourceInput(bytes: Uint8Array) {
  yield bytes
}

/** Preserve native file filters while staging terminal links as raw 120000 entries. */
export async function stageGitSourceEntries(options: GitSourceOptions) {
  const current = gitSourceRunner(options)
  const indexPath = (await checkedSourceGit(current, ["rev-parse", "--path-format=absolute", "--git-path", "index"]))
    .text()
    .replace(/\n$/, "")
  const prefix = (await checkedSourceGit(current, ["rev-parse", "--show-prefix"])).text().replace(/\n$/, "")
  const predecessor = await readOptionalGitIndex(indexPath)
  const temporary = await Global.createTemporaryDirectory("git-source-stage-")
  if (path.dirname(path.resolve(temporary)) !== path.resolve(Global.Path.temporary))
    throw new Error(`Git staging temporary directory escaped its owner: ${temporary}`)
  const preparedIndex = path.join(temporary, "index")
  let lock: OwnedGitIndexLock | undefined
  try {
    const run = gitSourceRunner(options, preparedIndex)
    if (predecessor) await fs.writeFile(preparedIndex, predecessor)
    else await checkedSourceGit(run, ["read-tree", "--empty"])
    const source = await gitSourcePaths(options.cwd, run)
    const gitlinks = new Set(
      (await gitSourceIndexEntries(run)).filter((entry) => entry.mode === "160000").map((entry) => entry.pathname),
    )
    const ordinary: string[] = []
    const directoryReplacements: string[] = []
    const links: { pathname: string; bytes: Buffer; device: bigint; inode: bigint }[] = []
    for (const pathname of source.paths) {
      const entry = await fs
        .lstat(path.join(options.cwd, pathname), { bigint: true })
        .catch((error: NodeJS.ErrnoException) => {
          if (["ENOENT", "ENOTDIR"].includes(error.code ?? "")) return undefined
          throw error
        })
      if (entry?.isSymbolicLink()) {
        links.push({
          pathname,
          bytes: await fs.readlink(path.join(options.cwd, pathname), { encoding: "buffer" }),
          device: entry.dev,
          inode: entry.ino,
        })
      } else if (
        entry?.isDirectory() &&
        gitlinks.has(pathname) &&
        !Filesystem.isGitRepo(path.join(options.cwd, pathname))
      ) {
        // An uninitialized gitlink retains its existing commit identity in the parent index.
        continue
      } else if (
        entry?.isDirectory() &&
        !gitlinks.has(pathname) &&
        !Filesystem.isGitRepo(path.join(options.cwd, pathname))
      ) {
        if (source.tracked.includes(pathname)) directoryReplacements.push(pathname)
        else throw new Error(`Git source enumeration returned an ordinary directory: ${pathname}`)
      } else ordinary.push(pathname)
    }
    if (directoryReplacements.length)
      await checkedSourceGit(
        run,
        ["update-index", "--force-remove", "-z", "--stdin"],
        gitSourceInput(Buffer.from(directoryReplacements.map((pathname) => pathname + "\0").join(""))),
      )
    const tracked = new Set(source.tracked)
    // Existing index entries retain their authority when a parent later becomes
    // ignored. Git's update operation stages those entries without treating the
    // literal pathspec as a request to add ignored new content.
    for (const [mode, paths] of [
      ["--update", ordinary.filter((pathname) => tracked.has(pathname))],
      ["--all", ordinary.filter((pathname) => !tracked.has(pathname))],
    ] as const) {
      if (paths.length)
        await checkedSourceGit(
          run,
          gitSourceEntryArgs(["--literal-pathspecs", "add", mode, "--pathspec-from-file=-", "--pathspec-file-nul"]),
          gitSourceInput(Buffer.from(paths.map((pathname) => pathname + "\0").join(""))),
        )
    }
    const records: string[] = []
    for (const link of links) {
      const object = (await checkedSourceGit(run, ["hash-object", "-w", "--stdin"], gitSourceInput(link.bytes)))
        .text()
        .trim()
      if (!/^[a-f0-9]{40,64}$/.test(object)) throw new Error(`Git returned an invalid link object for ${link.pathname}`)
      // The zero-mode record replaces every conflict stage at the exact index path.
      records.push(
        `0 ${"0".repeat(object.length)}\t${prefix}${link.pathname}\0`,
        `120000 ${object}\t${prefix}${link.pathname}\0`,
      )
    }
    if (records.length)
      await checkedSourceGit(run, ["update-index", "-z", "--index-info"], gitSourceInput(Buffer.from(records.join(""))))
    for (const link of links) {
      const filename = path.join(options.cwd, link.pathname)
      const actual = await fs.lstat(filename, { bigint: true })
      if (
        !actual.isSymbolicLink() ||
        actual.dev !== link.device ||
        actual.ino !== link.inode ||
        !(await fs.readlink(filename, { encoding: "buffer" })).equals(link.bytes)
      )
        throw new Error(`Git source link changed during staging: ${link.pathname}`)
    }
    lock = await prepareGitIndexLock({ indexPath, predecessor, preparedIndex, label: options.cwd })
    await installGitIndexLock(lock, indexPath)
    lock = undefined
    return source
  } finally {
    if (lock) await removeOwnedGitIndexLock(lock)
    await removeManagedDirectoryTree(temporary)
  }
}
