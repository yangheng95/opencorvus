import { afterEach, expect, test } from "bun:test"
import { Config } from "@/config/config"
import { SkillManager } from "@/skill/manager"
import { withSkillCatalogReferenceRead } from "@/skill/reference-lock"
import { Instance } from "@/project/instance"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)

for (const writer of ["project", "global"] as const) {
  for (const owner of ["catalog", "reference"] as const) {
    test(`${writer} Config mutation settles after a ${owner} reader observes Config`, async () => {
      await using project = await memoryProject()
      const entered = Promise.withResolvers<void>()
      const release = Promise.withResolvers<void>()
      const read = async () => {
        entered.resolve()
        await release.promise
        return (await Config.getGlobal()).username ?? "default"
      }
      const reader = Instance.provide({
        directory: project.path,
        fn: () =>
          owner === "catalog" ? SkillManager.withCatalogProjection(read) : withSkillCatalogReferenceRead(read),
      })
      await entered.promise
      const mutation = Instance.provide({
        directory: project.path,
        fn: () =>
          writer === "project"
            ? Config.updateProjectPatch({ username: `project-${owner}` })
            : Config.updateGlobalPatch({ username: `global-${owner}` }),
      })
      // Let the asynchronous writer request its owners while the reader is
      // still held; the reader then proves it can finish its actual Config read.
      await Bun.sleep(50)
      release.resolve()
      const settled = await Promise.all([reader, mutation])
      expect(typeof settled[0]).toBe("string")
      const actual = await Instance.provide({ directory: project.path, fn: () => Config.get() })
      expect(actual.username).toBe(`${writer}-${owner}`)
    }, 20000)
  }
}
