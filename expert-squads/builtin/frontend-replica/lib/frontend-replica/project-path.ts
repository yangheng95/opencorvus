import fs from "node:fs/promises"
import path from "node:path"

export interface ResolvedReplaceableProjectPath {
  path: string
  existed: boolean
}

export class PublicationRecoveryError extends AggregateError {
  readonly backupDirectory: string
  readonly preparedDirectory: string

  constructor(input: {
    publishError: unknown
    restoreError: unknown
    backupDirectory: string
    preparedDirectory: string
  }) {
    super(
      [input.publishError, input.restoreError],
      `Failed to publish the prepared directory and restore the previous directory. Previous output: ${input.backupDirectory}. Prepared output: ${input.preparedDirectory}.`,
    )
    this.name = "PublicationRecoveryError"
    this.backupDirectory = input.backupDirectory
    this.preparedDirectory = input.preparedDirectory
  }
}

export function resolveProjectPath(projectDirectory: string, projectRelativePath: string, label: string) {
  const target = path.resolve(projectDirectory, projectRelativePath)
  assertProjectChild(projectDirectory, target, label)
  return target
}

export async function resolveExistingProjectPath(projectDirectory: string, target: string, label: string) {
  const targetStat = await fs.lstat(target)
  if (targetStat.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link or junction`)
  if (!targetStat.isDirectory()) throw new Error(`${label} must be a directory`)
  const [projectRoot, canonicalTarget] = await Promise.all([fs.realpath(projectDirectory), fs.realpath(target)])
  assertProjectChild(projectRoot, canonicalTarget, label)
  return canonicalTarget
}

export async function resolveCreatableProjectPath(projectDirectory: string, target: string, label: string) {
  const projectRoot = await fs.realpath(projectDirectory)
  let existingAncestor = target
  const missingSegments: string[] = []
  while (true) {
    try {
      const canonicalAncestor = await fs.realpath(existingAncestor)
      const canonicalTarget = path.join(canonicalAncestor, ...missingSegments)
      assertProjectChild(projectRoot, canonicalTarget, label)
      return canonicalTarget
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
      const parent = path.dirname(existingAncestor)
      if (parent === existingAncestor) throw error
      missingSegments.unshift(path.basename(existingAncestor))
      existingAncestor = parent
    }
  }
}

export async function resolveReplaceableProjectPath(
  projectDirectory: string,
  target: string,
  label: string,
  replaceExisting: boolean,
): Promise<ResolvedReplaceableProjectPath> {
  const targetStat = await fs.lstat(target).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (targetStat?.isSymbolicLink()) throw new Error(`${label} must not be a symbolic link or junction`)
  if (targetStat && !targetStat.isDirectory()) throw new Error(`${label} must be a directory`)
  if (targetStat && !replaceExisting) throw new Error(`${label} already exists and replace_existing is false`)
  return {
    path: targetStat
      ? await resolveExistingProjectPath(projectDirectory, target, label)
      : await resolveCreatableProjectPath(projectDirectory, target, label),
    existed: Boolean(targetStat),
  }
}

export function assertResolvedTargetUnchanged(
  initial: ResolvedReplaceableProjectPath,
  current: ResolvedReplaceableProjectPath,
  label: string,
) {
  if (initial.existed !== current.existed || path.relative(initial.path, current.path) !== "") {
    throw new Error(`${label} changed while the package output was being prepared`)
  }
}

export async function assertDirectoryTreeHasNoLinks(root: string, label: string): Promise<void> {
  const rootStat = await fs.lstat(root)
  if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) {
    throw new Error(`${label} must be a real directory without symbolic links or junctions`)
  }
  async function walk(directory: string): Promise<void> {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) {
        throw new Error(`${label} contains a symbolic link or junction: ${entryPath}`)
      }
      if (entry.isDirectory()) {
        await walk(entryPath)
        continue
      }
      if (!entry.isFile()) throw new Error(`${label} contains an unsupported filesystem entry: ${entryPath}`)
    }
  }
  await walk(root)
}

export async function publishPreparedDirectory(
  preparedDirectory: string,
  targetDirectory: string,
  options: {
    replaceExisting: boolean
    expectedTargetExists: boolean
    renameDirectory?: typeof fs.rename
  },
): Promise<void> {
  const renameDirectory = options.renameDirectory ?? fs.rename
  const preparedStat = await fs.lstat(preparedDirectory)
  if (preparedStat.isSymbolicLink() || !preparedStat.isDirectory()) {
    throw new Error("prepared directory must be a real directory")
  }
  const targetStat = await fs.lstat(targetDirectory).catch((error: NodeJS.ErrnoException) => {
    if (error.code === "ENOENT") return undefined
    throw error
  })
  if (targetStat?.isSymbolicLink()) throw new Error("publication target must not be a symbolic link or junction")
  if (targetStat && !targetStat.isDirectory()) throw new Error("publication target must be a directory")
  if (Boolean(targetStat) !== options.expectedTargetExists) {
    throw new Error("publication target existence changed while output was being prepared")
  }
  if (targetStat && !options.replaceExisting) throw new Error("publication target exists and replacement is false")
  if (!targetStat) {
    await renameDirectory(preparedDirectory, targetDirectory)
    return
  }

  const backupDirectory = path.join(
    path.dirname(targetDirectory),
    `${path.basename(path.dirname(preparedDirectory))}.previous-output`,
  )
  await renameDirectory(targetDirectory, backupDirectory)
  try {
    await renameDirectory(preparedDirectory, targetDirectory)
  } catch (publishError) {
    try {
      await renameDirectory(backupDirectory, targetDirectory)
    } catch (restoreError) {
      throw new PublicationRecoveryError({
        publishError,
        restoreError,
        backupDirectory,
        preparedDirectory,
      })
    }
    throw publishError
  }
  await fs.rm(backupDirectory, { recursive: true })
}

export function assertDisjointPaths(first: string, firstLabel: string, second: string, secondLabel: string) {
  if (pathsOverlap(first, second) || pathsOverlap(second, first)) {
    throw new Error(`${firstLabel} and ${secondLabel} must not overlap`)
  }
}

function assertProjectChild(projectRoot: string, target: string, label: string) {
  const relative = path.relative(projectRoot, target)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`${label} must resolve to a child of the active project directory`)
  }
}

function pathsOverlap(first: string, second: string) {
  const relative = path.relative(first, second)
  return !relative || (!relative.startsWith("..") && !path.isAbsolute(relative))
}
