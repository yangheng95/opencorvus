import { createHash } from "node:crypto"
import { lstat, mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import path from "node:path"

export type PluginPackageJson = {
  name: string
  version: string
  exports: Record<string, unknown>
  [key: string]: unknown
}

export type StagedPluginPackage = {
  directory: string
  packageJson: PluginPackageJson
  files: string[]
  sha256: string
}

type PublishDependencyVersions = {
  catalog: Record<string, string>
  workspace: Record<string, string>
}

function sourceExportStem(target: string, label: string): string {
  if (!target.startsWith("./src/") || !target.endsWith(".ts") || target.includes("\\")) {
    throw new Error(`${label} must point to a TypeScript source entry under ./src, got ${target}`)
  }
  const stem = target.slice("./src/".length, -".ts".length)
  const segments = stem.split("/")
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`${label} must identify a normalized source entry, got ${target}`)
  }
  return stem
}

function resolveDependencyVersion(name: string, version: unknown, versions: PublishDependencyVersions): unknown {
  if (version === "catalog:") {
    const resolved = versions.catalog[name]
    if (!resolved) throw new Error(`Catalog dependency ${name} has no publication version`)
    return resolved
  }
  if (version === "workspace:*") {
    const resolved = versions.workspace[name]
    if (!resolved) throw new Error(`Workspace dependency ${name} has no publication version`)
    return resolved
  }
  if (typeof version === "string" && (version.startsWith("catalog:") || version.startsWith("workspace:"))) {
    throw new Error(`Dependency ${name} uses unsupported publication protocol ${version}`)
  }
  return version
}

export function buildPublishPackageJson<T extends PluginPackageJson>(
  source: T,
  versions: PublishDependencyVersions = { catalog: {}, workspace: {} },
): T {
  const output = structuredClone(source)
  output.exports = Object.fromEntries(
    Object.entries(source.exports).map(([subpath, target]) => {
      if (typeof target !== "string") throw new Error(`exports.${subpath} must be a source entry string`)
      const stem = sourceExportStem(target, `exports.${subpath}`)
      return [
        subpath,
        {
          types: `./dist/${stem}.d.ts`,
          import: `./dist/${stem}.js`,
        },
      ]
    }),
  ) as T["exports"]
  for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"] as const) {
    const dependencies = output[field]
    if (dependencies === undefined) continue
    if (!dependencies || typeof dependencies !== "object" || Array.isArray(dependencies)) {
      throw new Error(`${field} must be a dependency map`)
    }
    output[field] = Object.fromEntries(
      Object.entries(dependencies).map(([name, version]) => [name, resolveDependencyVersion(name, version, versions)]),
    )
  }
  return output
}

async function directoryExists(directory: string): Promise<boolean> {
  return lstat(directory).then(
    () => true,
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return false
      throw error
    },
  )
}

export async function listPackageFiles(directory: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (current: string, prefix: string): Promise<void> => {
    const entries = await readdir(current, { withFileTypes: true })
    entries.sort((left, right) => left.name.localeCompare(right.name))
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) {
        await visit(absolute, relative)
        continue
      }
      if (!entry.isFile()) throw new Error(`Plugin publication does not admit non-file entry: ${relative}`)
      files.push(relative)
    }
  }
  await visit(directory, "")
  return files
}

export async function packageContentDigest(directory: string, inputFiles?: string[]): Promise<string> {
  const files = inputFiles ?? (await listPackageFiles(directory))
  const hash = createHash("sha256")
  for (const file of files) {
    hash.update(file)
    hash.update("\0")
    hash.update(await readFile(path.join(directory, ...file.split("/"))))
    hash.update("\0")
  }
  return hash.digest("hex")
}

async function workspaceVersions(workspaceDirectory: string): Promise<Record<string, string>> {
  const versions: Record<string, string> = {}
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 2) return
    const manifestPath = path.join(directory, "package.json")
    if (await directoryExists(manifestPath)) {
      const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as { name?: unknown; version?: unknown }
      if (typeof manifest.name === "string" && typeof manifest.version === "string") versions[manifest.name] = manifest.version
    }
    if (depth === 2) return
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules") continue
      await visit(path.join(directory, entry.name), depth + 1)
    }
  }
  await visit(path.join(workspaceDirectory, "packages"), 0)
  return versions
}

export async function stagePluginPackage(input: {
  sourceDirectory: string
  stagingDirectory: string
  workspaceDirectory: string
}): Promise<StagedPluginPackage> {
  const sourceDirectory = path.resolve(input.sourceDirectory)
  const stagingDirectory = path.resolve(input.stagingDirectory)
  if (sourceDirectory === stagingDirectory) throw new Error("Plugin publication staging must not reuse the source directory")
  if (await directoryExists(stagingDirectory)) {
    throw new Error(`Plugin publication staging directory already exists: ${stagingDirectory}`)
  }

  const workspaceDirectory = path.resolve(input.workspaceDirectory)
  const rootManifest = JSON.parse(await readFile(path.join(workspaceDirectory, "package.json"), "utf8")) as {
    workspaces?: { catalog?: Record<string, string> }
  }
  const sourceManifest = JSON.parse(await readFile(path.join(sourceDirectory, "package.json"), "utf8")) as PluginPackageJson
  const packageJson = buildPublishPackageJson(sourceManifest, {
    catalog: rootManifest.workspaces?.catalog ?? {},
    workspace: await workspaceVersions(workspaceDirectory),
  })
  await mkdir(stagingDirectory, { recursive: true })
  const compilerEntry = path.join(workspaceDirectory, "node_modules", "typescript", "bin", "tsc")
  const compiler = Bun.spawn(
    [
      process.execPath,
      compilerEntry,
      "--project",
      path.join(sourceDirectory, "tsconfig.json"),
      "--rootDir",
      path.join(sourceDirectory, "src"),
      "--outDir",
      path.join(stagingDirectory, "dist"),
    ],
    { cwd: sourceDirectory, stdout: "pipe", stderr: "pipe" },
  )
  const [compilerExitCode, compilerStdout, compilerStderr] = await Promise.all([
    compiler.exited,
    new Response(compiler.stdout).text(),
    new Response(compiler.stderr).text(),
  ])
  if (compilerExitCode !== 0) {
    throw new Error(
      `Plugin publication compilation failed (${compilerExitCode})\n${compilerStdout}\n${compilerStderr}`,
    )
  }
  await writeFile(path.join(stagingDirectory, "package.json"), `${JSON.stringify(packageJson, null, 2)}\n`)

  for (const [subpath, conditions] of Object.entries(packageJson.exports)) {
    if (!conditions || typeof conditions !== "object" || Array.isArray(conditions)) {
      throw new Error(`Published exports.${subpath} must be a conditional export map`)
    }
    for (const condition of ["types", "import"] as const) {
      const target = (conditions as Record<string, unknown>)[condition]
      if (typeof target !== "string") throw new Error(`Published exports.${subpath}.${condition} is missing`)
      const absolute = path.resolve(stagingDirectory, target)
      if (!absolute.startsWith(`${stagingDirectory}${path.sep}`) || !(await directoryExists(absolute))) {
        throw new Error(`Published exports.${subpath}.${condition} target does not exist: ${target}`)
      }
    }
  }

  const files = await listPackageFiles(stagingDirectory)
  return {
    directory: stagingDirectory,
    packageJson,
    files,
    sha256: await packageContentDigest(stagingDirectory, files),
  }
}
