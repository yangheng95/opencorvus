import { afterEach, expect, test } from "bun:test"
import { Instance } from "@/project/instance"
import { Config } from "@/config/config"
import { SkillManager } from "@/skill/manager"
import { markConversationCapabilityTransactionalInit } from "@/conversation/capability-transaction"
import { withTimeout } from "@/util/await-with-timeout"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

test("a catalog owner reads the current project while a new capability preflight awaits that owner", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: () => Config.get() })
  const ownerEntered = Promise.withResolvers<void>()
  const readIdentity = Promise.withResolvers<void>()
  let preflightRuns = 0
  const init = markConversationCapabilityTransactionalInit(
    async () => undefined,
    async () => {
      await Config.get()
      preflightRuns++
    },
  )
  const owner = SkillManager.withCatalogMutationOwner(async () => {
    ownerEntered.resolve()
    await readIdentity.promise
    return withTimeout(
      Instance.provideProjectIdentity({ directory: project.path, fn: () => "current-project-identity" }),
      2000,
      "catalog-owned project identity",
    )
  }).then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  )
  await ownerEntered.promise
  const preparing = Instance.provide({ directory: project.path, init, fn: () => "prepared-project" })
  await Bun.sleep(50)
  readIdentity.resolve()
  const [actualOwner, prepared] = await Promise.all([owner, preparing])
  expect(actualOwner).toEqual({ value: "current-project-identity" })
  expect({ prepared, preflightRuns }).toEqual({ prepared: "prepared-project", preflightRuns: 1 })
}, 15000)
