import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { OciTaskContainerUnavailableError } from "../src/execution-capsule/oci-task-container"
import { File } from "../src/file"
import { Instance } from "../src/project/instance"
import { Session } from "../src/session"
import { toolFailureCauseFromUnknown } from "../src/session/tool-failure-cause"
import { ReadTool, taskFileStatOrMissing } from "../src/tool/read"
import { Tool } from "../src/tool/tool"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

test("Read Tool preserves typed Execution Capsule runtime failures", async () => {
  const unavailable = new OciTaskContainerUnavailableError("Task Container exited before stat")
  let received: unknown
  try {
    await taskFileStatOrMissing(async () => {
      throw unavailable
    })
  } catch (error) {
    received = error
  }
  expect(received).toBe(unavailable)
})

test("Read Tool reports canonical missing paths and preserves nearby-path guidance", async () => {
  await using project = await memoryProject("read-missing-path-contract")
  await Instance.provide({ directory: project.path, fn: async () => {
    await fs.mkdir(path.join(project.path, "docs"))
    const suggestion = path.join(project.path, "docs", "brief.md")
    await fs.writeFile(suggestion, "Source facts\n")
    const session = await Session.create({ kind: "assistant", title: "Missing read path contract" })
    const ctx: Tool.Context = {
      sessionID: session.id,
      messageID: "message_read_missing_path_contract",
      callID: "tool_read_missing_path_contract",
      agent: "coding",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      executionAuthority: { kind: "conversation", sessionID: session.id, projectID: Instance.project.id, directory: project.path },
      executionSurface: Tool.executionSurface(["read"], []),
    }
    const reader = await ReadTool.init()
    for (const [relative, guidance] of [
      ["new-directory/brief.md", ""],
      ["docs/brief", `\n\nDid you mean one of these?\n${suggestion}`],
    ]) {
      const requested = path.resolve(project.path, relative)
      const message = `File not found: ${requested}${guidance}`
      const error = await reader.execute({ filePath: relative }, ctx).catch((error: unknown) => error)
      expect(error).toBeInstanceOf(File.EntryNotFoundError)
      expect((error as InstanceType<typeof File.EntryNotFoundError>).toObject()).toEqual({
        name: "FileNotFoundError", data: { path: requested, message },
      })
      expect(toolFailureCauseFromUnknown({ error, originSite: "read-contract", classification: "tool-execution" })).toEqual({
        kind: "tool-execution",
        name: "FileNotFoundError",
        message: `FileNotFoundError: ${message}`,
        originSite: "read-contract",
        classification: "tool-execution",
        data: { canonical_error_metadata: { path: requested } },
      })
    }
    expect(await fs.readFile(suggestion, "utf8")).toBe("Source facts\n")
  } })
}, 30_000)
