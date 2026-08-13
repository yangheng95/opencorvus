import { describe, expect, test } from "bun:test"
import { HostAgentRegistry } from "@/agent/host-agent-registry"
import { HelperAgentRegistry } from "@/agent/helper-agent-registry"
import { NativeAgentRegistryLifecycle } from "@/agent/native-agent-registry-lifecycle"
import { NativeAgentRegistryCache, nativeAgentConfigSource } from "@/agent/native-agent-registry-cache"
import { PrimaryAssistantRegistry } from "@/agent/primary-assistant-registry"
import { Config } from "@/config/config"
import { CanonicalDigestContractError } from "@/util/canonical-digest"
import { CanonicalCache } from "@/util/canonical-cache"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

function equivalentConfigs() {
  const left = Config.Info.parse({
    agent: {
      coding: { description: "canonical coding", options: { z: "last", a: "first" } },
      memory: { description: "canonical memory" },
      orchestrator: { description: "canonical host" },
    },
  })
  const right = Config.Info.parse({
    agent: {
      orchestrator: { description: "canonical host" },
      memory: { description: "canonical memory" },
      coding: { options: { a: "first", z: "last" }, description: "canonical coding" },
    },
  })
  return { left, right }
}

describe.serial("Native Agent registry cache authority", () => {
  test("all three registries reuse exact canonical snapshots and expose one reset receipt", async () => {
    const { left, right } = equivalentConfigs()
    expect(nativeAgentConfigSource(left).source).toEqual({
      bytes: nativeAgentConfigSource(right).source?.bytes,
      sha256: nativeAgentConfigSource(right).source?.sha256,
    })
    expect(nativeAgentConfigSource(left).source?.sha256).toMatch(/^[0-9a-f]{64}$/)

    const [primaryLeft, primaryRight, helperLeft, helperRight, hostLeft, hostRight] = await Promise.all([
      PrimaryAssistantRegistry.get("coding", { config: left }),
      PrimaryAssistantRegistry.get("coding", { config: right }),
      HelperAgentRegistry.get("memory", { config: left }),
      HelperAgentRegistry.get("memory", { config: right }),
      HostAgentRegistry.get("orchestrator", { config: left }),
      HostAgentRegistry.get("orchestrator", { config: right }),
    ])
    expect({ primary: primaryLeft === primaryRight, helper: helperLeft === helperRight, host: hostLeft === hostRight })
      .toEqual({ primary: true, helper: true, host: true })

    const changed = Config.Info.parse({ agent: { coding: { description: "changed coding" } } })
    expect((await PrimaryAssistantRegistry.get("coding", { config: changed })).description).toBe("changed coding")

    const receipt = await NativeAgentRegistryLifecycle.resetAll()
    expect(receipt).toEqual({
      explicit_entries_detached: 4,
      default_project_states_detached: 0,
      registries: [
        { registry: "primary-assistant-registry", explicit_entries_detached: 2, default_project_states_detached: 0 },
        { registry: "helper-agent-registry", explicit_entries_detached: 1, default_project_states_detached: 0 },
        { registry: "host-agent-registry", explicit_entries_detached: 1, default_project_states_detached: 0 },
      ],
    })
    expect(await PrimaryAssistantRegistry.get("coding", { config: left })).not.toBe(primaryLeft)
  })

  test("default states remain project scoped and current reset detaches only the current project", async () => {
    await using first = await memoryProject()
    await using second = await memoryProject()
    const firstStates = await Instance.provide({
      directory: first.path,
      fn: async () => ({
        primary: await PrimaryAssistantRegistry.get("coding"),
        helper: await HelperAgentRegistry.get("memory"),
        host: await HostAgentRegistry.get("orchestrator"),
      }),
    })
    const secondStates = await Instance.provide({
      directory: second.path,
      fn: async () => ({
        primary: await PrimaryAssistantRegistry.get("coding"),
        helper: await HelperAgentRegistry.get("memory"),
        host: await HostAgentRegistry.get("orchestrator"),
      }),
    })
    expect(firstStates.primary).not.toBe(secondStates.primary)

    const currentReceipt = await Instance.provide({
      directory: first.path,
      fn: () => NativeAgentRegistryLifecycle.reset(),
    })
    expect(currentReceipt.default_project_states_detached).toBe(3)
    const firstNext = await Instance.provide({
      directory: first.path,
      fn: () => PrimaryAssistantRegistry.get("coding"),
    })
    const secondSame = await Instance.provide({
      directory: second.path,
      fn: () => PrimaryAssistantRegistry.get("coding"),
    })
    expect({ firstReplaced: firstNext === firstStates.primary, secondPreserved: secondSame === secondStates.primary })
      .toEqual({ firstReplaced: false, secondPreserved: true })

    const allReceipt = await NativeAgentRegistryLifecycle.resetAll()
    expect(allReceipt.default_project_states_detached).toBe(4)
  })

  test("runtime functions execute without cache identity while invalid siblings remain fail-closed", async () => {
    const runtimeFunction = () => "runtime"
    const config = Config.Info.parse({ agent: { coding: { options: { runtimeFunction } } } })
    const first = await PrimaryAssistantRegistry.get("coding", { config })
    const second = await PrimaryAssistantRegistry.get("coding", { config })
    expect({ reused: first === second, runtimeFunction: first.options.runtimeFunction }).toEqual({
      reused: false,
      runtimeFunction,
    })

    const invalidValues = [undefined, Symbol("invalid"), 1n, Number.NaN, new Date(0), new Map()] as const
    for (const invalid of invalidValues) {
      const candidate = Config.Info.parse({
        agent: { coding: { options: { runtimeFunction, invalid } } },
      })
      expect(() => nativeAgentConfigSource(candidate)).toThrow(CanonicalDigestContractError)
    }

    const reversedInvalid = Config.Info.parse({
      agent: { coding: { options: { invalid: undefined, runtimeFunction } } },
    })
    expect(() => PrimaryAssistantRegistry.get("coding", { config: reversedInvalid })).toThrow(
      CanonicalDigestContractError,
    )

    const arrayWithCapability = [] as unknown[] & { runtimeCapability?: () => string }
    Object.defineProperty(arrayWithCapability, "runtimeCapability", {
      value: () => "array-runtime",
      enumerable: true,
    })
    const arrayWithInvalid = [] as unknown[] & { invalidSibling?: undefined }
    Object.defineProperty(arrayWithInvalid, "invalidSibling", { value: undefined, enumerable: true })
    const hiddenObject = { visible: true }
    Object.defineProperty(hiddenObject, "hidden", { value: "hidden-state", enumerable: false })
    const symbolObject = { visible: true } as Record<PropertyKey, unknown>
    symbolObject[Symbol("hidden")] = "symbol-state"
    for (const value of [arrayWithCapability, arrayWithInvalid, hiddenObject, symbolObject]) {
      const candidate = Config.Info.parse({ agent: { coding: { options: { value } } } })
      expect(() => PrimaryAssistantRegistry.get("coding", { config: candidate })).toThrow(
        CanonicalDigestContractError,
      )
    }
  })

  test("reset detaches exact collision entries and late failures cannot delete a new generation", async () => {
    const collisions = new CanonicalCache<string>()
    collisions.set({ sha256: "a".repeat(64), bytes: "left" }, "left")
    collisions.set({ sha256: "a".repeat(64), bytes: "right" }, "right")
    expect({ left: collisions.get({ sha256: "a".repeat(64), bytes: "left" }), detached: collisions.clear() })
      .toEqual({ left: "left", detached: 2 })

    type State = { generation: number }
    const builds: Array<{ resolve: (value: State) => void; reject: (error: Error) => void }> = []
    let generation = 0
    const cache = new NativeAgentRegistryCache<State>({
      label: "generation-fixture",
      build: async () =>
        new Promise<State>((resolve, reject) => {
          builds.push({ resolve, reject })
        }),
    })
    const config = Config.Info.parse({ agent: { coding: { description: "generation" } } })
    const first = cache.get(config)
    const detached = await cache.resetAll()
    expect(detached).toEqual({
      registry: "generation-fixture",
      explicit_entries_detached: 1,
      default_project_states_detached: 0,
    })
    const second = cache.get(config)
    builds[0].reject(new Error("old generation failed"))
    builds[1].resolve({ generation: ++generation })
    await expect(first).rejects.toThrow("old generation failed")
    expect(await second).toEqual({ generation: 1 })
    expect(cache.get(config)).toBe(second)
  })
})
