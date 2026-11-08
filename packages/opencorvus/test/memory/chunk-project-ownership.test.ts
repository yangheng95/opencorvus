import { afterEach, expect, test } from "bun:test"
import { Memory } from "../../src/memory"
import { ProjectMemory, ProtectedProjectMemoryError } from "../../src/memory/project-memory"
import { Instance } from "../../src/project/instance"
import { NotFoundError } from "../../src/storage/db"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterEach(resetMemoryDatabase)

function writeError(fileID: string, projectID: string): unknown {
  try {
    Memory.writeChunks(fileID, projectID, "replacementtoken replacement content")
  } catch (error) {
    return error
  }
}

test("owned chunks publish their original file identity and searchable content", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectID = Instance.project.id
      const file = Memory.createFile({ projectId: projectID, title: "Owned note", source: "user", kind: "note" })
      const chunks = Memory.writeChunks(file.id, projectID, "ownedchunkcontract original content")
      expect(chunks.map(({ fileId, projectId, content }) => ({ fileId, projectId, content }))).toEqual([
        { fileId: file.id, projectId: projectID, content: "ownedchunkcontract original content" },
      ])
      expect(chunks[0]!.tokenCount).toBeGreaterThan(0)
      expect(
        Memory.search({ projectId: projectID, query: "ownedchunkcontract" }).map(({ fileId, fileTitle, content }) => ({
          fileId,
          fileTitle,
          content,
        })),
      ).toEqual([{ fileId: file.id, fileTitle: "Owned note", content: "ownedchunkcontract original content" }])
    },
  })
})

test("a file from another project maps to the explicit missing-parent error", async () => {
  await using owner = await memoryProject("chunk-owner-project")
  await using caller = await memoryProject("chunk-caller-project")
  let ownerProjectID = ""
  let ownerFileID = ""
  await Instance.provide({
    directory: owner.path,
    fn: async () => {
      ownerProjectID = Instance.project.id
      ownerFileID = Memory.writeFile({
        projectId: ownerProjectID,
        title: "Owner note",
        source: "user",
        content: "owneroriginaltoken original owner content",
      }).id
    },
  })
  await Instance.provide({
    directory: caller.path,
    fn: async () => {
      const projectID = Instance.project.id
      const local = Memory.writeFile({
        projectId: projectID,
        title: "Caller note",
        source: "user",
        content: "calleroriginaltoken original caller content",
      })
      const error = writeError(ownerFileID, projectID)
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as InstanceType<typeof NotFoundError>).data).toEqual({
        message: `Memory file ${ownerFileID} not found for project ${projectID}`,
      })
      expect(
        Memory.getChunksInProject({ fileId: ownerFileID, projectId: ownerProjectID }).map(({ content }) => content),
      ).toEqual(["owneroriginaltoken original owner content"])
      expect(
        Memory.getChunksInProject({ fileId: local.id, projectId: projectID }).map(({ content }) => content),
      ).toEqual(["calleroriginaltoken original caller content"])
      expect(
        Memory.search({ projectId: projectID, query: "calleroriginaltoken" }).map(({ fileId, content }) => ({
          fileId,
          content,
        })),
      ).toEqual([{ fileId: local.id, content: "calleroriginaltoken original caller content" }])
    },
  })
})

test("an unknown file maps to the same explicit missing-parent contract", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectID = Instance.project.id
      const error = writeError("mem_unknown_owned_file", projectID)
      expect(error).toBeInstanceOf(NotFoundError)
      expect((error as InstanceType<typeof NotFoundError>).data).toEqual({
        message: `Memory file mem_unknown_owned_file not found for project ${projectID}`,
      })
      const file = Memory.writeFile({
        projectId: projectID,
        title: "Valid after rejection",
        source: "user",
        content: "validaftererror original content",
      })
      expect(
        Memory.search({ projectId: projectID, query: "validaftererror" }).map(({ fileId, content }) => ({
          fileId,
          content,
        })),
      ).toEqual([{ fileId: file.id, content: "validaftererror original content" }])
    },
  })
})

test("the owned host document retains its protected-write error and original content", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectID = Instance.project.id
      const document = ProjectMemory.read(projectID)
      const fileID = ProjectMemory.TestHooks.documentFile(projectID)
      const error = writeError(fileID, projectID)
      expect(error).toBeInstanceOf(ProtectedProjectMemoryError)
      expect((error as InstanceType<typeof ProtectedProjectMemoryError>).data).toEqual({
        message: `Project memory ledger file ${fileID} is read-only`,
        code: "protected_project_memory",
        fileID,
      })
      const current = ProjectMemory.read(projectID)
      expect({ content: current.content, revision: current.revision }).toEqual({
        content: document.content,
        revision: document.revision,
      })
    },
  })
})

test("the production writeFile path updates the same keyed file and current full-text content", async () => {
  await using project = await memoryProject()
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const projectId = Instance.project.id
      const original = Memory.writeFile({
        projectId,
        title: "Original keyed note",
        source: "user",
        key: "owned-key",
        content: "first keyed content",
      })
      const updated = Memory.writeFile({
        projectId,
        title: "Updated keyed note",
        source: "user",
        key: "owned-key",
        content: "currentkeyedtoken updated content",
      })
      expect({ id: updated.id, projectId: updated.projectId, title: updated.title, key: updated.key }).toEqual({
        id: original.id,
        projectId,
        title: "Updated keyed note",
        key: "owned-key",
      })
      expect(
        Memory.search({ projectId, query: "currentkeyedtoken" }).map(({ fileId, fileTitle, content }) => ({
          fileId,
          fileTitle,
          content,
        })),
      ).toEqual([
        { fileId: original.id, fileTitle: "Updated keyed note", content: "currentkeyedtoken updated content" },
      ])
    },
  })
})
