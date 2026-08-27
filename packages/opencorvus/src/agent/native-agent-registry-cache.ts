import { Config } from "@/config/config"
import { createInstanceState } from "@/project/instance-state"
import { currentProjectDirectory } from "@/project/instance-context"
import { CanonicalCache } from "@/util/canonical-cache"
import {
  CanonicalDigestContractError,
  canonicalDigestSource,
  type CanonicalDigestSource,
} from "@/util/canonical-digest"

export type NativeAgentRegistryCacheReceipt = Readonly<{
  registry: string
  explicit_entries_detached: number
  default_project_states_detached: number
}>

const CONFIG_DIGEST_DOMAIN = "opencorvus.native-agent-config.v1"

function isOpenRuntimePath(path: readonly string[]): boolean {
  return (
    (path[0] === "agent" && path.length >= 3 && path[2] === "options") ||
    (path[0] === "provider" && path.length >= 3 && path[2] === "options") ||
    (path[0] === "provider" && path.length >= 5 && path[2] === "models" && path[4] === "options") ||
    (path[0] === "mcp" && path.length >= 3 && path[2] === "initialization")
  )
}

function classifyConfigValue(value: unknown, path: string[], active: Set<object>): boolean {
  const context = path.length === 0 ? "config" : `config.${path.join(".")}`
  if (value === null || typeof value === "string" || typeof value === "boolean") return false
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new CanonicalDigestContractError({ context, reason: "non-finite number" })
    return false
  }
  if (typeof value === "function") {
    if (isOpenRuntimePath(path)) return true
    throw new CanonicalDigestContractError({ context, reason: "function outside an open runtime field" })
  }
  if (typeof value !== "object") {
    throw new CanonicalDigestContractError({ context, reason: `unsupported ${typeof value}` })
  }
  const object = value as Record<string, unknown>
  if (active.has(object)) throw new CanonicalDigestContractError({ context, reason: "cycle" })
  const prototype = Object.getPrototypeOf(object)
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(object)) {
    throw new CanonicalDigestContractError({ context, reason: "non-plain object" })
  }
  active.add(object)
  let capability = false
  try {
    if (Array.isArray(object)) {
      const ownKeys = Reflect.ownKeys(object)
      for (const key of ownKeys) {
        if (key === "length") continue
        if (typeof key !== "string" || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= object.length) {
          throw new CanonicalDigestContractError({ context, reason: "non-canonical array property" })
        }
        const descriptor = Object.getOwnPropertyDescriptor(object, key)
        if (!descriptor?.enumerable || !("value" in descriptor)) {
          throw new CanonicalDigestContractError({ context: `${context}[${key}]`, reason: "non-canonical property" })
        }
      }
      for (let index = 0; index < object.length; index++) {
        if (!Object.hasOwn(object, index)) {
          throw new CanonicalDigestContractError({ context: `${context}[${index}]`, reason: "sparse array hole" })
        }
        capability = classifyConfigValue(object[index], [...path, String(index)], active) || capability
      }
      return capability
    }
    for (const key of Reflect.ownKeys(object)) {
      if (typeof key !== "string") {
        throw new CanonicalDigestContractError({ context, reason: "symbol object key" })
      }
      const descriptor = Object.getOwnPropertyDescriptor(object, key)
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        throw new CanonicalDigestContractError({ context: `${context}.${key}`, reason: "non-canonical property" })
      }
      capability = classifyConfigValue(descriptor.value, [...path, key], active) || capability
    }
    return capability
  } finally {
    active.delete(object)
  }
}

export function nativeAgentConfigSource(config: Config.Info): {
  snapshot: Config.Info
  source?: CanonicalDigestSource
} {
  const snapshot = Config.Info.parse(config)
  if (classifyConfigValue(snapshot, [], new Set())) return { snapshot }
  return {
    snapshot,
    source: canonicalDigestSource(CONFIG_DIGEST_DOMAIN, snapshot),
  }
}

export class NativeAgentRegistryCache<State> {
  readonly #label: string
  readonly #build: (config: Config.Info) => Promise<State>
  readonly #explicitStates = new CanonicalCache<Promise<State>>()
  readonly #defaultState: ReturnType<
    typeof createInstanceState<{
      current?: Readonly<{ source: CanonicalDigestSource; state: Promise<State> }>
    }>
  >

  constructor(input: { label: string; build: (config: Config.Info) => Promise<State> }) {
    this.#label = input.label
    this.#build = input.build
    this.#defaultState = createInstanceState(() => ({}), undefined, input.label)
  }

  get(config?: Config.Info): Promise<State> {
    if (!config) {
      const holder = this.#defaultState()
      return Config.get().then((current) => {
        const { snapshot, source } = nativeAgentConfigSource(current)
        if (!source) return this.#build(snapshot)
        const existing = holder.current
        if (existing?.source.sha256 === source.sha256 && existing.source.bytes === source.bytes) return existing.state
        const state = this.#build(snapshot)
        const entry = { source, state }
        holder.current = entry
        void state.catch(() => {
          if (holder.current === entry) delete holder.current
        })
        return state
      })
    }
    const { snapshot, source } = nativeAgentConfigSource(config)
    if (!source) return this.#build(snapshot)
    const existing = this.#explicitStates.get(source)
    if (existing) return existing
    const next = this.#build(snapshot)
    this.#explicitStates.set(source, next)
    void next.catch(() => {
      if (this.#explicitStates.get(source) !== next) return
      this.#explicitStates.delete(source, next)
    })
    return next
  }

  async reset(): Promise<NativeAgentRegistryCacheReceipt> {
    const explicitEntriesDetached = this.#explicitStates.clear()
    const defaultProjectStatesDetached = this.#defaultState
      .inspectAll()
      .some((entry) => entry.key === currentProjectDirectory())
      ? 1
      : 0
    await this.#defaultState.reset()
    return {
      registry: this.#label,
      explicit_entries_detached: explicitEntriesDetached,
      default_project_states_detached: defaultProjectStatesDetached,
    }
  }

  async resetAll(): Promise<NativeAgentRegistryCacheReceipt> {
    const explicitEntriesDetached = this.#explicitStates.clear()
    const defaultProjectStatesDetached = this.#defaultState.inspectAll().length
    await this.#defaultState.resetAll()
    return {
      registry: this.#label,
      explicit_entries_detached: explicitEntriesDetached,
      default_project_states_detached: defaultProjectStatesDetached,
    }
  }
}
