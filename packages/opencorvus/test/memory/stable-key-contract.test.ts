import { afterEach, expect, test } from "bun:test"
import { Memory } from "../../src/memory"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MemoryTool } from "../../src/tool/memory"
import { Tool } from "../../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

function captureResult(fn: () => unknown): unknown {
  try {
    return fn()
  } catch (error) {
    return error
  }
}

function expectKeyError(error: unknown) {
  expect(error).toBeInstanceOf(Error)
  const result = error as Error & { data: unknown }
  expect({ name: result.name, data: result.data }).toEqual({
    name: "InvalidMemoryKeyError",
    data: {
      message: "Memory key must contain at least one Unicode letter or number",
      code: "invalid_memory_key",
    },
  })
}

test("existing Unicode key aliases keep the same original file and current indexed content", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectId = Instance.project.id
      const first = Memory.writeFile({
        projectId,
        title: "Initial note",
        source: "user",
        key: "  RÉSUMÉ_记录!  ",
        content: "Initial owned note content",
      })
      const current = Memory.writeFile({
        projectId,
        title: "Current note",
        source: "user",
        key: "re-sume 记录",
        content: "currentkeyalias current note content",
      })
      expect({ id: current.id, key: current.key, title: current.title, timeCreated: current.timeCreated }).toEqual({
        id: first.id,
        key: "re-sume-记录",
        title: "Current note",
        timeCreated: first.timeCreated,
      })
      expect(
        Memory.search({ projectId, query: "currentkeyalias" }).map(({ fileId, content }) => ({ fileId, content })),
      ).toEqual([{ fileId: first.id, content: "currentkeyalias current note content" }])
    },
  })
})

test("provided keys with no canonical letters or numbers return the explicit key error", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectId = Instance.project.id
      for (const key of ["", " \t ", "---", "🪶", "\u0301"]) {
        expectKeyError(
          captureResult(() =>
            Memory.writeFile({
              projectId,
              title: "Explicit key input",
              source: "user",
              content: "Owned input content",
              key,
            }),
          ),
        )
      }
    },
  })
})

test("createFile shares the explicit key contract and accepts a valid canonical parent", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectId = Instance.project.id
      for (const key of ["", "---"]) {
        expectKeyError(
          captureResult(() => Memory.createFile({ projectId, title: "Explicit parent key", source: "user", key })),
        )
      }
      const file = Memory.createFile({ projectId, title: "Owned parent", source: "user", key: "  Parent_记录  " })
      expect({ projectId: file.projectId, key: file.key }).toEqual({ projectId, key: "parent-记录" })
      expect(
        Memory.writeChunks(file.id, projectId, "parentkeycontract original content").map(({ fileId, content }) => ({
          fileId,
          content,
        })),
      ).toEqual([{ fileId: file.id, content: "parentkeycontract original content" }])
    },
  })
})

test("omitted and undefined keys still create separately owned files", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectId = Instance.project.id
      const first = Memory.writeFile({
        projectId,
        title: "First unkeyed note",
        source: "user",
        content: "firstunkeyed original",
      })
      const second = Memory.writeFile({
        projectId,
        title: "Second unkeyed note",
        source: "user",
        content: "secondunkeyed original",
        key: undefined,
      })
      expect(new Set([first.id, second.id]).size).toBe(2)
      expect([first, second].map(({ key, projectId }) => ({ key, projectId }))).toEqual([
        { key: undefined, projectId },
        { key: undefined, projectId },
      ])
      expect(
        Memory.listFiles({ projectId })
          .map(({ id }) => id)
          .sort(),
      ).toEqual([first.id, second.id].sort())
    },
  })
})

test("the production Memory Tool exposes the named error and then writes a valid stable identity", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const session = await Session.create({ kind: "root", title: "Local Memory Tool key contract" })
      const context: Tool.Context = {
        sessionID: session.id,
        messageID: "",
        agent: "memory-key-contract",
        abort: new AbortController().signal,
        messages: [],
        executionSurface: Tool.executionSurface([MemoryTool.id], []),
        extra: { projectID: Instance.project.id },
        metadata() {},
      }
      const tool = await MemoryTool.init()
      expectKeyError(
        await tool
          .execute({ action: "write", title: "Invalid tool key", content: "Owned original input", key: "---" }, context)
          .catch((error: unknown) => error),
      )
      const first = JSON.parse(
        (
          await tool.execute(
            { action: "write", title: "First tool note", content: "Original first revision", key: "  Tool_证据 " },
            context,
          )
        ).output,
      )
      const current = JSON.parse(
        (
          await tool.execute(
            {
              action: "write",
              title: "Current tool note",
              content: "toolkeycurrent actual current revision",
              key: "tool 证据",
            },
            context,
          )
        ).output,
      )
      expect({ id: current.fileId, key: current.key, title: current.title }).toEqual({
        id: first.fileId,
        key: "tool-证据",
        title: "Current tool note",
      })
      expect(
        Memory.getChunksInProject({ fileId: current.fileId, projectId: Instance.project.id }).map(
          ({ content }) => content,
        ),
      ).toEqual(["toolkeycurrent actual current revision"])
    },
  })
})

test("structured and derived episode facts retain their original prefixed keys", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectId = Instance.project.id
      const atom = {
        kind: "profile" as const,
        text: "Keep the original structured project evidence.",
        section: "Project evidence",
      }
      const structured = Memory.captureEpisode({
        projectId,
        title: "Structured owned episode",
        source: "user",
        content: "Original structured episode",
        atomics: [atom, atom],
      })
      const derived = Memory.captureEpisode({
        projectId,
        title: "Derived owned episode",
        source: "user",
        content: "## Observations\nKeep original project evidence together for future reads.",
      })
      expect([structured.episode.kind, derived.episode.kind]).toEqual(["episode", "episode"])
      expect(structured.derived.map(({ kind, key }) => ({ kind, key }))).toEqual([
        { kind: "profile", key: "profile-keep-the-original-structured-project-evidence" },
      ])
      expect(derived.derived.map(({ kind, key }) => ({ kind, key }))).toEqual([
        { kind: "fact", key: "fact-keep-original-project-evidence-together-for-future-reads" },
      ])
    },
  })
})
