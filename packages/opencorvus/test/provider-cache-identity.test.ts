import { describe, expect, test } from "bun:test"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { Provider } from "@/provider/provider"
import { CanonicalCache } from "@/provider/canonical-cache"
import {
  CanonicalDigestContractError,
  canonicalDigestSource,
  sha256Text,
} from "@/util/canonical-digest"
import { Global } from "@/global"
import { Config } from "@/config/config"
import { BUNDLED_PROVIDERS } from "@/provider/bundled"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"

describe.serial("Provider cache identity", () => {
  test("canonical sources are runtime-independent and exact bytes remain the cache authority", () => {
    const left = canonicalDigestSource("fixture.v1", { z: [1, true], a: "value" })
    const right = canonicalDigestSource("fixture.v1", { a: "value", z: [1, true] })
    expect(left).toEqual({
      bytes: '{"domain":"fixture.v1","payload":{"a":"value","z":[1,true]}}',
      sha256: "857370c416df9ac82e4899f82f71ceb392e5de1b1dcb96971a5c2805b8dad0a4",
    })
    expect(right).toEqual(left)

    const cache = new CanonicalCache<string>()
    cache.set({ sha256: "a".repeat(64), bytes: "left" }, "left value")
    cache.set({ sha256: "a".repeat(64), bytes: "right" }, "right value")
    expect({
      left: cache.get({ sha256: "a".repeat(64), bytes: "left" }),
      right: cache.get({ sha256: "a".repeat(64), bytes: "right" }),
    }).toEqual({ left: "left value", right: "right value" })

    const cycle: Record<string, unknown> = {}
    cycle.self = cycle
    for (const value of [undefined, () => undefined, 1n, Number.NaN, cycle]) {
      expect(() => canonicalDigestSource("fixture.invalid.v1", { value })).toThrow(CanonicalDigestContractError)
    }
  })

  test("validated Provider config and declarative SDK options use canonical exact identities", () => {
    const leftConfig = canonicalDigestSource("opencorvus.provider.config-state.v1", Config.Info.parse({
      provider: {
        fixture: {
          name: "Fixture",
          options: { headers: { z: "last", a: "first" }, baseURL: "https://left.invalid/v1" },
        },
      },
    }))
    const equivalentConfig = canonicalDigestSource("opencorvus.provider.config-state.v1", Config.Info.parse({
      provider: {
        fixture: {
          options: { baseURL: "https://left.invalid/v1", headers: { a: "first", z: "last" } },
          name: "Fixture",
        },
      },
    }))
    const changedConfig = canonicalDigestSource("opencorvus.provider.config-state.v1", Config.Info.parse({
      provider: { fixture: { name: "Fixture", options: { baseURL: "https://right.invalid/v1" } } },
    }))
    expect({ equivalentConfig, changed: changedConfig.sha256 === leftConfig.sha256 }).toEqual({
      equivalentConfig: leftConfig,
      changed: false,
    })

    const oldCollisionLeft = canonicalDigestSource("opencorvus.provider.sdk-instance.v1", {
      providerID: "cache-fixture",
      npm: "@ai-sdk/openai-compatible",
      options: {
        apiKey: "fixture",
        includeUsage: true,
        baseURL: "https://example.invalid/v1",
        headers: { "x-collision": "collision-56348" },
      },
    })
    const oldCollisionRight = canonicalDigestSource("opencorvus.provider.sdk-instance.v1", {
      providerID: "cache-fixture",
      npm: "@ai-sdk/openai-compatible",
      options: {
        apiKey: "fixture",
        includeUsage: true,
        baseURL: "https://example.invalid/v1",
        headers: { "x-collision": "collision-106155" },
      },
    })
    expect({
      oldHashLeft: Bun.hash.xxHash32(
        JSON.stringify({
          providerID: "cache-fixture",
          npm: "@ai-sdk/openai-compatible",
          options: {
            apiKey: "fixture",
            includeUsage: true,
            baseURL: "https://example.invalid/v1",
            headers: { "x-collision": "collision-56348" },
          },
        }),
      ),
      oldHashRight: Bun.hash.xxHash32(
        JSON.stringify({
          providerID: "cache-fixture",
          npm: "@ai-sdk/openai-compatible",
          options: {
            apiKey: "fixture",
            includeUsage: true,
            baseURL: "https://example.invalid/v1",
            headers: { "x-collision": "collision-106155" },
          },
        }),
      ),
      canonicalDifferent: oldCollisionLeft.sha256 !== oldCollisionRight.sha256,
    }).toEqual({
      oldHashLeft: 1073777153,
      oldHashRight: 1073777153,
      canonicalDifferent: true,
    })
  })

  test("production Provider state and SDK caches reuse only exact canonical inputs", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const base = {
          enabled_providers: ["kilo"],
          provider: {
            kilo: {
              name: "Canonical cache fixture",
              npm: "@ai-sdk/openai-compatible",
              api: "https://example.invalid/v1",
              options: { apiKey: "fixture", includeUsage: true },
              models: {
                left: { headers: { "x-collision": "collision-56348" } },
                right: { headers: { "x-collision": "collision-106155" } },
                equivalent: { headers: { "x-collision": "collision-56348" } },
              },
            },
          },
        }
        const config = Config.Info.parse(base)
        const equivalent = Config.Info.parse({
          provider: {
            kilo: {
              models: {
                equivalent: { headers: { "x-collision": "collision-56348" } },
                right: { headers: { "x-collision": "collision-106155" } },
                left: { headers: { "x-collision": "collision-56348" } },
              },
              options: { includeUsage: true, apiKey: "fixture" },
              api: "https://example.invalid/v1",
              npm: "@ai-sdk/openai-compatible",
              name: "Canonical cache fixture",
            },
          },
          enabled_providers: ["kilo"],
        })
        const changed = Config.Info.parse({
          ...base,
          provider: {
            ...base.provider,
            kilo: { ...base.provider.kilo, api: "https://changed.invalid/v1" },
          },
        })

        const [firstCatalog, equivalentCatalog, changedCatalog] = await Promise.all([
          Provider.catalog({ config }),
          Provider.catalog({ config: equivalent }),
          Provider.catalog({ config: changed }),
        ])
        expect({
          equivalentDatabase: firstCatalog.database === equivalentCatalog.database,
          changedDatabase: firstCatalog.database === changedCatalog.database,
          firstAPI: firstCatalog.database.kilo?.models.left?.api.url,
          changedAPI: changedCatalog.database.kilo?.models.left?.api.url,
        }).toEqual({
          equivalentDatabase: true,
          changedDatabase: false,
          firstAPI: "https://example.invalid/v1",
          changedAPI: "https://changed.invalid/v1",
        })

        const originalFactory = BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
        const providerInstances: symbol[] = []
        BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = () => {
          const providerInstance = Symbol("provider-instance")
          providerInstances.push(providerInstance)
          return {
            languageModel: (modelId: string) => ({ modelId, providerInstance }) as never,
          }
        }
        try {
          const [left, right, equivalentLanguage] = await Promise.all([
            Provider.getLanguage(await Provider.getModel("kilo", "left", { config }), { config }),
            Provider.getLanguage(await Provider.getModel("kilo", "right", { config }), { config }),
            Provider.getLanguage(await Provider.getModel("kilo", "equivalent", { config }), { config }),
          ])
          expect({
            providerInstances: providerInstances.length,
            left: (left as unknown as { providerInstance: symbol }).providerInstance,
            right: (right as unknown as { providerInstance: symbol }).providerInstance,
            equivalent: (equivalentLanguage as unknown as { providerInstance: symbol }).providerInstance,
          }).toEqual({
            providerInstances: 2,
            left: providerInstances[0],
            right: providerInstances[1],
            equivalent: providerInstances[0],
          })
        } finally {
          if (originalFactory) BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = originalFactory
          else delete BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
          await Provider.resetAll()
        }
      },
    })
  })

  test("production runtime capabilities execute without entering the declarative SDK cache", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const originalFactory = BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
        let factoryCalls = 0
        BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = () => {
          const factoryCall = ++factoryCalls
          return { languageModel: (modelId: string) => ({ modelId, factoryCall }) as never }
        }
        const customFetch = () => Promise.resolve(new Response("fixture"))
        const config = Config.Info.parse({
          enabled_providers: ["kilo"],
          provider: {
            kilo: {
              name: "Runtime capability fixture",
              npm: "@ai-sdk/openai-compatible",
              api: "https://example.invalid/v1",
              options: { apiKey: "fixture", fetch: customFetch },
              models: { first: {}, second: {} },
            },
          },
        })
        try {
          const [first, second] = await Promise.all([
            Provider.getLanguage(await Provider.getModel("kilo", "first", { config }), { config }),
            Provider.getLanguage(await Provider.getModel("kilo", "second", { config }), { config }),
          ])
          expect({
            factoryCalls,
            first: (first as unknown as { factoryCall: number }).factoryCall,
            second: (second as unknown as { factoryCall: number }).factoryCall,
          }).toEqual({ factoryCalls: 2, first: 1, second: 2 })
        } finally {
          if (originalFactory) BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = originalFactory
          else delete BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
          await Provider.resetAll()
        }
      },
    })
  })

  test("production Bedrock credential capability initializes without cache serialization", async () => {
    await using project = await memoryProject()
    const originalProfile = process.env.AWS_PROFILE
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const originalFactory = BUNDLED_PROVIDERS["@ai-sdk/amazon-bedrock"]
        let factoryCalls = 0
        BUNDLED_PROVIDERS["@ai-sdk/amazon-bedrock"] = () => {
          const factoryCall = ++factoryCalls
          return { languageModel: (modelId: string) => ({ modelId, factoryCall }) as never }
        }
        process.env.AWS_PROFILE = "canonical-cache-fixture"
        const config = Config.Info.parse({
          enabled_providers: ["amazon-bedrock"],
          provider: { "amazon-bedrock": { options: { profile: "canonical-cache-fixture", region: "us-east-1" } } },
        })
        try {
          const catalog = await Provider.catalog({ config })
          const models = Object.values(catalog.providers["amazon-bedrock"]?.models ?? {}).slice(0, 2)
          if (models.length !== 2) throw new Error("Bedrock fixture requires two production catalog models")
          const [first, second] = await Promise.all(models.map((model) => Provider.getLanguage(model, { config })))
          expect({
            factoryCalls,
            first: (first as unknown as { factoryCall: number }).factoryCall,
            second: (second as unknown as { factoryCall: number }).factoryCall,
          }).toEqual({ factoryCalls: 2, first: 1, second: 2 })
        } finally {
          if (originalFactory) BUNDLED_PROVIDERS["@ai-sdk/amazon-bedrock"] = originalFactory
          else delete BUNDLED_PROVIDERS["@ai-sdk/amazon-bedrock"]
          if (originalProfile === undefined) delete process.env.AWS_PROFILE
          else process.env.AWS_PROFILE = originalProfile
          await Provider.resetAll()
        }
      },
    })
  })

  test("DashScope credential lifetime publishes only versioned SHA-256 identity", async () => {
    const originalKey = process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY
    const originalTTL = process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_TTL_HOURS
    const stateFile = path.join(Global.Path.state, "dashscope-embedded.json")
    const { dashscopeKey } = await import("@/provider/dashscope")
    try {
      await mkdir(path.dirname(stateFile), { recursive: true })
      await writeFile(stateFile, JSON.stringify({ hash: 123, first: 1 }))
      process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY = "first-secret"
      process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_TTL_HOURS = "24"
      expect(await dashscopeKey({})).toBe("first-secret")
      const first = JSON.parse(await readFile(stateFile, "utf8"))
      expect(first).toEqual({
        schema_version: 2,
        credential_sha256: sha256Text("opencorvus.provider.dashscope-credential.v2", "first-secret"),
        first: expect.any(Number),
      })
      expect(JSON.stringify(first)).not.toContain("first-secret")

      expect(await dashscopeKey({})).toBe("first-secret")
      expect(JSON.parse(await readFile(stateFile, "utf8"))).toEqual(first)

      process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY = "second-secret"
      expect(await dashscopeKey({})).toBe("second-secret")
      const second = JSON.parse(await readFile(stateFile, "utf8"))
      expect({ schema: second.schema_version, changed: second.credential_sha256 !== first.credential_sha256 }).toEqual({
        schema: 2,
        changed: true,
      })
      expect(second.first).toBeGreaterThanOrEqual(first.first)
      expect(JSON.stringify(second)).not.toContain("second-secret")
    } finally {
      if (originalKey === undefined) delete process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY
      else process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_KEY = originalKey
      if (originalTTL === undefined) delete process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_TTL_HOURS
      else process.env.OPENCORVUS_EMBEDDED_DASHSCOPE_TTL_HOURS = originalTTL
    }
  })
})
