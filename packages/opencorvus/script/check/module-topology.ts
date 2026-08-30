#!/usr/bin/env bun
import { spawnSync } from "node:child_process"
import { mkdir, mkdtemp, readdir, readFile, rm, stat, symlink } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import ts from "typescript"

const repositoryRoot = path.resolve(import.meta.dir, "..", "..", "..", "..")
const sourcePrefix = "packages/opencorvus/src/"
const retainedComponentBudgets = [] as const
const cleanImportEntrypoints = [
  "packages/opencorvus/src/project/implicit-project.ts",
  "packages/opencorvus/src/mcp/browser/builtin.ts",
  "packages/opencorvus/src/session/loop.ts",
  "packages/opencorvus/src/config/config.ts",
] as const
const cleanImportTimeoutMs = 120_000
const snapshotMaterializationPaths = [
  // Workspace links under packages/opencorvus/node_modules are relative to
  // packages/*. A clean snapshot therefore needs the exact treeish versions
  // of those packages too; otherwise Bun resolves (for example)
  // @opencorvus-ai/util into an absent snapshot/packages/util directory and
  // reports a false clean-import failure against a valid commit.
  "packages",
  "expert-squads",
] as const

type Graph = Map<string, ReadonlySet<string>>
type SnapshotRequest = {
  treeish: string
  label: string
}
type MaterializedSnapshot = {
  root: string
  label: string
  productionModules: string[]
}

function gitOutput(args: readonly string[]): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd: repositoryRoot,
    stdout: "pipe",
    stderr: "pipe",
  })
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`)
  }
  return result.stdout.toString()
}

function productionModulesFromListing(listed: string): string[] {
  return listed
    .split(/\r?\n/)
    .filter(
      (file) =>
        (file.endsWith(".ts") || file.endsWith(".tsx")) && !file.endsWith(".d.ts") && !file.includes("/skill/builtin/"),
    )
    .sort()
}

async function linkSnapshotDependencies(snapshotRoot: string): Promise<void> {
  const workspaceRoots = (await readdir(path.join(repositoryRoot, "packages"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}`)
  workspaceRoots.push("packages/sdk/js")

  const dependencyRoots = new Set(["node_modules", ...workspaceRoots.map((root) => `${root}/node_modules`)])
  for (const relative of dependencyRoots) {
    const source = path.join(repositoryRoot, relative)
    const target = path.join(snapshotRoot, relative)
    const sourceIsDirectory = await stat(source).then(
      (value) => value.isDirectory(),
      () => false,
    )
    if (!sourceIsDirectory) continue
    await mkdir(path.dirname(target), { recursive: true })
    await symlink(source, target, process.platform === "win32" ? "junction" : "dir")
  }
}

function buildSnapshotRuntimeDependencies(snapshotRoot: string): void {
  const result = Bun.spawnSync(
    [
      process.execPath,
      path.join(repositoryRoot, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      "packages/sdk/js/tsconfig.json",
    ],
    {
      cwd: snapshotRoot,
      stdout: "pipe",
      stderr: "pipe",
    },
  )
  if (result.exitCode !== 0) {
    throw new Error(`snapshot SDK build failed: ${result.stderr.toString().trim() || result.stdout.toString().trim()}`)
  }
}

function snapshotRequest(args: readonly string[]): SnapshotRequest {
  if (args.length === 0) {
    const commit = gitOutput(["rev-parse", "--verify", "HEAD^{commit}"]).trim()
    return { treeish: commit, label: `head:${commit.slice(0, 12)}` }
  }
  if (args.length === 1 && args[0] === "--index") {
    const tree = gitOutput(["write-tree"]).trim()
    return { treeish: tree, label: `index:${tree.slice(0, 12)}` }
  }
  if (args.length === 2 && args[0] === "--treeish") {
    const commit = gitOutput(["rev-parse", "--verify", `${args[1]}^{commit}`]).trim()
    return { treeish: commit, label: `treeish:${commit.slice(0, 12)}` }
  }
  throw new Error("Usage: module-topology.ts [--index | --treeish <commit-ish>]")
}

async function materializeSnapshot(request: SnapshotRequest): Promise<MaterializedSnapshot> {
  const snapshotRoot = await mkdtemp(path.join(repositoryRoot, ".module-topology-"))
  try {
    const productionModules = productionModulesFromListing(
      gitOutput(["ls-tree", "-r", "--name-only", request.treeish, "--", sourcePrefix]),
    )
    const archivePath = path.join(snapshotRoot, "snapshot.tar")
    const archive = Bun.spawnSync(
      [
        "git",
        "archive",
        "--format=tar",
        `--output=${archivePath}`,
        request.treeish,
        "--",
        ...snapshotMaterializationPaths,
      ],
      { cwd: repositoryRoot, stdout: "pipe", stderr: "pipe" },
    )
    if (archive.exitCode !== 0) {
      throw new Error(`git archive failed: ${archive.stderr.toString().trim()}`)
    }
    extractSnapshotArchive(snapshotRoot, path.basename(archivePath))
    await rm(archivePath, { force: true })
    await linkSnapshotDependencies(snapshotRoot)
    buildSnapshotRuntimeDependencies(snapshotRoot)
    return { root: snapshotRoot, label: request.label, productionModules }
  } catch (error) {
    await rm(snapshotRoot, { recursive: true, force: true })
    throw error
  }
}

export function extractSnapshotArchive(snapshotRoot: string, archiveName: string): void {
  if (path.basename(archiveName) !== archiveName) {
    throw new Error(`snapshot archive must be addressed by basename: ${archiveName}`)
  }
  const extract = spawnSync("tar", ["-xf", archiveName, "-C", "."], {
    cwd: snapshotRoot,
    encoding: "utf8",
    windowsHide: true,
  })
  if (extract.error) throw extract.error
  if (extract.status !== 0) {
    throw new Error(`tar extraction failed: ${extract.stderr.trim()}`)
  }
}

function runtimeModuleSpecifier(statement: ts.Statement): string | undefined {
  if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
    const clause = statement.importClause
    if (!clause) return statement.moduleSpecifier.text
    if (clause.isTypeOnly) return undefined
    if (clause.name) return statement.moduleSpecifier.text
    const bindings = clause.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) return statement.moduleSpecifier.text
    if (bindings && ts.isNamedImports(bindings) && bindings.elements.some((element) => !element.isTypeOnly)) {
      return statement.moduleSpecifier.text
    }
    return undefined
  }
  if (ts.isExportDeclaration(statement) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)) {
    if (statement.isTypeOnly) return undefined
    const clause = statement.exportClause
    if (!clause || ts.isNamespaceExport(clause)) return statement.moduleSpecifier.text
    if (ts.isNamedExports(clause) && clause.elements.some((element) => !element.isTypeOnly)) {
      return statement.moduleSpecifier.text
    }
  }
  return undefined
}

function resolveProductionModule(from: string, specifier: string, modules: ReadonlySet<string>): string | undefined {
  let unresolved: string
  if (specifier.startsWith("@/")) {
    unresolved = `${sourcePrefix}${specifier.slice(2)}`
  } else if (specifier.startsWith(".")) {
    unresolved = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier))
  } else {
    return undefined
  }

  const bases = [unresolved]
  if (/\.(?:c|m)?jsx?$/.test(unresolved)) bases.push(unresolved.replace(/\.(?:c|m)?jsx?$/, ""))
  for (const base of bases) {
    for (const candidate of [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`]) {
      if (modules.has(candidate)) return candidate
    }
  }
  return undefined
}

async function runtimeGraph(
  snapshotRoot: string,
  files: readonly string[],
): Promise<{ graph: Graph; edgeCount: number }> {
  const modules = new Set(files)
  const graph = new Map<string, Set<string>>(files.map((file) => [file, new Set()]))
  for (const file of files) {
    const source = await readFile(path.join(snapshotRoot, file), "utf8")
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    )
    for (const statement of sourceFile.statements) {
      const specifier = runtimeModuleSpecifier(statement)
      if (!specifier) continue
      const target = resolveProductionModule(file, specifier, modules)
      if (target) graph.get(file)!.add(target)
    }
  }
  return {
    graph,
    edgeCount: [...graph.values()].reduce((total, targets) => total + targets.size, 0),
  }
}

function stronglyConnectedComponents(graph: Graph): string[][] {
  let nextIndex = 0
  const indices = new Map<string, number>()
  const lowLinks = new Map<string, number>()
  const stack: string[] = []
  const onStack = new Set<string>()
  const components: string[][] = []

  const visit = (node: string) => {
    indices.set(node, nextIndex)
    lowLinks.set(node, nextIndex)
    nextIndex += 1
    stack.push(node)
    onStack.add(node)

    for (const target of graph.get(node) ?? []) {
      if (!indices.has(target)) {
        visit(target)
        lowLinks.set(node, Math.min(lowLinks.get(node)!, lowLinks.get(target)!))
      } else if (onStack.has(target)) {
        lowLinks.set(node, Math.min(lowLinks.get(node)!, indices.get(target)!))
      }
    }

    if (lowLinks.get(node) !== indices.get(node)) return
    const component: string[] = []
    let member: string
    do {
      member = stack.pop()!
      onStack.delete(member)
      component.push(member)
    } while (member !== node)
    components.push(component.sort())
  }

  for (const node of graph.keys()) {
    if (!indices.has(node)) visit(node)
  }
  return components
}

function componentDiagnostic(component: readonly string[], graph: Graph): string {
  const members = new Set(component)
  const edges = component.flatMap((source) =>
    [...(graph.get(source) ?? [])]
      .filter((target) => members.has(target))
      .sort()
      .map((target) => `    ${source} -> ${target}`),
  )
  return [
    `  component (${component.length})`,
    ...component.map((member) => `    ${member}`),
    "  internal edges",
    ...edges,
  ].join("\n")
}

async function checkCleanImports(snapshotRoot: string): Promise<string[]> {
  const failures: string[] = []
  const runtimeRoot = await mkdtemp(path.join(os.tmpdir(), "opencorvus-module-topology-"))
  try {
    for (const entrypoint of cleanImportEntrypoints) {
      const url = pathToFileURL(path.join(snapshotRoot, entrypoint)).href
      const result = Bun.spawnSync(
        [process.execPath, "--eval", `await import(${JSON.stringify(url)}); process.exit(0)`],
        {
          cwd: snapshotRoot,
          env: { ...process.env, OPENCORVUS_HOME: runtimeRoot },
          stdout: "pipe",
          stderr: "pipe",
          timeout: cleanImportTimeoutMs,
        },
      )
      if (result.exitCode !== 0) {
        failures.push(
          `clean import failed for ${entrypoint}: ${cleanImportFailureDetail({
            stderr: result.stderr.toString().trim(),
            exitCode: result.exitCode,
            signalCode: result.signalCode,
            exitedDueToTimeout: result.exitedDueToTimeout,
          })}`,
        )
      }
    }
  } finally {
    await rm(runtimeRoot, { recursive: true, force: true })
  }
  return failures
}

export function cleanImportFailureDetail(input: {
  stderr: string
  exitCode: number | null
  signalCode: NodeJS.Signals | null
  exitedDueToTimeout: boolean
}): string {
  if (input.stderr) return input.stderr
  if (input.exitedDueToTimeout) {
    return `timed out after ${cleanImportTimeoutMs}ms${input.signalCode ? ` (${input.signalCode})` : ""}`
  }
  if (input.signalCode) return `terminated by signal ${input.signalCode}`
  return `exit ${input.exitCode}`
}

async function main() {
  const args = process.argv.slice(2)
  const snapshot = await materializeSnapshot(snapshotRequest(args))
  try {
    const files = snapshot.productionModules
    const { graph, edgeCount } = await runtimeGraph(snapshot.root, files)
    const allComponents = stronglyConnectedComponents(graph)
    const multiModuleComponents = allComponents
      .filter((component) => component.length > 1)
      .sort((a, b) => b.length - a.length)
    const selfReferences = allComponents
      .filter((component) => component.length === 1 && graph.get(component[0]!)?.has(component[0]!))
      .map((component) => component[0]!)
      .sort()
    const failures: string[] = []

    const componentSizes = multiModuleComponents.map((component) => component.length)
    for (const component of multiModuleComponents) {
      const budget = retainedComponentBudgets.find((candidate) =>
        component.every((member) => candidate.members.has(member)),
      )
      if (!budget) {
        failures.push(
          `multi-module component contains an unknown or cross-boundary cycle (${component.length} modules)`,
        )
        continue
      }
      if (component.length > budget.maximumSize) {
        failures.push(
          `${budget.name} component exceeds its retained ceiling ${budget.maximumSize}: received ${component.length}`,
        )
      }
    }
    if (selfReferences.length > 0) {
      failures.push(`self-references: ${selfReferences.join(", ")}`)
    }
    failures.push(...(await checkCleanImports(snapshot.root)))

    if (failures.length > 0) {
      for (const failure of failures) console.error(`module-topology: ${failure}`)
      for (const component of multiModuleComponents) console.error(componentDiagnostic(component, graph))
      for (const selfReference of selfReferences) console.error(`  self-reference: ${selfReference}`)
      console.error(`module-topology FAILED (${failures.length} problem${failures.length === 1 ? "" : "s"})`)
      process.exitCode = 1
      return
    }

    console.log(
      `module-topology ok (${snapshot.label}) — ${files.length} modules, ${edgeCount} runtime edges, retained SCC sizes ${[
        ...componentSizes,
        ...selfReferences.map(() => 1),
      ].join(", ")}; ${cleanImportEntrypoints.length} clean imports passed`,
    )
  } finally {
    await rm(snapshot.root, { recursive: true, force: true })
  }
}

if (import.meta.main) await main()
