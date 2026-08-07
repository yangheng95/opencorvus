import { createHash, randomUUID } from "node:crypto"
import { lstat, mkdir, readFile, realpath, rename, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import type ts from "typescript"
import "property-information"
import { Global } from "@/global"
import { runtimePackageRequire } from "@/runtime/package-require"
import { Filesystem } from "@/util/filesystem"

const PACKAGE_TOOL_ABI = "opencorvus.expert-squad.package-tool.v1"
const ALLOWED_NODE_IMPORTS = new Set([
  "node:assert",
  "node:buffer",
  "node:crypto",
  "node:os",
  "node:path",
  "node:url",
  "node:util",
  "node:zlib",
])
const PLUGIN_IMPORT = "@opencorvus-ai/plugin"
const PLUGIN_TOOL_IMPORT = "@opencorvus-ai/plugin/tool"
export const PACKAGE_TOOL_FILES_FACADE_IMPORT = "@opencorvus-ai/plugin/files"
const NATIVE_FILES_IMPORTS = new Set(["node:fs", "node:fs/promises"])
const PLUGIN_FILES_NAMESPACE = "opencorvus-expert-squad-plugin-files"
const PLUGIN_FILES_FACADE_SOURCE = `
import { packageToolFiles } from "@opencorvus-ai/plugin";
export const access = packageToolFiles.access;
export const copyFile = packageToolFiles.copyFile;
export const cp = packageToolFiles.cp;
export const lstat = packageToolFiles.lstat;
export const mkdir = packageToolFiles.mkdir;
export const mkdtemp = packageToolFiles.mkdtemp;
export const readFile = packageToolFiles.readFile;
export const readdir = packageToolFiles.readdir;
export const realpath = packageToolFiles.realpath;
export const rename = packageToolFiles.rename;
export const rm = packageToolFiles.rm;
export const stat = packageToolFiles.stat;
export const writeFile = packageToolFiles.writeFile;
export const promises = packageToolFiles;
const fileSystemFacade = Object.freeze({ ...packageToolFiles, promises: packageToolFiles });
export default fileSystemFacade;
`
const SDK_PROJECT_PATH_IMPORT = "@opencorvus-ai/sdk/project-path"
const PLUGIN_RUNTIME_NAMESPACE = "opencorvus-expert-squad-plugin-runtime"
const SDK_PROJECT_PATH_NAMESPACE = "opencorvus-sdk-project-path-runtime"
export const PACKAGE_TOOL_ALLOWED_PACKAGE_IMPORTS = ["typescript"] as const
const ALLOWED_PACKAGE_IMPORTS = new Set<string>(PACKAGE_TOOL_ALLOWED_PACKAGE_IMPORTS)
const ALLOWED_LIBRARY_EXTENSIONS = new Set([".ts", ".js", ".json"])
const TEXT_ASSET_EXTENSIONS = new Set([".html", ".md", ".txt", ".css", ".svg"])
const CANONICAL_SEGMENT = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/

export namespace PackageToolBundle {
  export interface ClosureEntry {
    readonly path: string
    readonly extension: string
    readonly sha256: string
  }

  export interface CoreImport {
    readonly specifier: string
    readonly sha256?: string
  }

  export interface Snapshot {
    readonly domain: typeof PACKAGE_TOOL_ABI
    readonly ref: string
    readonly entry: string
    readonly files: readonly ClosureEntry[]
    readonly coreImports: readonly CoreImport[]
    readonly compiledBundleSHA256: string
  }

  export interface Prepared {
    readonly bundlePath: string
    readonly snapshot: Snapshot
  }

  export interface PrepareInput {
    packageID: string
    packageRoot: string
    ref: string
    owner: string
    sourcePath: string
  }

  interface PluginRuntimeClosure {
    readonly source: string
    readonly sha256: string
    readonly zodEntry: string
  }

  function normalizeRelative(value: string) {
    return value.split(path.sep).join("/")
  }

  function normalizeBundlerPath(value: string) {
    return value.split(path.win32.sep).join(path.posix.sep)
  }

  function exactSpecifierFilter(specifier: string) {
    return new RegExp(`^${specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`)
  }

  function sha256(bytes: Uint8Array | string) {
    return createHash("sha256").update(bytes).digest("hex")
  }

  function compareUTF8Bytes(left: string, right: string) {
    return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"))
  }

  function isStringLiteralLike(typescript: typeof ts, node: ts.Node | undefined): node is ts.StringLiteralLike {
    return Boolean(node && (typescript.isStringLiteral(node) || typescript.isNoSubstitutionTemplateLiteral(node)))
  }

  function validateTrackedCodeLoading(file: string, source: string, coreImports: Set<string>) {
    const typescript = runtimePackageRequire()("typescript") as typeof ts
    const sourceFile = typescript.createSourceFile(file, source, typescript.ScriptTarget.Latest, true)
    const fail = (node: ts.Node, message: string): never => {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
      throw new Error(`${file}:${position.line + 1}:${position.character + 1}: ${message}`)
    }
    const visit = (node: ts.Node) => {
      if (
        typescript.isImportDeclaration(node) &&
        !node.importClause?.isTypeOnly &&
        isStringLiteralLike(typescript, node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text
        if (!specifier.startsWith(".") && !specifier.startsWith("file:") && !path.isAbsolute(specifier)) {
          assertAllowedModuleSpecifier(specifier, file, coreImports)
        }
      }
      if (
        typescript.isExportDeclaration(node) &&
        !node.isTypeOnly &&
        isStringLiteralLike(typescript, node.moduleSpecifier)
      ) {
        const specifier = node.moduleSpecifier.text
        if (!specifier.startsWith(".") && !specifier.startsWith("file:") && !path.isAbsolute(specifier)) {
          assertAllowedModuleSpecifier(specifier, file, coreImports)
        }
      }
      if (
        typescript.isImportEqualsDeclaration(node) &&
        !node.isTypeOnly &&
        typescript.isExternalModuleReference(node.moduleReference) &&
        isStringLiteralLike(typescript, node.moduleReference.expression)
      ) {
        const specifier = node.moduleReference.expression.text
        if (!specifier.startsWith(".") && !specifier.startsWith("file:") && !path.isAbsolute(specifier)) {
          assertAllowedModuleSpecifier(specifier, file, coreImports)
        }
      }
      if (typescript.isCallExpression(node)) {
        const isDynamicImport = node.expression.kind === typescript.SyntaxKind.ImportKeyword
        const isRequire = typescript.isIdentifier(node.expression) && node.expression.text === "require"
        if ((isDynamicImport || isRequire) && !isStringLiteralLike(typescript, node.arguments[0])) {
          fail(node, `${isDynamicImport ? "import" : "require"}() requires one literal module specifier`)
        }
        if ((isDynamicImport || isRequire) && isStringLiteralLike(typescript, node.arguments[0])) {
          const specifier = node.arguments[0].text
          if (!specifier.startsWith(".") && !specifier.startsWith("file:") && !path.isAbsolute(specifier)) {
            assertAllowedModuleSpecifier(specifier, file, coreImports)
          }
        }
      }
      typescript.forEachChild(node, visit)
    }
    visit(sourceFile)
  }

  function rewriteNativeFilesModuleSpecifiers(file: string, source: string): string {
    const typescript = runtimePackageRequire()("typescript") as typeof ts
    const sourceFile = typescript.createSourceFile(file, source, typescript.ScriptTarget.Latest, true)
    const replacements: Array<{ start: number; end: number }> = []
    const record = (node: ts.StringLiteralLike | undefined) => {
      if (!node || !NATIVE_FILES_IMPORTS.has(node.text)) return
      replacements.push({ start: node.getStart(sourceFile), end: node.getEnd() })
    }
    const visit = (node: ts.Node) => {
      if (typescript.isImportDeclaration(node) && isStringLiteralLike(typescript, node.moduleSpecifier)) {
        record(node.moduleSpecifier)
      }
      if (typescript.isExportDeclaration(node) && isStringLiteralLike(typescript, node.moduleSpecifier)) {
        record(node.moduleSpecifier)
      }
      if (
        typescript.isImportEqualsDeclaration(node) &&
        typescript.isExternalModuleReference(node.moduleReference) &&
        isStringLiteralLike(typescript, node.moduleReference.expression)
      ) {
        record(node.moduleReference.expression)
      }
      if (typescript.isCallExpression(node)) {
        const isDynamicImport = node.expression.kind === typescript.SyntaxKind.ImportKeyword
        const isRequire = typescript.isIdentifier(node.expression) && node.expression.text === "require"
        if ((isDynamicImport || isRequire) && isStringLiteralLike(typescript, node.arguments[0])) {
          record(node.arguments[0])
        }
      }
      typescript.forEachChild(node, visit)
    }
    visit(sourceFile)
    return replacements
      .sort((left, right) => right.start - left.start)
      .reduce(
        (rewritten, replacement) =>
          `${rewritten.slice(0, replacement.start)}${JSON.stringify(PACKAGE_TOOL_FILES_FACADE_IMPORT)}${rewritten.slice(replacement.end)}`,
        source,
      )
  }

  async function compilePluginRuntimeClosure(): Promise<PluginRuntimeClosure> {
    const entry = runtimePackageRequire().resolve(PLUGIN_TOOL_IMPORT)
    const pluginRequire = createRequire(entry)
    const zodEntry = pluginRequire.resolve("zod")
    const propertyInformationEntry = pluginRequire.resolve("property-information")
    const sdkProjectPathEntry = pluginRequire.resolve(SDK_PROJECT_PATH_IMPORT)
    const sdkProjectPathSource = await readFile(sdkProjectPathEntry, "utf8")
    const result = await Bun.build({
      entrypoints: [normalizeBundlerPath(entry)],
      target: "node",
      format: "esm",
      packages: "bundle",
      minify: true,
      plugins: [
        {
          name: "opencorvus-expert-squad-plugin-runtime-closure",
          setup(build) {
            build.onResolve({ filter: /^zod$/ }, () => ({ path: normalizeBundlerPath(zodEntry) }))
            build.onResolve({ filter: /^property-information$/ }, () => ({
              path: normalizeBundlerPath(propertyInformationEntry),
            }))
            build.onResolve({ filter: exactSpecifierFilter(SDK_PROJECT_PATH_IMPORT) }, () => ({
              path: SDK_PROJECT_PATH_IMPORT,
              namespace: SDK_PROJECT_PATH_NAMESPACE,
            }))
            build.onLoad({ filter: /.*/, namespace: SDK_PROJECT_PATH_NAMESPACE }, () => ({
              contents: sdkProjectPathSource,
              loader: "js",
              resolveDir: path.dirname(sdkProjectPathEntry),
            }))
          },
        },
      ],
    })
    if (!result.success) {
      throw new Error(
        `Failed to compile ${PLUGIN_TOOL_IMPORT} runtime closure: ${result.logs.map((item) => item.message).join("; ")}`,
      )
    }
    if (result.outputs.length !== 1) {
      throw new Error(
        `${PLUGIN_TOOL_IMPORT} runtime closure produced ${result.outputs.length} outputs; expected exactly one`,
      )
    }
    const bytes = Buffer.from(await result.outputs[0]!.arrayBuffer())
    return { source: bytes.toString("utf8"), sha256: sha256(bytes), zodEntry }
  }

  async function externalImportFingerprint(
    specifier: string,
    pluginRuntime: PluginRuntimeClosure,
  ): Promise<CoreImport> {
    if (ALLOWED_NODE_IMPORTS.has(specifier)) return { specifier }
    if (specifier === PACKAGE_TOOL_FILES_FACADE_IMPORT) {
      return { specifier, sha256: sha256(PLUGIN_FILES_FACADE_SOURCE) }
    }
    if (specifier === PLUGIN_IMPORT) return { specifier, sha256: pluginRuntime.sha256 }
    const entry = runtimePackageRequire().resolve(specifier)
    return { specifier, sha256: sha256(await readFile(entry)) }
  }

  function assertAllowedModuleSpecifier(specifier: string, importingFile: string, coreImports: Set<string>) {
    if (NATIVE_FILES_IMPORTS.has(specifier)) {
      coreImports.add(PACKAGE_TOOL_FILES_FACADE_IMPORT)
      return
    }
    if (ALLOWED_NODE_IMPORTS.has(specifier) || specifier === PLUGIN_IMPORT || ALLOWED_PACKAGE_IMPORTS.has(specifier)) {
      coreImports.add(specifier)
      return
    }
    if (specifier.startsWith("node:")) {
      throw new Error(`Package tool ${importingFile} imports unsupported core module ${JSON.stringify(specifier)}`)
    }
    throw new Error(`Package tool ${importingFile} imports unsupported bare module ${JSON.stringify(specifier)}`)
  }

  export async function prepare(input: PrepareInput): Promise<Prepared> {
    assertBunRuntime(input.ref)
    return prepareWithPluginRuntime(input, await compilePluginRuntimeClosure())
  }

  export async function prepareMany(inputs: readonly PrepareInput[]): Promise<readonly Prepared[]> {
    if (inputs.length === 0) return []
    assertBunRuntime(inputs[0]!.ref)
    const pluginRuntime = await compilePluginRuntimeClosure()
    return Promise.all(inputs.map((input) => prepareWithPluginRuntime(input, pluginRuntime)))
  }

  async function prepareWithPluginRuntime(input: PrepareInput, pluginRuntime: PluginRuntimeClosure): Promise<Prepared> {
    const refParts = input.ref.split("/")
    if (
      refParts.length !== 3 ||
      refParts[0] !== input.packageID ||
      refParts[1] !== input.owner ||
      !refParts[2] ||
      !CANONICAL_SEGMENT.test(input.packageID) ||
      !CANONICAL_SEGMENT.test(input.owner) ||
      !CANONICAL_SEGMENT.test(refParts[2])
    ) {
      throw new Error(
        `Package tool ref ${JSON.stringify(input.ref)} must equal ${input.packageID}/${input.owner}/<tool-id>`,
      )
    }
    const toolID = refParts[2]
    const sourceExtension = path.extname(input.sourcePath).toLowerCase()
    if (sourceExtension !== ".ts" && sourceExtension !== ".js") {
      throw new Error(`Package tool ${input.ref}: executable entry extension must be .ts or .js`)
    }
    const lexicalRoot = path.resolve(input.packageRoot)
    const rootInfo = await lstat(lexicalRoot)
    if (rootInfo.isSymbolicLink())
      throw new Error(`Package tool ${input.ref}: package root symbolic links are not allowed`)
    if (!rootInfo.isDirectory()) throw new Error(`Package tool ${input.ref}: package root must be a directory`)
    const realRoot = await realpath(lexicalRoot)
    const sourceInfo = await lstat(input.sourcePath)
    if (sourceInfo.isSymbolicLink()) throw new Error(`Package tool ${input.ref}: entry symbolic links are not allowed`)
    if (!sourceInfo.isFile()) throw new Error(`Package tool ${input.ref}: executable entry must be a file`)
    const realSource = await realpath(input.sourcePath)
    const entryRoot =
      input.owner === "shared"
        ? path.join(lexicalRoot, "tools")
        : path.join(lexicalRoot, "agents", input.owner, "tools")
    const privateLibRoot = input.owner === "shared" ? undefined : path.join(realRoot, "agents", input.owner, "lib")
    const sharedLibRoot = path.join(realRoot, "lib")
    const sharedAssetsRoot = path.join(realRoot, "assets")
    const expectedSource = path.join(entryRoot, `${toolID}${sourceExtension}`)
    if (
      path.dirname(expectedSource) !== entryRoot ||
      path.resolve(input.sourcePath) !== expectedSource ||
      realSource !== (await realpath(expectedSource))
    ) {
      throw new Error(`Package tool ${input.ref}: source path does not match its package ref and owner`)
    }

    const allowedDependencyRoots = [privateLibRoot, sharedLibRoot, sharedAssetsRoot].filter((value): value is string =>
      Boolean(value),
    )
    const closure = new Map<string, ClosureEntry>()
    const coreImports = new Set<string>()
    const allowedPackageEntries = new Map(
      PACKAGE_TOOL_ALLOWED_PACKAGE_IMPORTS.map((specifier) => [specifier, runtimePackageRequire().resolve(specifier)]),
    )
    const zodEntry = pluginRuntime.zodEntry
    let result: Awaited<ReturnType<typeof Bun.build>>
    try {
      result = await Bun.build({
        entrypoints: [normalizeBundlerPath(realSource)],
        target: "node",
        format: "esm",
        packages: "bundle",
        minify: true,
        plugins: [
          {
            name: "opencorvus-expert-squad-package-tool-closure",
            setup(build) {
              build.onResolve({ filter: /^@opencorvus-ai\/plugin$/ }, () => ({
                path: "plugin-runtime.mjs",
                namespace: PLUGIN_RUNTIME_NAMESPACE,
              }))
              build.onLoad({ filter: /.*/, namespace: PLUGIN_RUNTIME_NAMESPACE }, () => ({
                contents: pluginRuntime.source,
                loader: "js",
              }))
              build.onResolve({ filter: exactSpecifierFilter(PACKAGE_TOOL_FILES_FACADE_IMPORT) }, () => ({
                path: PACKAGE_TOOL_FILES_FACADE_IMPORT,
                namespace: PLUGIN_FILES_NAMESPACE,
              }))
              build.onLoad({ filter: /.*/, namespace: PLUGIN_FILES_NAMESPACE }, () => ({
                contents: PLUGIN_FILES_FACADE_SOURCE,
                loader: "js",
              }))
              build.onResolve({ filter: /^zod$/ }, () => ({ path: normalizeBundlerPath(zodEntry) }))
              for (const [specifier, entry] of allowedPackageEntries) {
                build.onResolve({ filter: exactSpecifierFilter(specifier) }, () => ({
                  path: normalizeBundlerPath(entry),
                }))
              }
              const rejectAbsoluteImport = (args: { importer: string; path: string }) => {
                if (!args.importer && path.resolve(args.path) === realSource) return undefined
                if (args.importer && !Filesystem.contains(realRoot, args.importer)) return undefined
                throw new Error(
                  `Package tool ${input.ref}: absolute and file-URL imports are not supported: ${JSON.stringify(args.path)}`,
                )
              }
              build.onResolve({ filter: /^file:/ }, rejectAbsoluteImport)
              build.onResolve({ filter: /^\// }, rejectAbsoluteImport)
              build.onResolve({ filter: /^[A-Za-z]:[\\/]/ }, rejectAbsoluteImport)
              build.onResolve({ filter: /^\\\\/ }, rejectAbsoluteImport)
              build.onResolve({ filter: /^\./ }, async (args) => {
                if (!args.importer || !Filesystem.contains(realRoot, args.importer)) return undefined
                const specifier = args.path
                const unresolved = path.resolve(args.resolveDir, specifier)
                if (!allowedDependencyRoots.some((root) => Filesystem.contains(root, unresolved))) {
                  throw new Error(
                    `Package tool ${input.ref}: relative import ${JSON.stringify(specifier)} crosses its owner boundary`,
                  )
                }
                if (path.extname(specifier)) return undefined
                const resolved = await Bun.resolve(specifier, args.resolveDir)
                const resolvedExtension = path.extname(resolved).toLowerCase()
                if (!ALLOWED_LIBRARY_EXTENSIONS.has(resolvedExtension) || resolvedExtension === ".json") {
                  throw new Error(
                    `Package tool ${input.ref}: extensionless code import ${JSON.stringify(specifier)} resolved to unsupported extension ${resolvedExtension || "<none>"}`,
                  )
                }
                if (!allowedDependencyRoots.some((root) => Filesystem.contains(root, resolved))) {
                  throw new Error(
                    `Package tool ${input.ref}: resolved relative import ${JSON.stringify(specifier)} crosses its owner boundary`,
                  )
                }
                return { path: normalizeBundlerPath(resolved) }
              })
              build.onLoad({ filter: /.*/ }, async (args) => {
                const candidate = path.resolve(args.path)
                if (!Filesystem.contains(realRoot, candidate)) return undefined
                const info = await lstat(candidate)
                if (info.isSymbolicLink()) throw new Error(`Package tool ${input.ref}: symbolic links are not allowed`)
                if (!info.isFile()) throw new Error(`Package tool ${input.ref}: imported dependency must be a file`)
                const realTarget = await realpath(candidate)
                if (!Filesystem.contains(realRoot, realTarget)) {
                  throw new Error(`Package tool ${input.ref}: imported dependency escapes the package root`)
                }
                if (
                  realTarget !== realSource &&
                  !allowedDependencyRoots.some((root) => Filesystem.contains(root, realTarget))
                ) {
                  throw new Error(`Package tool ${input.ref}: imported dependency crosses its owner boundary`)
                }
                const bytes = await readFile(realTarget)
                const extension = path.extname(realTarget).toLowerCase()
                const isAsset = Filesystem.contains(sharedAssetsRoot, realTarget)
                const allowedExtensions = isAsset
                  ? new Set([...ALLOWED_LIBRARY_EXTENSIONS, ...TEXT_ASSET_EXTENSIONS])
                  : ALLOWED_LIBRARY_EXTENSIONS
                if (realTarget !== realSource && !allowedExtensions.has(extension)) {
                  throw new Error(
                    `Package tool ${input.ref}: library dependency ${normalizeRelative(path.relative(realRoot, realTarget))} has unsupported extension ${extension || "<none>"}`,
                  )
                }
                let bundledContents: Buffer | string = bytes
                if (/\.(?:[cm]?[jt]sx?)$/i.test(realTarget)) {
                  const source = bytes.toString("utf8")
                  validateTrackedCodeLoading(
                    normalizeRelative(path.relative(realRoot, realTarget)),
                    source,
                    coreImports,
                  )
                  bundledContents = rewriteNativeFilesModuleSpecifiers(
                    normalizeRelative(path.relative(realRoot, realTarget)),
                    source,
                  )
                }
                const relative = normalizeRelative(path.relative(realRoot, realTarget))
                closure.set(relative, { path: relative, extension, sha256: sha256(bytes) })
                if (extension === ".json") return undefined
                if (TEXT_ASSET_EXTENSIONS.has(extension)) {
                  return { contents: bytes.toString("utf8"), loader: "text" }
                }
                return { contents: bundledContents, loader: args.loader }
              })
            },
          },
        ],
      })
    } catch (error) {
      const nested = (error as { errors?: unknown[] }).errors
      const detail = nested?.length
        ? nested.map((item) => (item instanceof Error ? item.message : String(item))).join("; ")
        : error instanceof Error
          ? error.message
          : String(error)
      throw new Error(`Package tool ${input.ref}: failed to compile ${input.sourcePath}: ${detail}`, { cause: error })
    }
    if (!result.success) {
      const detail = result.logs.map((item) => item.message).join("; ")
      throw new Error(`Package tool ${input.ref}: failed to compile ${input.sourcePath}: ${detail}`)
    }
    if (result.outputs.length !== 1) {
      throw new Error(
        `Package tool ${input.ref}: compile produced ${result.outputs.length} outputs; expected exactly one`,
      )
    }
    const compiledBytes = Buffer.from(await result.outputs[0]!.arrayBuffer())
    const compiledBundleSHA256 = sha256(compiledBytes)
    const entry = normalizeRelative(path.relative(realRoot, realSource))
    const snapshot: Snapshot = {
      domain: PACKAGE_TOOL_ABI,
      ref: input.ref,
      entry,
      files: [...closure.values()].sort((left, right) => compareUTF8Bytes(left.path, right.path)),
      coreImports: await Promise.all(
        [...coreImports].sort(compareUTF8Bytes).map((specifier) => externalImportFingerprint(specifier, pluginRuntime)),
      ),
      compiledBundleSHA256,
    }
    const bundlePath = await publishBundle(compiledBundleSHA256, compiledBytes, input.ref)
    return { bundlePath, snapshot }
  }

  function assertBunRuntime(ref: string): void {
    if (typeof Bun === "undefined") {
      throw new Error(`Package tool ${ref}: Bun runtime is required to compile expert-squad package tools.`)
    }
  }

  const bundlePublications = new Map<string, Promise<string>>()

  async function publishBundle(digest: string, bytes: Buffer, ref: string): Promise<string> {
    const active = bundlePublications.get(digest)
    if (active) return active
    const publication = (async () => {
      const outdir = path.join(Global.Path.cache, "expert-squad-package-tools", PACKAGE_TOOL_ABI)
      const bundlePath = path.join(outdir, `${digest}.mjs`)
      await mkdir(outdir, { recursive: true })
      const existing = await readFile(bundlePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (existing) {
        if (sha256(existing) !== digest) {
          throw new Error(`Package tool ${ref}: content-addressed bundle cache is corrupt at ${bundlePath}`)
        }
        return bundlePath
      }

      const temporaryPath = path.join(outdir, `.${digest}.${process.pid}.${randomUUID()}.tmp`)
      await writeFile(temporaryPath, bytes, { flag: "wx" })
      try {
        await rename(temporaryPath, bundlePath)
      } catch (error) {
        const target = await readFile(bundlePath).catch((readError: NodeJS.ErrnoException) => {
          if (readError.code === "ENOENT") return undefined
          throw readError
        })
        if (!target || sha256(target) !== digest) throw error
      } finally {
        await rm(temporaryPath, { force: true })
      }
      return bundlePath
    })()
    bundlePublications.set(digest, publication)
    try {
      return await publication
    } finally {
      bundlePublications.delete(digest)
    }
  }
}
