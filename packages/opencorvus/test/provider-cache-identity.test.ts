import { describe, expect, test } from "bun:test"
import { mkdir, readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"
import { Database as BunDatabase } from "bun:sqlite"
import {
  createManagedTemporaryDirectory,
  removeManagedDirectoryTree,
} from "@opencorvus-ai/util/runtime-directories"
import { Provider } from "@/provider/provider"
import { CanonicalCache } from "@/util/canonical-cache"
import { CanonicalDigestContractError, canonicalDigestSource, sha256Text } from "@/util/canonical-digest"
import { Global } from "@/global"
import { Config } from "@/config/config"
import { BUNDLED_PROVIDERS } from "@/provider/bundled"
import { Instance } from "@/project/instance"
import { memoryProject } from "./fixture/memory"
import { ExecutionCapacityTestHooks } from "@/runtime/execution-capacity"

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
    const leftConfig = canonicalDigestSource(
      "opencorvus.provider.config-state.v1",
      Config.Info.parse({
        provider: {
          fixture: {
            name: "Fixture",
            options: { headers: { z: "last", a: "first" }, baseURL: "https://left.invalid/v1" },
          },
        },
      }),
    )
    const equivalentConfig = canonicalDigestSource(
      "opencorvus.provider.config-state.v1",
      Config.Info.parse({
        provider: {
          fixture: {
            options: { baseURL: "https://left.invalid/v1", headers: { a: "first", z: "last" } },
            name: "Fixture",
          },
        },
      }),
    )
    const changedConfig = canonicalDigestSource(
      "opencorvus.provider.config-state.v1",
      Config.Info.parse({
        provider: { fixture: { name: "Fixture", options: { baseURL: "https://right.invalid/v1" } } },
      }),
    )
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

  test("default Provider generations are Project-owned and follow current Config lifecycle", async () => {
    await using firstProject = await memoryProject()
    await using secondProject = await memoryProject()
    const providerConfig = (api: string) => ({
      enabled_providers: ["kilo"],
      provider: {
        kilo: {
          name: "Project-owned Provider fixture",
          npm: "@ai-sdk/openai-compatible",
          api,
          options: { apiKey: "fixture" },
          models: { fixture: { headers: { "x-fixture": "project-owned" } } },
        },
      },
    })

    for (const project of [firstProject, secondProject]) {
      await Instance.provide({
        directory: project.path,
        fn: () => Config.updateProjectPatch(providerConfig("https://initial.invalid/v1")),
      })
    }

    const readProject = (directory: string) =>
      Instance.provide({
        directory,
        fn: async () => {
          const config = await Config.get()
          const [defaultFirst, defaultSecond, explicitFirst, explicitSecond] = await Promise.all([
            Provider.catalog(),
            Provider.catalog(),
            Provider.catalog({ config }),
            Provider.catalog({ config }),
          ])
          return { defaultFirst, defaultSecond, explicitFirst, explicitSecond }
        },
      })

    const firstInitial = await readProject(firstProject.path)
    const secondInitial = await readProject(secondProject.path)
    const firstChanged = await Instance.provide({
      directory: firstProject.path,
      fn: async () => {
        await Config.updateProjectPatch({ provider: { kilo: { api: "https://changed.invalid/v1" } } })
        const config = await Config.get()
        return {
          defaultCatalog: await Provider.catalog(),
          explicitCatalog: await Provider.catalog({ config }),
        }
      },
    })

    await Instance.provide({ directory: firstProject.path, fn: () => Provider.reset() })
    const firstAfterReset = await readProject(firstProject.path)
    const secondAfterReset = await readProject(secondProject.path)
    await Instance.provide({ directory: firstProject.path, fn: () => Instance.dispose() })
    const firstAfterDispose = await Instance.provide({
      directory: firstProject.path,
      fn: () => Provider.catalog(),
    })

    expect({
      sameProjectDefaultReuse: firstInitial.defaultFirst.database === firstInitial.defaultSecond.database,
      sameProjectExplicitReuse: firstInitial.explicitFirst.database === firstInitial.explicitSecond.database,
      defaultProjectIsolation: firstInitial.defaultFirst.database === secondInitial.defaultFirst.database,
      explicitProjectIsolation: firstInitial.explicitFirst.database === secondInitial.explicitFirst.database,
      changedDefaultGeneration: firstInitial.defaultFirst.database === firstChanged.defaultCatalog.database,
      changedExplicitGeneration: firstInitial.explicitFirst.database === firstChanged.explicitCatalog.database,
      changedAPI: firstChanged.defaultCatalog.database.kilo?.models.fixture?.api.url,
      resetCurrentDefault: firstChanged.defaultCatalog.database === firstAfterReset.defaultFirst.database,
      resetCurrentExplicit: firstChanged.explicitCatalog.database === firstAfterReset.explicitFirst.database,
      preservedPeerDefault: secondInitial.defaultFirst.database === secondAfterReset.defaultFirst.database,
      preservedPeerExplicit: secondInitial.explicitFirst.database === secondAfterReset.explicitFirst.database,
      disposedDefaultHolder: firstAfterReset.defaultFirst.database === firstAfterDispose.database,
    }).toEqual({
      sameProjectDefaultReuse: true,
      sameProjectExplicitReuse: true,
      defaultProjectIsolation: false,
      explicitProjectIsolation: false,
      changedDefaultGeneration: false,
      changedExplicitGeneration: false,
      changedAPI: "https://changed.invalid/v1",
      resetCurrentDefault: false,
      resetCurrentExplicit: false,
      preservedPeerDefault: true,
      preservedPeerExplicit: true,
      disposedDefaultHolder: false,
    })
  }, 30_000)

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

  test("releases one Provider capacity slot on response EOF, cancel, abort and transport error", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const originalFactory = BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
      let providerFetch: ((input: string, init?: RequestInit) => Promise<Response>) | undefined
      let starts = 0
      let active = 0
      let maximumActive = 0
      let cancellations = 0
      let closeFirst!: () => void
      let completeAbortedCleanup!: () => void
      const customFetch = async (input: string) => {
        starts += 1
        const start = starts
        active += 1
        maximumActive = Math.max(maximumActive, active)
        if (input.endsWith("/error")) {
          active -= 1
          throw new Error("capacity fixture transport error")
        }
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new TextEncoder().encode(`response-${start}`))
              if (start === 1) {
                closeFirst = () => {
                  active -= 1
                  controller.close()
                }
              } else {
                if (start !== 3 && start !== 7) {
                  active -= 1
                  controller.close()
                }
              }
            },
            cancel() {
              cancellations += 1
              if (start === 7) {
                return new Promise<void>((resolve) => {
                  completeAbortedCleanup = () => {
                    active -= 1
                    resolve()
                  }
                })
              }
              active -= 1
            },
          }),
        )
      }
      BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = (options: Record<string, unknown>) => {
        providerFetch = options.fetch as typeof providerFetch
        return { languageModel: (modelId: string) => ({ modelId }) as never }
      }
      using _capacity = ExecutionCapacityTestHooks.install({ provider: 1 })
      const config = Config.Info.parse({
        enabled_providers: ["capacity-fixture"],
        provider: {
          "capacity-fixture": {
            name: "Provider capacity fixture",
            npm: "@ai-sdk/openai-compatible",
            api: "http://127.0.0.1:9/v1",
            options: { apiKey: "capacity-fixture-key", fetch: customFetch, timeout: false },
            models: { model: {} },
          },
        },
      })
      try {
        await Provider.getLanguage(await Provider.getModel("capacity-fixture", "model", { config }), { config })
        if (!providerFetch) throw new Error("Provider fixture did not receive the production fetch boundary")
        const first = await providerFetch("http://capacity.invalid/first")
        const secondPending = providerFetch("http://capacity.invalid/second")
        await Bun.sleep(50)
        expect({ active, starts }).toEqual({ active: 1, starts: 1 })
        closeFirst()
        expect(await first.text()).toBe("response-1")
        const second = await secondPending
        expect(await second.text()).toBe("response-2")
        const third = await providerFetch("http://capacity.invalid/third")
        const fourthPending = providerFetch("http://capacity.invalid/fourth")
        await Bun.sleep(50)
        expect({ active, starts }).toEqual({ active: 1, starts: 3 })
        await third.body!.cancel("consumer settled")
        const fourth = await fourthPending
        expect(await fourth.text()).toBe("response-4")

        const transportError = providerFetch("http://capacity.invalid/error")
        const afterError = providerFetch("http://capacity.invalid/after-error")
        expect(await transportError.catch((error: Error) => error.message)).toBe("capacity fixture transport error")
        expect(await (await afterError).text()).toBe("response-6")

        const controller = new AbortController()
        const aborted = await providerFetch("http://capacity.invalid/aborted-body", { signal: controller.signal })
        const abortedRead = aborted.text()
        const afterAbort = providerFetch("http://capacity.invalid/after-abort")
        await Bun.sleep(50)
        expect({ active, starts }).toEqual({ active: 1, starts: 7 })
        controller.abort(new DOMException("capacity fixture caller abort", "AbortError"))
        expect((await abortedRead.catch((error: Error) => error)).name).toBe("AbortError")
        await Bun.sleep(50)
        expect({ active, starts }).toEqual({ active: 1, starts: 7 })
        completeAbortedCleanup()
        expect(await (await afterAbort).text()).toBe("response-8")
        expect({ cancellations, maximumActive, starts }).toEqual({ cancellations: 2, maximumActive: 1, starts: 8 })
      } finally {
        if (originalFactory) BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"] = originalFactory
        else delete BUNDLED_PROVIDERS["@ai-sdk/openai-compatible"]
        await Provider.resetAll()
      }
    } })
  })

  test("shares the final Provider stream capacity lease across two backend processes", async () => {
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Cross-process Provider capacity test requires the repository test runtime")
    await using project = await memoryProject()
    const runtime = await createManagedTemporaryDirectory(processRoot, "provider-capacity-runtime-")
    const barrier = await createManagedTemporaryDirectory(processRoot, "provider-capacity-barrier-")
    const requests: Array<{
      label: string
      release: () => void
      responded: Promise<void>
    }> = []
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch(request) {
        const label = new URL(request.url).pathname.split("/").at(-1) ?? "unknown"
        const released = Promise.withResolvers<void>()
        const responded = Promise.withResolvers<void>()
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(`body-${label}`))
            void released.promise.then(() => {
              controller.close()
              responded.resolve()
            })
          },
        })
        requests.push({ label, release: released.resolve, responded: responded.promise })
        return new Response(body)
      },
    })
    const apiURL = `http://127.0.0.1:${server.port}`
    const worker = path.join(import.meta.dir, "fixture", "provider-capacity-process-worker.ts")
    const environment = { ...process.env, OPENCORVUS_HOME: runtime }
    const children: ReturnType<typeof Bun.spawn>[] = []
    const spawn = (mode: "seed" | "run", label: string) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.join(import.meta.dir, "empty-bunfig.toml")}`,
          worker,
          mode,
          project.path,
          barrier,
          apiURL,
          label,
        ],
        { cwd: path.join(import.meta.dir, ".."), env: environment, stdout: "pipe", stderr: "pipe" },
      )
      children.push(child)
      return child
    }
    const read = async (child: ReturnType<typeof spawn>) => {
      const [exitCode, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect(exitCode, stderr).toBe(0)
      return JSON.parse(stdout.trim()) as {
        mode: string
        label?: string
        status?: number
        body?: string
        providerID?: string
        modelID?: string
        configuredProviders?: string[]
      }
    }
    const waitFor = async (predicate: () => boolean | Promise<boolean>, message: string) => {
      const deadline = Date.now() + 30_000
      while (!(await predicate())) {
        if (Date.now() >= deadline) throw new Error(message)
        await Bun.sleep(10)
      }
    }

    try {
      expect(await read(spawn("seed", "seed"))).toEqual({
        mode: "seed",
        providerID: "provider-capacity-process",
        modelID: "stream-model",
        configuredProviders: ["provider-capacity-process"],
      })
      const first = spawn("run", "first")
      const second = spawn("run", "second")
      const readyDeadline = Date.now() + 30_000
      while (true) {
        const ready =
          Boolean(await stat(path.join(barrier, "first.ready")).catch(() => undefined)) &&
          Boolean(await stat(path.join(barrier, "second.ready")).catch(() => undefined))
        if (ready) break
        const exited = [first, second].find((child) => child.exitCode !== null)
        if (exited) {
          const stderr = await new Response(exited.stderr).text()
          throw new Error(`Provider capacity worker exited before readiness: ${exited.exitCode}\n${stderr}`)
        }
        if (Date.now() >= readyDeadline) throw new Error("Provider capacity workers did not initialize")
        await Bun.sleep(10)
      }
      await writeFile(path.join(barrier, "first.start"), "start")
      await waitFor(() => requests.length === 1, "First backend did not reach the Provider transport")
      await writeFile(path.join(barrier, "second.start"), "start")
      await Bun.sleep(250)
      expect(requests.map((request) => request.label)).toEqual(["first"])

      requests[0]!.release()
      await requests[0]!.responded
      await waitFor(() => requests.length === 2, "Second backend did not acquire the released Provider slot")
      requests[1]!.release()
      await requests[1]!.responded
      const [firstResult, secondResult] = await Promise.all([read(first), read(second)])

      const sqlite = new BunDatabase(path.join(runtime, "data", "opencorvus.db"), { readonly: true })
      const leases = sqlite
        .query<
          { slot: number; lease_id: string; owner_id: string; time_acquired: number; expires_at: number },
          []
        >(
          "SELECT slot, lease_id, owner_id, time_acquired, expires_at FROM runtime_execution_capacity_lease ORDER BY slot",
        )
        .all()
      sqlite.close()
      expect({ firstResult, secondResult, requestOrder: requests.map((request) => request.label), leases }).toEqual({
        firstResult: { mode: "run", label: "first", status: 200, body: "body-first" },
        secondResult: { mode: "run", label: "second", status: 200, body: "body-second" },
        requestOrder: ["first", "second"],
        leases: [
          {
            slot: 0,
            lease_id: expect.any(String),
            owner_id: expect.stringMatching(/^runtime:/),
            time_acquired: expect.any(Number),
            expires_at: expect.any(Number),
          },
        ],
      })
      expect(leases[0]!.expires_at).toBeLessThanOrEqual(Date.now())
    } finally {
      for (const request of requests) request.release()
      server.stop(true)
      for (const child of children) {
        child.kill()
        await child.exited
      }
      await removeManagedDirectoryTree(barrier)
      await removeManagedDirectoryTree(runtime)
    }
  }, 90_000)

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
