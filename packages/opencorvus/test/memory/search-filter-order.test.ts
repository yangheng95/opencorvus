import { afterEach, describe, expect, test } from "bun:test"
import { Memory } from "../../src/memory"
import { Instance } from "../../src/project/instance"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

describe("Memory exact filter ordering", () => {
  test("applies kind and source filters before the bounded full-text candidate window", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectId = Instance.project.id
        for (let index = 0; index < 12; index += 1) {
          const file = Memory.createFile({
            projectId,
            title: `Distractor ${index}`,
            source: "agent",
            kind: "note",
          })
          Memory.writeChunks(file.id, projectId, "exactfiltertoken")
        }
        const expected = Memory.createFile({
          projectId,
          title: "Filtered fact",
          source: "user",
          kind: "fact",
        })
        Memory.writeChunks(expected.id, projectId, "exactfiltertoken")

        expect(
          Memory.search({
            query: "exactfiltertoken",
            projectId,
            limit: 1,
            minScore: 0,
            kinds: ["fact"],
            sources: ["user"],
          }).map((result) => ({ fileId: result.fileId, kind: result.kind, source: result.source })),
        ).toEqual([{ fileId: expected.id, kind: "fact", source: "user" }])
      },
    })
  })
})
