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
import { gitlabAuthPlugin as GitlabAuthPlugin } from "opencode-gitlab-auth"
import { PoeAuthPlugin } from "opencode-poe-auth"
import { AzureAuthPlugin } from "./azure"
import { CloudflareAIGatewayAuthPlugin, CloudflareWorkersAuthPlugin } from "./cloudflare"
import { CodexAuthPlugin } from "./openai/codex"
import { CopilotAuthPlugin } from "./github-copilot/copilot"
import { DigitalOceanAuthPlugin } from "./digitalocean"
import { SnowflakeCortexAuthPlugin } from "./snowflake-cortex"
import { XaiAuthPlugin } from "./xai"
import { IN_PROCESS_BASE_URL, createInProcessFetch } from "@/server/in-process-client"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import z from "zod"
import { lazy } from "@/util/lazy"

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
type HookEntry = { owner: "internal" | "project"; specifier: string; serviceID?: string; hook: RuntimeHooks }

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

  // Built-in plugins that are directly imported (not installed from npm)
  // GitlabAuthPlugin is compiled against an older plugin interface version
  // whose OpenCorvusClient type is a strict subset of the current one.
  const INTERNAL_PLUGINS: PluginInstance[] = [
    CodexAuthPlugin,
    CopilotAuthPlugin,
    GitlabAuthPlugin as unknown as PluginInstance,
    PoeAuthPlugin as unknown as PluginInstance,
    CloudflareWorkersAuthPlugin,
    CloudflareAIGatewayAuthPlugin,
    AzureAuthPlugin,
    DigitalOceanAuthPlugin,
    SnowflakeCortexAuthPlugin,
    XaiAuthPlugin,
  ]

  type GlobalProviderPluginInput = Pick<PluginInput, "client" | "serverUrl" | "$" | "resources">

  const globalProviderHooks = lazy(async () => {
    const { createOpenCorvusClient } = await import("@opencorvus-ai/sdk")
    const input: GlobalProviderPluginInput = {
      client: createOpenCorvusClient({
        baseUrl: IN_PROCESS_BASE_URL,
        fetch: createInProcessFetch(),
      }),
      serverUrl: new URL(IN_PROCESS_BASE_URL),
      $: Bun.$,
      resources: emptyResources(),
    }
    const hooks: Hooks[] = []
    for (const plugin of INTERNAL_PLUGINS) {
      const specifier = `internal:${plugin.name || "anonymous"}`
      try {
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

  function createPluginResources(manifestPath: string, resources: PluginResourceManifestEntry[]): PluginResources {
    const root = pluginManifestResourceRoot(manifestPath)
    const resolved = resources.map((resource): PluginResource => {
      const selectedPath = resourceManifestPath(resource)
      return {
        id: resource.id,
        kind: resource.kind,
        path: selectedPath,
        absolutePath: path.resolve(root, selectedPath),
      }
    })
    return {
      all: () => [...resolved],
      get(id) {
        const resource = resolved.find((item) => item.id === id)
        if (!resource) throw new Error(`Plugin resource not available: ${id}`)
        return resource
      },
    }
  }

  function pluginFailure(phase: string, specifier: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause)
    return new Error(`Plugin ${phase} failed for ${specifier}: ${message}`, { cause })
  }

  const state = createInstanceState(
    async () => {
      const { createOpenCorvusClient } = await import("@opencorvus-ai/sdk")
      const client = createOpenCorvusClient({
        baseUrl: IN_PROCESS_BASE_URL,
        directory: Instance.directory,
        fetch: createInProcessFetch(),
      })
      const config = await Config.get()
      const hooks: HookEntry[] = []
      const baseInput = {
        client,
        project: Instance.project,
        worktree: Instance.worktree,
        directory: Instance.directory,
        serverUrl: new URL(IN_PROCESS_BASE_URL),
        $: Bun.$,
      }

      function pluginInput(resources: PluginResources = emptyResources()): PluginInput {
        return {
          ...baseInput,
          resources,
        }
      }

      for (const plugin of INTERNAL_PLUGINS) {
        log.info("loading internal plugin", { name: plugin.name })
        const specifier = `internal:${plugin.name || "anonymous"}`
        try {
          hooks.push({ owner: "internal", specifier, hook: (await plugin(pluginInput())) as RuntimeHooks })
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
      ) {
        try {
          const mod = await import(plugin)
          const seen = new Set<PluginInstance>()
          const loaded: HookEntry[] = []
          for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
            if (seen.has(fn)) continue
            seen.add(fn)
            loaded.push({
              owner: "project",
              specifier: diagnosticSpecifier,
              serviceID,
              hook: await fn(pluginInput(resources)),
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
            const resources = createPluginResources(manifestPath, manifest.resources)
            log.info("loading plugin manifest", {
              path: plugin,
              packageSpecifier: manifest.packageSpecifier,
              backendExport: manifest.backendExport,
              serviceID: manifest.serviceID,
            })
            await loadPluginModule(backend, plugin, manifest.serviceID, resources)
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
