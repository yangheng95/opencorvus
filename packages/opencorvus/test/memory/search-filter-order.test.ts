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

  test("ranks across kinds by relevance instead of letting kind weight override the score", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectId = Instance.project.id
        // Same term, same document length: only importance and kind weight
        // separate these two. `profile` carries the higher kind weight (1.45 vs
        // 1.1) while `fact` carries the higher importance multiplier, so the
        // combined score favours the fact. Ranking by kind first — which the
        // comparator used to do — put the profile first regardless.
        const profile = Memory.createFile({
          projectId,
          title: "Low importance profile",
          source: "agent",
          kind: "profile",
          importance: 0,
        })
        Memory.writeChunks(profile.id, projectId, "crossrankingtoken")
        const fact = Memory.createFile({
          projectId,
          title: "High importance fact",
          source: "agent",
          kind: "fact",
          importance: 100,
        })
        Memory.writeChunks(fact.id, projectId, "crossrankingtoken")

        const results = Memory.search({ query: "crossrankingtoken", projectId, limit: 10, minScore: 0 })

        expect(new Set(results.map((result) => result.kind))).toEqual(new Set(["profile", "fact"]))
        expect(results.map((result) => result.score)).toEqual(
          [...results.map((result) => result.score)].sort((left, right) => right - left),
        )
        expect(results[0]?.fileId).toBe(fact.id)
      },
    })
  })

  test("rejects singleton document kinds instead of silently returning nothing for them", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const projectId = Instance.project.id
        // Rejected before the empty-project short circuit, so the caller error
        // does not depend on whether this project has any memory yet.
        expect(() => Memory.search({ query: "anything", projectId, kinds: ["project_context"] })).toThrow(
          /expected one of: profile, lesson, fact, note, episode; received: project_context/,
        )
        expect(() => Memory.search({ query: "anything", projectId, kinds: ["user_message"] })).toThrow(
          /received: user_message/,
        )

        const note = Memory.createFile({ projectId, title: "Real note", source: "agent", kind: "note" })
        Memory.writeChunks(note.id, projectId, "singletondoctoken")
        expect(() => Memory.search({ query: "singletondoctoken", projectId, kinds: ["user_message"] })).toThrow(
          /received: user_message/,
        )
      },
    })
  })
})
