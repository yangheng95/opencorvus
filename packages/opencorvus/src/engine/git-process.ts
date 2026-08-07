import { Global } from "@/global"
import { Process } from "@/util/process"
import { GitTimeout, type GitResult, type GitTimeoutProfile, resolveGitTimeoutMs } from "@/util/git"
import { which } from "@/util/which"
import fs from "node:fs/promises"
import path from "node:path"

export type EngineGitRepository = Readonly<{
  workTree: string
  gitDir: string
}>

export type EngineGitIdentity = Readonly<{
  name: string
  email: string
}>

type EngineGitTarget = Readonly<{
  cwd: string
  repository?: EngineGitRepository
  indexFile?: string
  identity?: EngineGitIdentity
  timeoutProfile?: GitTimeoutProfile
}>

const ENGINE_GIT_CONFIG = [
  "--no-pager",
  "-c", "core.longPaths=true",
  "-c", "core.fsmonitor=false",
  "-c", "maintenance.auto=false",
  "-c", "maintenance.autoDetach=false",
  "-c", "gc.auto=0",
  "-c", "gc.autoDetach=false",
  "-c", "commit.gpgSign=false",
  "-c", "diff.external=",
] as const

let runtimePromise: Promise<{
  executable: string
  hooksPath: string
  attributesPath: string
  excludesPath: string
  homePath: string
}> | undefined

async function runtime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const executable = which("git")
      if (!executable) throw new Error("Engine Git requires an installed Git executable")
      const root = path.join(Global.Path.cache, "engine-git-runtime")
      const hooksPath = path.join(root, "empty-hooks")
      const attributesPath = path.join(root, "empty-attributes")
      const excludesPath = path.join(root, "empty-excludes")
      const homePath = path.join(root, "home")
      await Promise.all([fs.mkdir(hooksPath, { recursive: true }), fs.mkdir(homePath, { recursive: true })])
      await Promise.all([
        fs.writeFile(attributesPath, "", { flag: "a" }),
        fs.writeFile(excludesPath, "", { flag: "a" }),
      ])
      const versionEnvironment = Object.fromEntries(
        Object.entries(
          process.platform === "win32"
            ? { SystemRoot: process.env.SystemRoot, COMSPEC: process.env.COMSPEC, PATH: process.env.PATH }
            : { PATH: "/usr/bin:/bin", LANG: "C", LC_ALL: "C" },
        ).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      )
      const version = await Process.runHost([executable, "--version"], {
        exactEnv: versionEnvironment,
        stdin: "ignore",
        nothrow: true,
        inactivityTimeoutMs: GitTimeout.fast,
        inactivityTimeoutMessage: "Engine Git version inspection was inactive",
      })
      const match = /^git version (\d+)\.(\d+)/.exec(version.stdout.toString().trim())
      if (version.code !== 0 || !match || Number(match[1]) < 2 || (Number(match[1]) === 2 && Number(match[2]) < 36)) {
        throw new Error(`Engine Git requires Git 2.36 or newer; found ${version.stdout.toString().trim() || "unavailable"}`)
      }
      return { executable, hooksPath, attributesPath, excludesPath, homePath }
    })()
  }
  return runtimePromise
}

function environment(
  activeRuntime: Awaited<ReturnType<typeof runtime>>,
  options: Pick<EngineGitTarget, "indexFile" | "identity">,
): NodeJS.ProcessEnv {
  const osEnvironment = process.platform === "win32"
    ? {
        SystemRoot: process.env.SystemRoot,
        COMSPEC: process.env.COMSPEC,
        PATHEXT: process.env.PATHEXT,
        TEMP: process.env.TEMP,
        TMP: process.env.TMP,
      }
    : { PATH: "/usr/bin:/bin", TMPDIR: Global.Path.temporary }
  return Object.fromEntries(
    Object.entries({
      ...osEnvironment,
      HOME: activeRuntime.homePath,
      USERPROFILE: activeRuntime.homePath,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_ATTR_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GIT_PAGER: "cat",
      LC_ALL: "C",
      LANG: "C",
      ...(options.indexFile ? { GIT_INDEX_FILE: options.indexFile } : {}),
      ...(options.identity
        ? {
            GIT_AUTHOR_NAME: options.identity.name,
            GIT_AUTHOR_EMAIL: options.identity.email,
            GIT_COMMITTER_NAME: options.identity.name,
            GIT_COMMITTER_EMAIL: options.identity.email,
          }
        : {}),
    }).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}

async function execute(args: readonly string[], target: EngineGitTarget): Promise<GitResult> {
  const activeRuntime = await runtime()
  const fixed = [
    ...ENGINE_GIT_CONFIG,
    ...(target.repository
      ? [`--git-dir=${target.repository.gitDir}`, `--work-tree=${target.repository.workTree}`]
      : []),
    "-c", `core.hooksPath=${activeRuntime.hooksPath}`,
    "-c", `core.attributesFile=${activeRuntime.attributesPath}`,
    "-c", `core.excludesFile=${activeRuntime.excludesPath}`,
  ]
  const timeoutMs = resolveGitTimeoutMs({ timeoutProfile: target.timeoutProfile })
  const result = await Process.runHost([activeRuntime.executable, ...fixed, ...args], {
    cwd: target.cwd,
    exactEnv: environment(activeRuntime, target),
    stdin: "ignore",
    nothrow: true,
    inactivityTimeoutMs: timeoutMs,
    inactivityTimeoutMessage: `Engine Git ${args[0]} was inactive for ${timeoutMs}ms (cwd=${target.cwd})`,
  })
  return {
    exitCode: result.code,
    text: () => result.stdout.toString(),
    stdout: result.stdout,
    stderr: result.stderr,
  }
}

function inRepository(repository: EngineGitRepository): EngineGitTarget {
  return { cwd: repository.workTree, repository }
}

/** Closed Engine Git vocabulary. No caller can append Git global options or choose another subcommand. */
export const EngineGitProcess = {
  absoluteGitDirectory(cwd: string) {
    return execute(["rev-parse", "--absolute-git-dir"], { cwd, timeoutProfile: "fast" })
  },
  commonDirectory(cwd: string) {
    return execute(["rev-parse", "--git-common-dir"], { cwd, timeoutProfile: "fast" })
  },
  indexPath(cwd: string) {
    return execute(["rev-parse", "--git-path", "index"], { cwd, timeoutProfile: "fast" })
  },
  objectFormat(cwd: string) {
    return execute(["rev-parse", "--show-object-format"], { cwd, timeoutProfile: "fast" })
  },
  topLevel(cwd: string) {
    return execute(["rev-parse", "--show-toplevel"], { cwd, timeoutProfile: "fast" })
  },
  directGitlinks(cwd: string) {
    return execute(["ls-files", "--stage", "-z", "--", "."], { cwd })
  },
  head(repository: EngineGitRepository) {
    return execute(["rev-parse", "--verify", "HEAD"], { ...inRepository(repository), timeoutProfile: "fast" })
  },
  commitSubject(repository: EngineGitRepository, ref: string) {
    return execute(["log", "-1", "--pretty=%s", ref], { ...inRepository(repository), timeoutProfile: "fast" })
  },
  symbolicHead(repository: EngineGitRepository) {
    return execute(["symbolic-ref", "-q", "HEAD"], { ...inRepository(repository), timeoutProfile: "fast" })
  },
  symbolicHeadAt(cwd: string) {
    return execute(["symbolic-ref", "-q", "HEAD"], { cwd, timeoutProfile: "fast" })
  },
  unmerged(repository: EngineGitRepository) {
    return execute(["ls-files", "--unmerged", "-z", "--", "."], inRepository(repository))
  },
  snapshotPaths(repository: EngineGitRepository) {
    return execute(
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "."],
      inRepository(repository),
    )
  },
  stageEntries(repository: EngineGitRepository) {
    return execute(["ls-files", "--stage", "-z", "--", "."], inRepository(repository))
  },
  initializeEmptyIndex(repository: EngineGitRepository, indexFile: string) {
    return execute(["read-tree", "--empty"], { ...inRepository(repository), indexFile })
  },
  hashRawBlob(repository: EngineGitRepository, absolutePath: string) {
    return execute(["hash-object", "-w", "--no-filters", "--", absolutePath], inRepository(repository))
  },
  addIndexEntry(
    repository: EngineGitRepository,
    indexFile: string,
    mode: string,
    objectID: string,
    relativePath: string,
  ) {
    return execute(
      ["update-index", "--add", "--cacheinfo", `${mode},${objectID},${relativePath}`],
      { ...inRepository(repository), indexFile },
    )
  },
  writeTree(repository: EngineGitRepository, indexFile: string) {
    return execute(["write-tree"], { ...inRepository(repository), indexFile })
  },
  commitTree(repository: EngineGitRepository, input: {
    tree: string
    parent?: string
    subject: string
    body: string
    identity: EngineGitIdentity
  }) {
    return execute(
      ["commit-tree", input.tree, ...(input.parent ? ["-p", input.parent] : []), "-m", input.subject, "-m", input.body],
      { ...inRepository(repository), identity: input.identity },
    )
  },
  resolveTree(repository: EngineGitRepository, commit: string) {
    return execute(["rev-parse", `${commit}^{tree}`], inRepository(repository))
  },
  compareAndSwapRef(repository: EngineGitRepository, ref: string, next: string, previous: string) {
    return execute(["update-ref", ref, next, previous], inRepository(repository))
  },
  deleteRef(repository: EngineGitRepository, ref: string, previous: string) {
    return execute(["update-ref", "-d", ref, previous], inRepository(repository))
  },
}
