import type {
  Hooks,
  PluginInput,
  PluginResource,
  PluginResourceManifestEntry,
  PluginResources,
  PluginServiceRegistration,
  Plugin as PluginInstance,
} from "@opencorvus-ai/plugin"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { BunProc } from "../bun"
import { Instance } from "../project/instance"
import { createInstanceState } from "../project/instance-state"
import { NamedError } from "@opencorvus-ai/util/error"
import { supervisedHostProcessFacade } from "@/util/process-facade"
import { PoeAuthPlugin } from "opencode-poe-auth"
import { AzureAuthPlugin } from "./azure"
import { CloudflareAIGatewayAuthPlugin, CloudflareWorkersAuthPlugin } from "./cloudflare"
import { CodexAuthPlugin } from "./openai/codex"
import { CopilotAuthPlugin } from "./github-copilot/copilot"
import { DigitalOceanAuthPlugin } from "./digitalocean"
import { SnowflakeCortexAuthPlugin } from "./snowflake-cortex"
import { XaiAuthPlugin } from "./xai"
import { GitlabAuthPlugin } from "./gitlab"
import { IN_PROCESS_BASE_URL } from "@/server/in-process-client"
import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { createHash, randomUUID } from "node:crypto"
import z from "zod"
import { lazy } from "@/util/lazy"
import { Auth } from "@/auth"
import { ProviderCredentialExchange } from "@/provider/credential-exchange"
import { Session } from "@/session"
import { MessageStore } from "@/session/message-store"
import { canonicalDigestSource, compareCanonicalStrings } from "@/util/canonical-digest"
import { Installation } from "@/installation"
import { Global } from "@/global"

export type ChatParamsOutput = Parameters<Required<Hooks>["chat.params"]>[1]
type ChatHeadersOutput = Parameters<Required<Hooks>["chat.headers"]>[1]
type ChatMessageInput = Parameters<Required<Hooks>["chat.params"]>[0]

export type PhysicalProviderRequest = Omit<ChatMessageInput, "message"> & {
  requestID: string
  message?: ChatMessageInput["message"]
}

export type PhysicalProviderHooks = {
  "provider.chat.params"?: (input: PhysicalProviderRequest, output: ChatParamsOutput) => Promise<void>
  "provider.chat.headers"?: (input: PhysicalProviderRequest, output: ChatHeadersOutput) => Promise<void>
}

type RuntimeHooks = Hooks & PhysicalProviderHooks
type HookEntry = {
  owner: "internal" | "project"
  specifier: string
  serviceID?: string
  revision: string
  hook: RuntimeHooks
}

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  export const PluginServiceNotFoundError = NamedError.create(
    "PluginServiceNotFoundError",
    z.object({
      message: z.string(),
      serviceID: z.string(),
    }),
  )

  export const PluginServiceRegistrationError = NamedError.create(
    "PluginServiceRegistrationError",
    z.object({
      message: z.string(),
      serviceID: z.string().optional(),
      specifier: z.string().optional(),
    }),
  )

  // ID = identifier. Duplicate plugin service identifiers would make route
  // ownership ambiguous, so startup keeps this as a hard registration error.
  export const PluginServiceDuplicateIDError = NamedError.create(
    "PluginServiceDuplicateIDError",
    z.object({
      message: z.string(),
      serviceID: z.string(),
      firstSpecifier: z.string(),
      secondSpecifier: z.string(),
    }),
  )

  export type PluginServiceInfo = PluginServiceRegistration & {
    specifier: string
  }

  const PluginServiceRegistrationSchema = z.object({
    id: z.string().min(1),
    app: z.custom<PluginServiceRegistration["app"]>(
      (value) =>
        typeof value === "object" && value !== null && typeof (value as { fetch?: unknown }).fetch === "function",
      "Plugin service app.fetch must be callable",
    ),
  })

  const PluginManifest = z.object({
    packageSpecifier: z.string().min(1),
    serviceID: z.string().min(1),
    backendExport: z.string().min(1),
    overlayExport: z.string().min(1),
    resources: z.array(
      z.object({
        id: z.string().min(1),
        kind: z.enum(["worker", "asset", "runtime"]),
        path: z.string().min(1).optional(),
        paths: z
          .object({
            win32: z.string().min(1).optional(),
            linux: z.string().min(1).optional(),
            darwin: z.string().min(1).optional(),
          })
          .optional(),
      }),
    ),
  })

  // Built-in plugins that are directly imported (not installed from npm).
  const INTERNAL_PLUGINS: PluginInstance[] = [
    CodexAuthPlugin,
    CopilotAuthPlugin,
    GitlabAuthPlugin,
    PoeAuthPlugin as unknown as PluginInstance,
    CloudflareWorkersAuthPlugin,
    CloudflareAIGatewayAuthPlugin,
    AzureAuthPlugin,
    DigitalOceanAuthPlugin,
    SnowflakeCortexAuthPlugin,
    XaiAuthPlugin,
  ]

  const credentials: PluginInput["credentials"] = {
    refresh: ProviderCredentialExchange.refresh,
    updateApiMetadata: async (input) => {
      await Auth.updateApiMetadata(input.providerID, input.current, input.metadata)
    },
  }

  const sessions: PluginInput["sessions"] = {
    async message(input) {
      return MessageStore.get(input)
    },
    async get(input) {
      return Session.get(input.sessionID)
    },
  }

  const unavailableSessions: PluginInput["sessions"] = {
    async message() {
      throw new Error("Session facts are unavailable while loading global Provider auth hooks")
    },
    async get() {
      throw new Error("Session facts are unavailable while loading global Provider auth hooks")
    },
  }

  type GlobalProviderPluginInput = Pick<PluginInput, "credentials" | "sessions" | "serverUrl" | "process" | "resources">

  const globalProviderHooks = lazy(async () => {
    const hooks: Hooks[] = []
    for (const plugin of INTERNAL_PLUGINS) {
      const specifier = `internal:${plugin.name || "anonymous"}`
      try {
        const input: GlobalProviderPluginInput = {
          credentials,
          sessions: unavailableSessions,
          serverUrl: new URL(IN_PROCESS_BASE_URL),
          process: supervisedHostProcessFacade(`plugin:${specifier}`),
          resources: emptyResources(),
        }
        const hook = await (plugin as unknown as (input: GlobalProviderPluginInput) => Promise<Hooks>)(input)
        if (hook.auth) hooks.push(hook)
      } catch (cause) {
        throw pluginFailure("global Provider hook initialization", specifier, cause)
      }
    }
    return hooks
  })

  function emptyResources(): PluginResources {
    return {
      all: () => [],
      get(id) {
        throw new Error(`Plugin resource not available: ${id}`)
      },
    }
  }

  function pluginManifestPath(plugin: string) {
    return plugin.startsWith("file://") ? fileURLToPath(plugin) : plugin
  }

  function pluginManifestResourceRoot(manifestPath: string) {
    const segments = path.resolve(manifestPath).split(path.sep)
    const pluginSegment = segments.lastIndexOf("plugins")
    if (pluginSegment > 0) return segments.slice(0, pluginSegment).join(path.sep)
    return path.dirname(manifestPath)
  }

  function resourceManifestPath(resource: PluginResourceManifestEntry) {
    const osPath = resource.paths?.[process.platform as "win32" | "linux" | "darwin"]
    const selected = osPath ?? resource.path
    if (!selected) throw new Error(`Plugin resource ${resource.id} has no path for ${process.platform}`)
    return selected
  }

  async function createPluginResources(
    manifestPath: string,
    resources: PluginResourceManifestEntry[],
  ): Promise<{ resources: PluginResources; revision: string }> {
    const root = pluginManifestResourceRoot(manifestPath)
    const seen = new Set<string>()
    const budget = { files: 0, bytes: 0 }
    const resolved: PluginResource[] = []
    const revisions: Array<{ id: string; kind: string; selected_path: string; artifact_digest: string }> = []
    for (const resource of resources) {
      if (seen.has(resource.id)) throw new Error(`Plugin resource ID is duplicated: ${resource.id}`)
      seen.add(resource.id)
      const selectedPath = resourceManifestPath(resource)
      const captured = await capturePluginResource(path.resolve(root, selectedPath), budget)
      const absolutePath = await publishPluginResource(captured, resource.id)
      resolved.push({
        id: resource.id,
        kind: resource.kind,
        path: selectedPath,
        absolutePath,
      })
      revisions.push({
        id: resource.id,
        kind: resource.kind,
        selected_path: selectedPath,
        artifact_digest: captured.digest,
      })
    }
    return {
      resources: {
        all: () => [...resolved],
        get(id) {
          const resource = resolved.find((item) => item.id === id)
          if (!resource) throw new Error(`Plugin resource not available: ${id}`)
          return resource
        },
      },
      revision: canonicalDigestSource("plugin-resource-snapshot-v1", {
        platform: process.platform,
        resources: revisions.sort((left, right) => compareCanonicalStrings(left.id, right.id)),
      }).sha256,
    }
  }

  function pluginFailure(phase: string, specifier: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return new Error(`Plugin ${phase} failed for ${specifier}: ${message}`, { cause })
  }

  const PLUGIN_ARTIFACT_MAX_FILES = 20_000
  const PLUGIN_ARTIFACT_MAX_BYTES = 512 * 1024 * 1024
  type PluginModuleArtifact = Readonly<{
    entry: string
    revision: string
    bytes: Buffer
  }>

  type CapturedPluginResourceEntry =
    | Readonly<{ kind: "directory"; relative: string }>
    | Readonly<{ kind: "file"; relative: string; mode: number; bytes: Buffer }>

  type CapturedPluginResource = Readonly<{
    rootKind: "directory" | "file"
    digest: string
    entries: readonly CapturedPluginResourceEntry[]
  }>

  function bytesSHA256(bytes: Uint8Array): string {
    return createHash("sha256").update(bytes).digest("hex")
  }

  async function pluginModuleEntry(specifier: string): Promise<string> {
    let candidate = specifier.startsWith("file://") ? fileURLToPath(specifier) : specifier
    try {
      if (!path.isAbsolute(candidate)) candidate = await Bun.resolve(candidate, Instance.directory)
      const resolved = await realpath(candidate)
      const stat = await lstat(resolved)
      if (stat.isFile()) return resolved
      if (!stat.isDirectory()) throw new Error("resolved entry is not a file or directory")
      return realpath(await Bun.resolve(resolved, Instance.directory))
    } catch (cause) {
      throw new Error(`Plugin module ${specifier} has no Bun-resolvable deployment entry`, { cause })
    }
  }

  async function buildPluginModuleArtifact(specifier: string): Promise<PluginModuleArtifact> {
    const entry = await pluginModuleEntry(specifier)
    const build = await Bun.build({
      entrypoints: [entry],
      target: "bun",
      format: "esm",
      metafile: true,
      splitting: false,
      packages: "bundle",
    })
    if (!build.success) {
      throw new Error(
        `Plugin module ${specifier} could not be materialized by the Bun loader: ${build.logs.map((log) => log.message).join("; ")}`,
      )
    }
    if (!build.metafile) throw new Error(`Plugin module ${specifier} build produced no module graph`)
    if (build.outputs.length !== 1) {
      throw new Error(`Plugin module ${specifier} build produced ${build.outputs.length} outputs; expected one`)
    }
    const bytes = Buffer.from(await build.outputs[0]!.arrayBuffer())
    const inputCount = Object.keys(build.metafile.inputs).length
    if (inputCount > PLUGIN_ARTIFACT_MAX_FILES || bytes.byteLength > PLUGIN_ARTIFACT_MAX_BYTES) {
      throw new Error(
        `Plugin module artifact exceeds ${PLUGIN_ARTIFACT_MAX_FILES} inputs or ${PLUGIN_ARTIFACT_MAX_BYTES} output bytes`,
      )
    }
    return Object.freeze({ entry, revision: bytesSHA256(bytes), bytes })
  }

  const pluginModulePublications = new Map<string, Promise<string>>()

  async function publishPluginModuleArtifact(artifact: PluginModuleArtifact): Promise<string> {
    const active = pluginModulePublications.get(artifact.revision)
    if (active) return active
    const publication = (async () => {
      const outdir = path.join(Global.Path.cache, "plugin-modules", "bundle-v1")
      const target = path.join(outdir, `${artifact.revision}.mjs`)
      await mkdir(outdir, { recursive: true })
      const existing = await readFile(target).catch((error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") return undefined
        throw error
      })
      if (existing) {
        if (bytesSHA256(existing) !== artifact.revision) {
          throw new Error(`Plugin module content-addressed cache is corrupt at ${target}`)
        }
        return target
      }
      const temporary = path.join(outdir, `.${artifact.revision}.${process.pid}.${randomUUID()}.tmp`)
      await writeFile(temporary, artifact.bytes, { flag: "wx" })
      try {
        await rename(temporary, target)
      } catch (error) {
        const winner = await readFile(target).catch((readError: NodeJS.ErrnoException) => {
          if (readError.code === "ENOENT") return undefined
          throw readError
        })
        if (!winner || bytesSHA256(winner) !== artifact.revision) throw error
      } finally {
        await rm(temporary, { force: true })
      }
      return target
    })()
    pluginModulePublications.set(artifact.revision, publication)
    try {
      return await publication
    } finally {
      pluginModulePublications.delete(artifact.revision)
    }
  }

  async function capturePluginResource(
    source: string,
    budget: { files: number; bytes: number },
  ): Promise<CapturedPluginResource> {
    const root = await realpath(source)
    const rootStat = await lstat(root)
    const rootKind = rootStat.isDirectory() ? "directory" : rootStat.isFile() ? "file" : undefined
    if (!rootKind) throw new Error(`Unsupported Plugin resource artifact: ${source}`)
    const captured: CapturedPluginResourceEntry[] = []
    const visit = async (absolute: string, relative: string, ancestors: ReadonlySet<string>): Promise<void> => {
      const stat = await lstat(absolute)
      if (stat.isSymbolicLink()) {
        const target = await realpath(absolute)
        if (ancestors.has(target)) throw new Error(`Plugin resource contains a symlink cycle at ${relative || "."}`)
        await visit(target, relative, new Set([...ancestors, target]))
        return
      }
      if (stat.isDirectory()) {
        captured.push(Object.freeze({ kind: "directory", relative }))
        const children = (await readdir(absolute, { withFileTypes: true })).sort((left, right) =>
          compareCanonicalStrings(left.name, right.name),
        )
        for (const child of children) {
          await visit(
            path.join(absolute, child.name),
            relative ? `${relative}/${child.name}` : child.name,
            ancestors,
          )
        }
        return
      }
      if (!stat.isFile()) throw new Error(`Unsupported Plugin resource entry: ${absolute}`)
      const bytes = await readFile(absolute)
      budget.files++
      budget.bytes += bytes.byteLength
      if (budget.files > PLUGIN_ARTIFACT_MAX_FILES || budget.bytes > PLUGIN_ARTIFACT_MAX_BYTES) {
        throw new Error(
          `Plugin resources exceed ${PLUGIN_ARTIFACT_MAX_FILES} files or ${PLUGIN_ARTIFACT_MAX_BYTES} bytes`,
        )
      }
      captured.push(Object.freeze({ kind: "file", relative, mode: stat.mode & 0o777, bytes }))
    }
    await visit(root, "", new Set([root]))
    const hash = createHash("sha256").update(`plugin-resource-artifact-v1\0${rootKind}\0`)
    for (const entry of captured) {
      hash.update(`${entry.kind === "directory" ? "d" : "f"}\0${entry.relative}\0`)
      if (entry.kind === "file") {
        hash.update(`${entry.mode}\0${entry.bytes.byteLength}\0`)
        hash.update(entry.bytes)
      }
    }
    return Object.freeze({ rootKind, digest: hash.digest("hex"), entries: Object.freeze(captured) })
  }

  function pluginResourcePayloadPath(root: string, kind: CapturedPluginResource["rootKind"]): string {
    return path.join(root, kind === "directory" ? "directory" : "file")
  }

  async function writeCapturedPluginResource(root: string, captured: CapturedPluginResource): Promise<string> {
    const payload = pluginResourcePayloadPath(root, captured.rootKind)
    if (captured.rootKind === "directory") await mkdir(payload, { recursive: true })
    for (const entry of captured.entries) {
      const target = entry.relative
        ? path.join(payload, ...entry.relative.split("/"))
        : payload
      if (entry.kind === "directory") {
        await mkdir(target, { recursive: true })
        continue
      }
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, entry.bytes, { flag: "wx", mode: entry.mode })
      await chmod(target, entry.mode)
    }
    await writeFile(
      path.join(root, "receipt.json"),
      `${JSON.stringify({ schema_version: 1, digest: captured.digest, root_kind: captured.rootKind })}\n`,
      { flag: "wx" },
    )
    return payload
  }

  async function verifyPublishedPluginResource(
    root: string,
    expected: CapturedPluginResource,
  ): Promise<string | undefined> {
    const receipt = await readFile(path.join(root, "receipt.json"), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (!receipt) return undefined
    const parsed = z
      .object({
        schema_version: z.literal(1),
        digest: z.string().regex(/^[a-f0-9]{64}$/),
        root_kind: z.enum(["directory", "file"]),
      })
      .strict()
      .safeParse(JSON.parse(receipt))
    if (!parsed.success || parsed.data.digest !== expected.digest || parsed.data.root_kind !== expected.rootKind) {
      throw new Error(`Plugin resource content-addressed cache receipt is corrupt at ${root}`)
    }
    const payload = pluginResourcePayloadPath(root, expected.rootKind)
    const verified = await capturePluginResource(payload, { files: 0, bytes: 0 })
    if (verified.digest !== expected.digest) {
      throw new Error(`Plugin resource content-addressed cache payload is corrupt at ${payload}`)
    }
    return payload
  }

  const pluginResourcePublications = new Map<string, Promise<string>>()

  async function publishPluginResource(captured: CapturedPluginResource, resourceID: string): Promise<string> {
    const active = pluginResourcePublications.get(captured.digest)
    if (active) return active
    const publication = (async () => {
      const outdir = path.join(Global.Path.cache, "plugin-resources", "snapshot-v1")
      const target = path.join(outdir, captured.digest)
      await mkdir(outdir, { recursive: true })
      const existing = await verifyPublishedPluginResource(target, captured)
      if (existing) return existing
      const staging = path.join(outdir, `.${captured.digest}.${process.pid}.${randomUUID()}.tmp`)
      await mkdir(staging, { recursive: false })
      try {
        await writeCapturedPluginResource(staging, captured)
        try {
          await rename(staging, target)
        } catch (error) {
          const winner = await verifyPublishedPluginResource(target, captured)
          if (!winner) throw error
        }
      } finally {
        await rm(staging, { recursive: true, force: true })
      }
      const published = await verifyPublishedPluginResource(target, captured)
      if (!published) throw new Error(`Plugin resource ${resourceID} was not published at ${target}`)
      return published
    })()
    pluginResourcePublications.set(captured.digest, publication)
    try {
      return await publication
    } finally {
      pluginResourcePublications.delete(captured.digest)
    }
  }

  async function pluginModuleRevision(specifier: string): Promise<string> {
    return (await buildPluginModuleArtifact(specifier)).revision
  }

  const state = createInstanceState(
    async () => {
      const config = await Config.get()
      const hooks: HookEntry[] = []
      const baseInput = {
        credentials,
        sessions,
        project: Instance.project,
        worktree: Instance.worktree,
        directory: Instance.directory,
        serverUrl: new URL(IN_PROCESS_BASE_URL),
      }

      function pluginInput(resources: PluginResources = emptyResources(), specifier = "anonymous"): PluginInput {
        return {
          ...baseInput,
          process: supervisedHostProcessFacade(`plugin:${specifier}`),
          resources,
        }
      }

      for (const plugin of INTERNAL_PLUGINS) {
        log.info("loading internal plugin", { name: plugin.name })
        const specifier = `internal:${plugin.name || "anonymous"}`
        try {
          hooks.push({
            owner: "internal",
            specifier,
            revision: canonicalDigestSource("internal-plugin-v1", {
              specifier,
              opencorvus_version: Installation.VERSION,
            }).sha256,
            hook: (await plugin(pluginInput(emptyResources(), specifier))) as RuntimeHooks,
          })
        } catch (cause) {
          throw pluginFailure("initialization", specifier, cause)
        }
      }

      function manifestModuleSpecifier(manifest: z.infer<typeof PluginManifest>) {
        if (manifest.backendExport.startsWith("./")) {
          return `${manifest.packageSpecifier}/${manifest.backendExport.slice(2)}`
        }
        if (manifest.backendExport.startsWith("/")) {
          return `${manifest.packageSpecifier}${manifest.backendExport}`
        }
        return manifest.backendExport
      }

      async function loadPluginModule(
        plugin: string,
        diagnosticSpecifier = plugin,
        serviceID?: string,
        resources = emptyResources(),
        options: { artifact?: PluginModuleArtifact; revision?: string } = {},
      ) {
        try {
          const artifact = options.artifact ?? (await buildPluginModuleArtifact(plugin))
          const moduleRevision = options.revision ?? artifact.revision
          await TestHooks.afterModuleArtifactBuilt?.({
            specifier: diagnosticSpecifier,
            revision: artifact.revision,
          })
          const modulePath = await publishPluginModuleArtifact(artifact)
          const mod = await import(pathToFileURL(modulePath).href)
          const seen = new Set<PluginInstance>()
          const loaded: HookEntry[] = []
          for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
            if (seen.has(fn)) continue
            seen.add(fn)
            loaded.push({
              owner: "project",
              specifier: diagnosticSpecifier,
              serviceID,
              revision: moduleRevision,
              hook: await fn(pluginInput(resources, diagnosticSpecifier)),
            })
          }
          if (loaded.length === 0) throw new Error("Plugin module does not export a plugin factory")
          hooks.push(...loaded)
        } catch (cause) {
          throw pluginFailure("module load", diagnosticSpecifier, cause)
        }
      }

      async function loadPluginSpecifier(plugin: string) {
        if (plugin.endsWith(".json") || plugin.endsWith(".jsonc")) {
          try {
            const manifestPath = pluginManifestPath(plugin)
            const raw = await readFile(manifestPath, "utf8")
            const manifest = PluginManifest.parse(JSON.parse(raw))
            const backend = manifestModuleSpecifier(manifest)
            const backendArtifact = await buildPluginModuleArtifact(backend)
            const resourceSnapshot = await createPluginResources(manifestPath, manifest.resources)
            log.info("loading plugin manifest", {
              path: plugin,
              packageSpecifier: manifest.packageSpecifier,
              backendExport: manifest.backendExport,
              serviceID: manifest.serviceID,
            })
            await loadPluginModule(
              backend,
              plugin,
              manifest.serviceID,
              resourceSnapshot.resources,
              {
                artifact: backendArtifact,
                revision: canonicalDigestSource("plugin-manifest-module-v2", {
                  manifest_bytes: raw,
                  backend_revision: backendArtifact.revision,
                  resource_revision: resourceSnapshot.revision,
                }).sha256,
              },
            )
          } catch (cause) {
            throw pluginFailure("manifest load", plugin, cause)
          }
          return
        }

        await loadPluginModule(plugin)
      }

      let plugins = config.plugin ?? []
      if (plugins.length) await Config.waitForDependencies()

      for (let plugin of plugins) {
        log.info("loading plugin", { path: plugin })
        if (!plugin.startsWith("file://")) {
          const lastAtIndex = plugin.lastIndexOf("@")
          const pkg = lastAtIndex > 0 ? plugin.substring(0, lastAtIndex) : plugin
          const version = lastAtIndex > 0 ? plugin.substring(lastAtIndex + 1) : "latest"
          plugin = await BunProc.install(pkg, version)
        }
        // Prevent duplicate initialization when plugins export the same function
        // as both a named export and default export (e.g., `export const X` and `export default X`).
        // Object.entries(mod) would return both entries pointing to the same function reference.
        await loadPluginSpecifier(plugin)
      }

      return {
        hooks,
        input: pluginInput(),
        services: undefined as Promise<Map<string, PluginServiceInfo>> | undefined,
      }
    },
    undefined,
    "plugin",
  )

  function registrationList(result: PluginServiceRegistration | PluginServiceRegistration[] | void) {
    if (!result) return []
    return (Array.isArray(result) ? result : [result]).map((registration) =>
      PluginServiceRegistrationSchema.parse(registration),
    )
  }

  function manifestServiceOwner(entry: { specifier: string; serviceID?: string }) {
    return entry.serviceID ? `${entry.specifier}\u0000${entry.serviceID}` : undefined
  }

  export async function services() {
    const current = await state()
    current.services ??= (async () => {
      const services = new Map<string, PluginServiceInfo>()
      const manifestOwners = new Map<string, { specifier: string; serviceID: string }>()
      const fulfilledManifestOwners = new Set<string>()
      for (const entry of current.hooks) {
        const owner = manifestServiceOwner(entry)
        if (owner && entry.serviceID) {
          manifestOwners.set(owner, { specifier: entry.specifier, serviceID: entry.serviceID })
        }
      }
      for (const entry of current.hooks) {
        if (!entry.hook.service) continue
        let registrations: PluginServiceRegistration[]
        try {
          registrations = registrationList(await entry.hook.service())
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : String(cause)
          throw new PluginServiceRegistrationError(
            { message, serviceID: entry.serviceID, specifier: entry.specifier },
            { cause },
          )
        }
        if (entry.serviceID) {
          const mismatch = registrations.find((registration) => registration.id !== entry.serviceID)
          if (mismatch) {
            throw new PluginServiceRegistrationError({
              message: `Manifest plugin declared service ${entry.serviceID} but registered ${mismatch.id}`,
              serviceID: entry.serviceID,
              specifier: entry.specifier,
            })
          }
          const owner = manifestServiceOwner(entry)
          if (registrations.length > 0 && owner) fulfilledManifestOwners.add(owner)
        }
        for (const registration of registrations) {
          const existing = services.get(registration.id)
          if (existing) {
            const error = new PluginServiceDuplicateIDError({
              message: `Plugin service ${registration.id} is registered by both ${existing.specifier} and ${entry.specifier}`,
              serviceID: registration.id,
              firstSpecifier: existing.specifier,
              secondSpecifier: entry.specifier,
            })
            throw error
          }
          services.set(registration.id, { ...registration, specifier: entry.specifier })
        }
      }
      for (const [owner, manifest] of manifestOwners) {
        if (fulfilledManifestOwners.has(owner)) continue
        throw new PluginServiceRegistrationError({
          message: `Manifest plugin did not register declared service ${manifest.serviceID}`,
          serviceID: manifest.serviceID,
          specifier: manifest.specifier,
        })
      }
      return services
    })()
    return current.services
  }

  export async function trigger<
    Name extends Exclude<keyof Required<Hooks>, "auth" | "event" | "service" | "provider">,
    Input = Parameters<Required<Hooks>[Name]>[0],
    Output = Parameters<Required<Hooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    for (const entry of await state().then((x) => x.hooks)) {
      const fn = entry.hook[name]
      if (!fn) continue
      try {
        await (fn as (input: Input, output: Output) => unknown)(input, output)
      } catch (cause) {
        throw pluginFailure(`hook ${String(name)}`, entry.specifier, cause)
      }
    }
    return output
  }

  export async function triggerPhysicalProvider<
    Name extends keyof Required<PhysicalProviderHooks>,
    Input = Parameters<Required<PhysicalProviderHooks>[Name]>[0],
    Output = Parameters<Required<PhysicalProviderHooks>[Name]>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    return applyPhysicalProviderHooks(name, input, output, (await state()).hooks)
  }

  export async function applyPhysicalProviderHooks<
    Name extends keyof Required<PhysicalProviderHooks>,
    Input = Parameters<Required<PhysicalProviderHooks>[Name]>[0],
    Output = Parameters<Required<PhysicalProviderHooks>[Name]>[1],
  >(name: Name, input: Input, output: Output, entries: HookEntry[]): Promise<Output> {
    for (const entry of entries) {
      if (entry.owner !== "internal") continue
      const fn = entry.hook[name]
      if (!fn) continue
      try {
        await (fn as (input: Input, output: Output) => unknown)(input, output)
      } catch (cause) {
        throw pluginFailure(`physical Provider hook ${String(name)}`, entry.specifier, cause)
      }
    }
    return output
  }

  export async function list() {
    return state().then((x) => x.hooks.map((entry) => entry.hook))
  }

  /** Exact identity of the loaded hook surface for occurrence materialization. */
  export async function revision(): Promise<string> {
    const [current, config] = await Promise.all([state(), Config.get()])
    return canonicalDigestSource("plugin-materialization-revision-v1", {
      opencorvus_version: Installation.VERSION,
      configured_specifiers: [...(config.plugin ?? [])].sort(compareCanonicalStrings),
      loaded_hooks: current.hooks
        .map((entry) => ({
          owner: entry.owner,
          specifier: entry.specifier,
          service_id: entry.serviceID ?? null,
          hook_names: Reflect.ownKeys(entry.hook)
            .filter((key): key is string => typeof key === "string")
            .sort(compareCanonicalStrings),
          revision: entry.revision,
        }))
        .sort((left, right) =>
          compareCanonicalStrings(
            `${left.owner}\u0000${left.specifier}\u0000${left.service_id ?? ""}`,
            `${right.owner}\u0000${right.specifier}\u0000${right.service_id ?? ""}`,
          ),
        ),
    }).sha256
  }

  export namespace TestHooks {
    export let afterModuleArtifactBuilt:
      | ((input: { specifier: string; revision: string }) => void | Promise<void>)
      | undefined

    export function moduleRevision(specifier: string): Promise<string> {
      return pluginModuleRevision(specifier)
    }
  }

  /**
   * Project-independent built-in hook projection for the global Provider
   * control plane. Every returned hook owns authentication and any coupled
   * model projection; installed plugins remain owned by a concrete project
   * configuration and Instance.
   */
  export async function listGlobalProviderHooks() {
    return globalProviderHooks()
  }

  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    for (const entry of hooks) {
      if (!entry.hook.config) continue
      try {
        await entry.hook.config(config)
      } catch (cause) {
        throw pluginFailure("config hook", entry.specifier, cause)
      }
    }
    await services()
    Bus.subscribeAll(async (input) => {
      for (const entry of hooks) {
        if (!entry.hook.event) continue
        try {
          await entry.hook.event({ event: input })
        } catch (cause) {
          throw pluginFailure("event hook", entry.specifier, cause)
        }
      }
    })
  }
}
