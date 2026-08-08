import { Global } from "@/global"
import { Process } from "@/util/process"
import { GitTimeout, type GitResult, type GitTimeoutProfile, resolveGitTimeoutMs } from "@/util/git"
import { which } from "@/util/which"
import fs from "node:fs/promises"
import path from "node:path"
import { AsyncLocalStorage } from "node:async_hooks"
import type { Stats } from "node:fs"

export type EngineGitRepository = Readonly<{
  workTree: string
  gitDir: string
}>

export type EngineGitIdentity = Readonly<{
  name: string
  email: string
}>

export type EngineGitObjectFormat = "sha1" | "sha256"

export type EngineGitFileFingerprint = Readonly<{
  device: number
  inode: number
  mode: number
  size: number
  modifiedMilliseconds: number
  changedMilliseconds: number
}>

export type EngineGitRawBlobSource = Readonly<{
  mark: number
  content:
    | Readonly<{
        kind: "file"
        absolutePath: string
        fingerprint: EngineGitFileFingerprint
      }>
    | Readonly<{
        kind: "bytes"
        bytes: Uint8Array
      }>
}>

export type EngineGitIndexEntry = Readonly<{
  mode: "100644" | "100755" | "120000" | "160000"
  objectID: string
  relativePath: string
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
  "-c",
  "core.longPaths=true",
  "-c",
  "core.fsmonitor=false",
  "-c",
  "maintenance.auto=false",
  "-c",
  "maintenance.autoDetach=false",
  "-c",
  "gc.auto=0",
  "-c",
  "gc.autoDetach=false",
  "-c",
  "commit.gpgSign=false",
  "-c",
  "diff.external=",
] as const

let runtimePromise:
  | Promise<{
      executable: string
      hooksPath: string
      attributesPath: string
      excludesPath: string
      homePath: string
    }>
  | undefined

const commandTrace = new AsyncLocalStorage<string[]>()

function traceCommand(args: readonly string[]) {
  const trace = commandTrace.getStore()
  if (trace) trace.push(args[0] ?? "unknown")
}

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
        onSpawned: () => traceCommand(["version"]),
      })
      const match = /^git version (\d+)\.(\d+)/.exec(version.stdout.toString().trim())
      if (version.code !== 0 || !match || Number(match[1]) < 2 || (Number(match[1]) === 2 && Number(match[2]) < 36)) {
        throw new Error(
          `Engine Git requires Git 2.36 or newer; found ${version.stdout.toString().trim() || "unavailable"}`,
        )
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
  const osEnvironment =
    process.platform === "win32"
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

async function execute(
  args: readonly string[],
  target: EngineGitTarget,
  input?: AsyncIterable<Uint8Array>,
): Promise<GitResult> {
  const activeRuntime = await runtime()
  const fixed = [
    ...ENGINE_GIT_CONFIG,
    ...(target.repository
      ? [`--git-dir=${target.repository.gitDir}`, `--work-tree=${target.repository.workTree}`]
      : []),
    "-c",
    `core.hooksPath=${activeRuntime.hooksPath}`,
    "-c",
    `core.attributesFile=${activeRuntime.attributesPath}`,
    "-c",
    `core.excludesFile=${activeRuntime.excludesPath}`,
  ]
  const timeoutMs = resolveGitTimeoutMs({ timeoutProfile: target.timeoutProfile })
  const result = await Process.runHost([activeRuntime.executable, ...fixed, ...args], {
    cwd: target.cwd,
    exactEnv: environment(activeRuntime, target),
    stdin: input ? "pipe" : "ignore",
    input,
    onSpawned: () => traceCommand(args),
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

function sameFingerprint(expected: EngineGitFileFingerprint, actual: Stats) {
  return (
    expected.device === actual.dev &&
    expected.inode === actual.ino &&
    expected.mode === actual.mode &&
    expected.size === actual.size &&
    expected.modifiedMilliseconds === actual.mtimeMs &&
    expected.changedMilliseconds === actual.ctimeMs
  )
}

async function* rawBlobImportInput(sources: readonly EngineGitRawBlobSource[]) {
  yield Buffer.from("feature done\n")
  for (const source of sources) {
    if (!Number.isSafeInteger(source.mark) || source.mark <= 0) {
      throw new Error(`Engine Git raw blob mark must be a positive safe integer; received ${source.mark}`)
    }
    if (source.content.kind === "bytes") {
      const bytes = Buffer.isBuffer(source.content.bytes) ? source.content.bytes : Buffer.from(source.content.bytes)
      yield Buffer.from(`blob\nmark :${source.mark}\ndata ${bytes.length}\n`)
      yield bytes
      yield Buffer.from("\n")
      continue
    }

    const handle = await fs.open(source.content.absolutePath, "r")
    try {
      const before = await handle.stat()
      if (!before.isFile() || !sameFingerprint(source.content.fingerprint, before)) {
        throw new Error(`Engine Git snapshot source changed before import: ${source.content.absolutePath}`)
      }
      if (!Number.isSafeInteger(before.size) || before.size < 0) {
        throw new Error(`Engine Git snapshot source has unsupported size: ${source.content.absolutePath}`)
      }
      yield Buffer.from(`blob\nmark :${source.mark}\ndata ${before.size}\n`)
      let position = 0
      while (position < before.size) {
        const chunk = Buffer.allocUnsafe(Math.min(256 * 1024, before.size - position))
        const read = await handle.read(chunk, 0, chunk.length, position)
        if (read.bytesRead <= 0) {
          throw new Error(`Engine Git snapshot source ended before its declared size: ${source.content.absolutePath}`)
        }
        position += read.bytesRead
        yield read.bytesRead === chunk.length ? chunk : chunk.subarray(0, read.bytesRead)
      }
      const after = await handle.stat()
      const pathAfter = await fs.lstat(source.content.absolutePath)
      if (
        !sameFingerprint(source.content.fingerprint, after) ||
        !sameFingerprint(source.content.fingerprint, pathAfter)
      ) {
        throw new Error(`Engine Git snapshot source changed during import: ${source.content.absolutePath}`)
      }
      yield Buffer.from("\n")
    } finally {
      await handle.close()
    }
  }
  yield Buffer.from("done\n")
}

function parseExportedMarks(
  input: string,
  sources: readonly EngineGitRawBlobSource[],
  objectFormat: EngineGitObjectFormat,
) {
  const expectedOIDLength = objectFormat === "sha256" ? 64 : 40
  const expectedMarks = sources.map((source) => source.mark)
  const lines = input.length === 0 ? [] : input.trimEnd().split(/\r?\n/)
  const objectIDs = new Map<number, string>()
  for (const line of lines) {
    const match = /^:(\d+) ([0-9a-f]+)$/.exec(line)
    if (!match) throw new Error(`Engine Git fast-import exported an invalid mark record: ${line}`)
    const mark = Number(match[1])
    const objectID = match[2]!
    if (!Number.isSafeInteger(mark) || objectIDs.has(mark)) {
      throw new Error(`Engine Git fast-import exported a duplicate or invalid mark: ${match[1]}`)
    }
    if (objectID.length !== expectedOIDLength) {
      throw new Error(`Engine Git fast-import exported an invalid ${objectFormat} object id for mark ${mark}`)
    }
    objectIDs.set(mark, objectID)
  }
  if (
    objectIDs.size !== expectedMarks.length ||
    expectedMarks.some((mark, index) => mark !== index + 1 || !objectIDs.has(mark))
  ) {
    throw new Error(
      `Engine Git fast-import mark projection was incomplete: expected ${expectedMarks.length}, received ${objectIDs.size}`,
    )
  }
  return objectIDs
}

async function* objectInspectionInput(
  sources: readonly EngineGitRawBlobSource[],
  objectIDs: ReadonlyMap<number, string>,
) {
  for (const source of sources) yield Buffer.from(`${objectIDs.get(source.mark)}\n`)
}

function validateObjectInspection(
  output: Buffer,
  sources: readonly EngineGitRawBlobSource[],
  objectIDs: ReadonlyMap<number, string>,
) {
  const lines = output.toString().trimEnd().split(/\r?\n/)
  if (lines.length !== sources.length) {
    throw new Error(`Engine Git blob inspection returned ${lines.length} records for ${sources.length} sources`)
  }
  for (const [index, source] of sources.entries()) {
    const match = /^([0-9a-f]+) blob (\d+)$/.exec(lines[index] ?? "")
    const expectedSize =
      source.content.kind === "bytes" ? source.content.bytes.byteLength : source.content.fingerprint.size
    if (!match || match[1] !== objectIDs.get(source.mark) || Number(match[2]) !== expectedSize) {
      throw new Error(`Engine Git blob inspection did not match source mark ${source.mark}`)
    }
  }
}

function inRepository(repository: EngineGitRepository): EngineGitTarget {
  return { cwd: repository.workTree, repository }
}

/** Closed Engine Git vocabulary. No caller can append Git global options or choose another subcommand. */
export const EngineGitProcess = {
  async withCommandTrace<T>(fn: () => Promise<T>) {
    const commands: string[] = []
    const value = await commandTrace.run(commands, fn)
    return { value, commands: [...commands] }
  },
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
  resolveRef(repository: EngineGitRepository, ref: string) {
    return execute(["show-ref", "--verify", "--hash", ref], {
      ...inRepository(repository),
      timeoutProfile: "fast",
    })
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
  sourceSnapshotPaths(cwd: string) {
    return execute(["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "."], { cwd })
  },
  stageEntries(repository: EngineGitRepository) {
    return execute(["ls-files", "--stage", "-z", "--", "."], inRepository(repository))
  },
  initializeEmptyIndex(repository: EngineGitRepository, indexFile: string) {
    return execute(["read-tree", "--empty"], { ...inRepository(repository), indexFile })
  },
  async importRawBlobs(
    repository: EngineGitRepository,
    sources: readonly EngineGitRawBlobSource[],
    marksFile: string,
    objectFormat: EngineGitObjectFormat,
  ) {
    await fs.rm(marksFile, { force: true })
    const result = await execute(
      ["fast-import", "--quiet", "--done", `--export-marks=${marksFile}`],
      inRepository(repository),
      rawBlobImportInput(sources),
    )
    if (result.exitCode !== 0) return { result, objectIDs: new Map<number, string>() }
    const marks = await fs.readFile(marksFile, "utf8")
    const objectIDs = parseExportedMarks(marks, sources, objectFormat)
    if (objectIDs.size > 0) {
      const inspected = await execute(
        ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
        inRepository(repository),
        objectInspectionInput(sources, objectIDs),
      )
      if (inspected.exitCode !== 0) {
        throw new Error(`Engine Git imported blob inspection failed: ${inspected.stderr.toString().trim()}`)
      }
      validateObjectInspection(inspected.stdout, sources, objectIDs)
    }
    return { result, objectIDs }
  },
  replaceIndexEntries(repository: EngineGitRepository, indexFile: string, entries: readonly EngineGitIndexEntry[]) {
    async function* input() {
      for (const entry of entries) {
        if (entry.relativePath.includes("\0")) throw new Error("Engine Git index path contains a NUL byte")
        yield Buffer.from(`${entry.mode} ${entry.objectID}\t${entry.relativePath}\0`)
      }
    }
    return execute(["update-index", "-z", "--index-info"], { ...inRepository(repository), indexFile }, input())
  },
  writeTree(repository: EngineGitRepository, indexFile: string) {
    return execute(["write-tree"], { ...inRepository(repository), indexFile })
  },
  commitTree(
    repository: EngineGitRepository,
    input: {
      tree: string
      parent?: string
      subject: string
      body: string
      identity: EngineGitIdentity
    },
  ) {
    return execute(
      ["commit-tree", input.tree, ...(input.parent ? ["-p", input.parent] : []), "-m", input.subject, "-m", input.body],
      { ...inRepository(repository), identity: input.identity },
    )
  },
  resolveTree(repository: EngineGitRepository, commit: string) {
    return execute(["rev-parse", `${commit}^{tree}`], inRepository(repository))
  },
  compareAndSwapRef(
    repository: EngineGitRepository,
    ref: string,
    next: string,
    previous: string,
    options?: { noDeref?: boolean },
  ) {
    return execute(
      ["update-ref", ...(options?.noDeref ? ["--no-deref"] : []), ref, next, previous],
      inRepository(repository),
    )
  },
  deleteRef(repository: EngineGitRepository, ref: string, previous: string, options?: { noDeref?: boolean }) {
    return execute(
      ["update-ref", ...(options?.noDeref ? ["--no-deref"] : []), "-d", ref, previous],
      inRepository(repository),
    )
  },
}
