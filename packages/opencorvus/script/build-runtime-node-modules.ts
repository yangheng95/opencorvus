import { execFileSync } from "node:child_process"
import fs from "fs"
import { availableParallelism } from "node:os"
import path from "path"
import { createRequire } from "module"
import {
  artifactPinnedNodeRuntimeExecutable,
  artifactRuntimeNodeModules,
  type ArtifactNodeRuntimeTarget,
  type ArtifactRuntimeNodeModule,
} from "./build-artifact"

function packageDestination(nodeModules: string, packageName: string) {
  return path.join(nodeModules, ...packageName.split("/"))
}

async function copyPackageDirectory(
  source: string,
  destination: string,
  nodeFileCopy = false,
  nodeFileCopyExecutable?: string,
) {
  await fs.promises.rm(destination, { recursive: true, force: true })
  if (nodeFileCopy) {
    if (!nodeFileCopyExecutable) throw new Error("Node file copy requires the pinned Node runtime executable.")
    await copyPackageDirectoryWithNode(source, destination, nodeFileCopyExecutable)
    return
  }
  const concurrency = availableParallelism()
  const files = await collectPackageEntries(source, source, destination, concurrency)
  let nextFile = 0
  const workers = Array.from({ length: Math.min(concurrency, files.length) }, async () => {
    while (nextFile < files.length) {
      const file = files[nextFile++]
      if (!file) return
      await fs.promises.copyFile(file.source, file.destination)
    }
  })
  await Promise.all(workers)
}

function copyPackageDirectoryWithNode(source: string, destination: string, nodeExecutable: string) {
  const script = String.raw`
const fs = require("node:fs")
const path = require("node:path")
const source = process.argv[1]
const destination = process.argv[2]
fs.cpSync(source, destination, {
  recursive: true,
  filter(candidate) {
    const relative = path.relative(source, candidate)
    return relative === "" || !relative.split(path.sep).includes("node_modules")
  },
})
`
  execFileSync(nodeExecutable, ["-e", script, source, destination])
}

type PackageEntry = { source: string; destination: string }

async function collectPackageEntries(
  root: string,
  source: string,
  destination: string,
  concurrency: number,
): Promise<PackageEntry[]> {
  const directories: PackageEntry[] = [{ source, destination }]
  const files: PackageEntry[] = []

  while (directories.length > 0) {
    const batch = directories.splice(0, concurrency)
    const discovered = await Promise.all(
      batch.map(async (directory) => {
        await fs.promises.mkdir(directory.destination, { recursive: true })
        const entries = await fs.promises.readdir(directory.source, { withFileTypes: true })
        entries.sort((left, right) => left.name.localeCompare(right.name))
        const children: Array<PackageEntry & { directory: boolean }> = []
        for (const entry of entries) {
          const childSource = path.join(directory.source, entry.name)
          const relative = path.relative(root, childSource)
          if (relative.split(path.sep).includes("node_modules")) continue
          const childDestination = path.join(directory.destination, entry.name)
          if (entry.isDirectory()) {
            children.push({ source: childSource, destination: childDestination, directory: true })
            continue
          }
          if (entry.isFile()) {
            children.push({ source: childSource, destination: childDestination, directory: false })
            continue
          }
          const stat = await fs.promises.stat(childSource)
          if (stat.isDirectory()) {
            children.push({ source: childSource, destination: childDestination, directory: true })
          } else if (stat.isFile()) {
            children.push({ source: childSource, destination: childDestination, directory: false })
          }
        }
        return children
      }),
    )
    for (const child of discovered.flat()) {
      if (child.directory) directories.push(child)
      else files.push(child)
    }
  }

  return files
}

function readPackageJson(source: string) {
  return JSON.parse(fs.readFileSync(path.join(source, "package.json"), "utf8")) as {
    name?: string
    dependencies?: Record<string, string>
  }
}

function resolvePackageSource(
  packageName: string,
  requireFrom: NodeJS.Require,
  target: ArtifactNodeRuntimeTarget,
): string {
  let packageJson: string
  try {
    packageJson = requireFrom.resolve(`${packageName}/package.json`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ERR_PACKAGE_PATH_NOT_EXPORTED") {
      return packageSourceFromEntrypoint(requireFrom.resolve(packageName), packageName)
    }
    const targetName = `${target.os}-${target.arch}${target.abi ? `-${target.abi}` : ""}`
    throw new Error(
      `Missing runtime package '${packageName}' for target ${targetName}. ` +
        "Run the package manager for that target platform; do not install a different platform package into this workspace.",
      { cause: error },
    )
  }
  return path.dirname(packageJson)
}

function packageSourceFromEntrypoint(entrypoint: string, packageName: string) {
  let directory = path.dirname(entrypoint)
  while (true) {
    const packageJson = path.join(directory, "package.json")
    if (fs.existsSync(packageJson)) {
      const manifest = JSON.parse(fs.readFileSync(packageJson, "utf8")) as { name?: unknown }
      if (manifest.name === packageName) return directory
    }
    const parent = path.dirname(directory)
    if (parent === directory) throw new Error(`Package root for '${packageName}' was not found from ${entrypoint}.`)
    directory = parent
  }
}

async function copyRuntimePackageTree(
  packageName: string,
  outNodeModules: string,
  requireFrom: NodeJS.Require,
  target: ArtifactNodeRuntimeTarget,
  copied: Set<string>,
  rootPackageNames: Set<string>,
  copiedPackageNames: Map<string, string>,
  conflictNodeModules: string,
  runtimeDependencies: string[] = [],
  nodeFileCopy = false,
  nodeFileCopyExecutable?: string,
) {
  const source = resolvePackageSource(packageName, requireFrom, target)
  const copiedKey = fs.realpathSync(source).toLowerCase()
  const existingSource = copiedPackageNames.get(packageName)
  const hasVersionConflict = existingSource !== undefined && existingSource !== copiedKey
  const destinationNodeModules = hasVersionConflict ? conflictNodeModules : outNodeModules
  const destination = packageDestination(destinationNodeModules, packageName)
  const destinationKey = `${copiedKey}\0${destination.toLowerCase()}`
  if (copied.has(destinationKey)) return
  copied.add(destinationKey)
  if (!hasVersionConflict) copiedPackageNames.set(packageName, copiedKey)

  await copyPackageDirectory(source, destination, nodeFileCopy, nodeFileCopyExecutable)

  const packageJson = readPackageJson(source)
  const dependencyNames = [...Object.keys(packageJson.dependencies ?? {}), ...runtimeDependencies].filter(
    (dependencyName) => !rootPackageNames.has(dependencyName),
  )
  if (dependencyNames.length === 0) return

  const packageRequire = createRequire(path.join(source, "package.json"))
  for (const dependencyName of dependencyNames) {
    await copyRuntimePackageTree(
      dependencyName,
      outNodeModules,
      packageRequire,
      target,
      copied,
      rootPackageNames,
      copiedPackageNames,
      path.join(destination, "node_modules"),
      [],
      false,
      nodeFileCopyExecutable,
    )
  }
}

export async function copyRuntimeNodeModules(
  target: ArtifactNodeRuntimeTarget,
  outdir: string,
  packageRoot: string,
  modules: ArtifactRuntimeNodeModule[] = artifactRuntimeNodeModules(target),
) {
  const nodeModules = path.join(outdir, "node_modules")
  await fs.promises.mkdir(nodeModules, { recursive: true })
  const requireFromPackage = createRequire(path.join(packageRoot, "package.json"))
  const copied = new Set<string>()
  const copiedPackageNames = new Map<string, string>()
  const rootPackageNames = new Set(modules.map((item) => item.name))
  const nodeFileCopyExecutable = modules.some((item) => item.nodeFileCopy)
    ? artifactPinnedNodeRuntimeExecutable(packageRoot, target)
    : undefined
  for (const item of modules) {
    await copyRuntimePackageTree(
      item.name,
      nodeModules,
      requireFromPackage,
      target,
      copied,
      rootPackageNames,
      copiedPackageNames,
      nodeModules,
      item.runtimeDependencies,
      item.nodeFileCopy,
      nodeFileCopyExecutable,
    )
  }
}

export async function validatePackagedRuntimeNodeModules(input: {
  runtimeRoot: string
  target: ArtifactNodeRuntimeTarget
  modules?: ArtifactRuntimeNodeModule[]
}) {
  const modules = input.modules ?? artifactRuntimeNodeModules(input.target)
  const runtimeRoot = await fs.promises.realpath(input.runtimeRoot)
  const rootPackageNames = new Set(modules.map((item) => item.name))
  const validated = new Map<string, string>()

  const validatePackage = async (
    packageName: string,
    requireFrom: NodeJS.Require,
    runtimeDependencies: string[] = [],
  ): Promise<void> => {
    const source = await fs.promises.realpath(resolvePackageSource(packageName, requireFrom, input.target))
    const relative = path.relative(runtimeRoot, source)
    if (relative === "" || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
      throw new Error(`Packaged runtime dependency '${packageName}' resolved outside ${runtimeRoot}: ${source}`)
    }
    const identity = `${packageName}\0${source}`
    if (validated.has(identity)) return
    validated.set(identity, source)
    const manifest = readPackageJson(source)
    if (manifest.name !== packageName) {
      throw new Error(`Packaged runtime dependency '${packageName}' has manifest name '${manifest.name ?? "<missing>"}'`)
    }
    const packageRequire = createRequire(path.join(source, "package.json"))
    const dependencies = [...Object.keys(manifest.dependencies ?? {}), ...runtimeDependencies]
    for (const dependencyName of dependencies) {
      if (rootPackageNames.has(dependencyName)) continue
      await validatePackage(dependencyName, packageRequire)
    }
  }

  const rootRequire = createRequire(path.join(runtimeRoot, "package.json"))
  for (const item of modules) {
    await validatePackage(item.name, rootRequire, item.runtimeDependencies)
  }
  return [...validated.entries()]
    .map(([identity, source]) => ({ packageName: identity.slice(0, identity.indexOf("\0")), source }))
    .sort((left, right) => left.source.localeCompare(right.source))
}

export async function writePackagedRuntimePackageJson(input: {
  name: string
  outdir: string
  target: Pick<ArtifactNodeRuntimeTarget, "arch" | "os">
  version: string
}) {
  await fs.promises.mkdir(input.outdir, { recursive: true })
  await fs.promises.writeFile(
    path.join(input.outdir, "package.json"),
    `${JSON.stringify(
      {
        name: input.name,
        version: input.version,
        os: [input.target.os],
        cpu: [input.target.arch],
      },
      null,
      2,
    )}\n`,
  )
}
