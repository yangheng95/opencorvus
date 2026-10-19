import { afterEach, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { SkillManager } from "@/skill/manager"
import { markConversationCapabilityTransactionalInit } from "@/conversation/capability-transaction"
import { withTimeout } from "@/util/await-with-timeout"
import { hostGit } from "@/util/git"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"
import { tmpdir } from "./fixture/fixture"

afterEach(async () => {
  Config.TestHooks.beforeGlobalPersist = undefined
  await resetMemoryDatabase()
})

function outcome<T>(operation: Promise<T>) {
  return operation.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  )
}

test("a global writer and a Config-reading initializer return the committed generation", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: () => Config.get() })
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  Config.TestHooks.beforeGlobalPersist = async () => {
    entered.resolve()
    await release.promise
  }
  const writer = outcome(Config.updateGlobalPatch({ username: "initializer-current" }))
  await entered.promise
  let initialized: string | undefined
  let sourceRead: Promise<Config.Info> | undefined
  const preparing = outcome(
    Instance.provide({
      directory: project.path,
      init: async () => {
        sourceRead = Config.getGlobal()
        initialized = (await withTimeout(sourceRead, 2000, "initializer Config generation")).username
      },
      fn: () => initialized,
    }),
  )
  await Bun.sleep(50)
  release.resolve()
  const [saved, prepared] = await Promise.all([writer, preparing])
  if (sourceRead) await Promise.allSettled([sourceRead])
  expect(saved).toMatchObject({ value: { username: "initializer-current" } })
  expect(prepared).toEqual({ value: "initializer-current" })
}, 20000)

test("a Git-shape refresh and its catalog owner both serve the current Project", async () => {
  declareNativeTaskProcessDeployment()
  await using project = await tmpdir({ dispose: () => Instance.disposeAll() })
  const observations: boolean[] = []
  const init = markConversationCapabilityTransactionalInit(
    async () => undefined,
    async () => {
      observations.push(Instance.current()!.git)
    },
  )
  await Instance.provide({ directory: project.path, init, fn: () => undefined })
  const git = await hostGit(["init"], { cwd: project.path, timeoutProfile: "default" })
  expect(git.exitCode).toBe(0)
  const entered = Promise.withResolvers<void>()
  const inspect = Promise.withResolvers<void>()
  let identityRead: Promise<string> | undefined
  const owner = outcome(
    SkillManager.withCatalogMutationOwner(async () => {
      entered.resolve()
      await inspect.promise
      identityRead = Instance.provideProjectIdentity({ directory: project.path, fn: () => Instance.directory })
      return withTimeout(identityRead, 2000, "refresh catalog identity")
    }),
  )
  await entered.promise
  const refresh = outcome(Instance.provide({ directory: project.path, init, fn: () => Instance.current()!.git }))
  await Bun.sleep(50)
  inspect.resolve()
  const [read, refreshed] = await Promise.all([owner, refresh])
  if (identityRead) await Promise.allSettled([identityRead])
  expect(read).toEqual({ value: project.path })
  expect({ refreshed, observations }).toEqual({ refreshed: { value: true }, observations: [false, true] })
}, 20000)

for (const kind of ["refresh", "dispose"] as const) {
  for (const reader of ["identity", "active", "iteration", "descendant"] as const) {
    test(`a ${kind} drain settles serving work and the catalog owner's ${reader} read`, async () => {
      await using project = await memoryProject()
      const servingEntered = Promise.withResolvers<void>()
      const askCatalog = Promise.withResolvers<void>()
      const serving = Instance.provide({
        directory: project.path,
        fn: async () => {
          servingEntered.resolve()
          await askCatalog.promise
          return SkillManager.withCatalogMutationOwner(async () => "serving-current")
        },
      })
      await servingEntered.promise
      const ownerEntered = Promise.withResolvers<void>()
      const inspect = Promise.withResolvers<void>()
      let identityRead: Promise<unknown> | undefined
      const owner = outcome(
        SkillManager.withCatalogMutationOwner(async () => {
          if (reader === "descendant") {
            await SkillManager.withCatalogMutationOwner(async () => {
              identityRead = inspect.promise.then(() =>
                Instance.provideProjectIdentity({ directory: project.path, fn: () => "owner-current" }),
              )
            })
            ownerEntered.resolve()
            return withTimeout(identityRead!, 2000, "draining descendant catalog identity")
          }
          ownerEntered.resolve()
          await inspect.promise
          identityRead =
            reader === "identity"
              ? Instance.provideProjectIdentity({ directory: project.path, fn: () => "owner-current" })
              : reader === "active"
                ? Instance.tryProvideActive({ directory: project.path, fn: () => "owner-current" })
                : Instance.forEachActive({
                    fn: () => {
                      expect(Instance.directory).toBe(project.path)
                    },
                  }).then(() => "owner-current")
          return withTimeout(identityRead, 2000, "draining catalog identity")
        }),
      )
      await ownerEntered.promise
      const teardown =
        kind === "refresh"
          ? Instance.refresh(project.path).then(() => "refreshed-current")
          : Instance.provide({
              directory: project.path,
              fn: async () => {
                await Instance.dispose()
                return "disposed-current"
              },
            })
      await Bun.sleep(50)
      askCatalog.resolve()
      inspect.resolve()
      const [read, served, settled] = await Promise.all([owner, serving, teardown])
      if (identityRead) await Promise.allSettled([identityRead])
      expect({ read, served, settled }).toEqual({
        read: { value: "owner-current" },
        served: "serving-current",
        settled: kind === "refresh" ? "refreshed-current" : "disposed-current",
      })
    }, 20000)
  }
}

test("a catalog owner's identity read observes the state created after an entered teardown settles", async () => {
  await using project = await memoryProject()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const timeline: string[] = []
  let generation = 0
  const state = Instance.state(
    () => ++generation,
    async () => {
      timeline.push("cleanup-entered")
      entered.resolve()
      await release.promise
      timeline.push("cleanup-finished")
    },
    "catalog-teardown-order",
  )
  await Instance.provide({ directory: project.path, fn: () => state() })
  const disposing = Instance.provide({ directory: project.path, fn: () => Instance.dispose() })
  await entered.promise
  const reading = SkillManager.withCatalogMutationOwner(() =>
    Instance.provideProjectIdentity({
      directory: project.path,
      fn: () => {
        const current = state()
        timeline.push(`read-generation-${current}`)
        return current
      },
    }),
  )
  await Bun.sleep(50)
  release.resolve()
  const [current] = await Promise.all([reading, disposing])
  expect({ current, timeline }).toEqual({
    current: 2,
    timeline: ["cleanup-entered", "cleanup-finished", "read-generation-2"],
  })
}, 20000)

test("late catalog work reads the value committed by the next actual owner", async () => {
  const releaseLate = Promise.withResolvers<void>()
  let late!: Promise<string | undefined>
  await SkillManager.withCatalogMutationOwner(async () => {
    late = releaseLate.promise.then(() =>
      SkillManager.withCatalogMutationOwner(async () => (await Config.getGlobal()).username),
    )
  })
  await SkillManager.withCatalogMutationOwner(async () => {
    releaseLate.resolve()
    await Bun.sleep(50)
    await Config.updateGlobalPatch({ username: "late-owner-current" })
  })
  expect(await late).toBe("late-owner-current")
}, 20000)

test("an accepted child projection reads its owner's generation before the next catalog writer", async () => {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let child!: Promise<string | undefined>
  const parent = SkillManager.withCatalogMutationOwner(async () => {
    await Config.updateGlobalPatch({ username: "accepted-child-owner" })
    child = SkillManager.withCatalogMutationOwner(async () => {
      entered.resolve()
      await release.promise
      return (await Config.getGlobal()).username
    })
    await entered.promise
    return "parent-current"
  })
  await entered.promise
  const next = SkillManager.withCatalogMutationOwner(() => Config.updateGlobalPatch({ username: "next-child-owner" }))
  await Bun.sleep(50)
  release.resolve()
  const [parentValue, nextValue, childValue] = await Promise.all([parent, next, child])
  expect({ parent: parentValue, child: childValue, next: nextValue.username }).toEqual({
    parent: "parent-current",
    child: "accepted-child-owner",
    next: "next-child-owner",
  })
}, 20000)

test("a descendant callback reuses the catalog lease while its ancestor still owns it", async () => {
  const release = Promise.withResolvers<void>()
  let descendant!: Promise<string | undefined>
  const parent = outcome(
    SkillManager.withCatalogMutationOwner(async () => {
      await Config.updateGlobalPatch({ username: "descendant-owner-current" })
      await SkillManager.withCatalogMutationOwner(async () => {
        descendant = release.promise.then(() =>
          SkillManager.withCatalogMutationOwner(async () => (await Config.getGlobal()).username),
        )
      })
      release.resolve()
      return withTimeout(descendant, 2000, "ancestor-owned catalog descendant")
    }),
  )
  const result = await parent
  await descendant
  expect(result).toEqual({ value: "descendant-owner-current" })
}, 20000)

test("preparation retains its lifecycle turn until an accepted child reads the prepared context", async () => {
  await using project = await memoryProject()
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  let child!: Promise<{ value: string } | { error: unknown }>
  const preparing = Instance.provide({
    directory: project.path,
    init: async () => {
      child = outcome(
        SkillManager.withCatalogMutationOwner(async () => {
          entered.resolve()
          await release.promise
          return withTimeout(
            Instance.provide({ directory: project.path, fn: () => "prepared-child-current" }),
            2000,
            "accepted prepared child",
          )
        }),
      )
      await entered.promise
    },
    fn: () => "preparation-current",
  })
  await entered.promise
  await Bun.sleep(50)
  release.resolve()
  const [parent, accepted] = await Promise.all([preparing, child])
  expect({ parent, accepted }).toEqual({ parent: "preparation-current", accepted: { value: "prepared-child-current" } })
}, 20000)

for (const gate of ["project", "process"] as const) {
  test(`a catalog owner receives the current ${gate} admission error from every identity reader`, async () => {
    await using project = await memoryProject()
    const projectID = await Instance.provide({ directory: project.path, fn: () => Instance.project.id })
    using admission =
      gate === "project"
        ? await Instance.closeProjectAdmission({ projectID, directories: [project.path] })
        : Instance.acquireProcessSettlementGate()
    const readers = [
      () => Instance.provideProjectIdentity({ directory: project.path, fn: () => Instance.directory }),
      () => Instance.tryProvideActive({ directory: project.path, fn: () => Instance.directory }),
      () => Instance.forEachActive({ fn: () => undefined }),
    ]
    const errors = await SkillManager.withCatalogMutationOwner(() =>
      Promise.all(
        readers.map(async (read) => {
          const result = await outcome(read())
          if ("error" in result && result.error instanceof Error)
            return { name: result.error.name, message: result.error.message }
          return result
        }),
      ),
    )
    const error =
      gate === "project"
        ? { name: "Error", message: `Project ${projectID} instance admission is closed during deletion` }
        : {
            name: "InstanceProcessAdmissionClosedError",
            message: "Instance process admission is closed during runtime settlement",
          }
    expect(errors).toEqual([error, error, error])
  }, 20000)
}
