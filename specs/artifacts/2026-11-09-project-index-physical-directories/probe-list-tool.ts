import { writeFile } from "node:fs/promises"
import assert from "node:assert/strict"
import path from "node:path"
import { Instance } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/project/instance.ts"
import { resolveSessionExecutionAuthority } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/engine/task-session-lineage.ts"
import { Session } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/session/index.ts"
import { ListTool } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/ls.ts"
import { Tool } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/tool/tool.ts"
import { Identifier } from "file:///D:/myhexin-local/opencorvus/packages/opencorvus/src/id/id.ts"

const root = process.argv[2]
const directory = path.join(root, "project-before")
try {
  const result = await Instance.provide({ directory, async fn() {
    const session = await Session.create({ kind: "assistant", title: "Owned directory list contract review" })
    const authority = await resolveSessionExecutionAuthority({
      sessionID: session.id, projectID: Instance.project.id, expected: { kind: "conversation" },
    })
    const context: Tool.Context = {
      sessionID: session.id, messageID: Identifier.ascending("message"), callID: "owned-directory-list",
      agent: "coding", abort: new AbortController().signal, messages: [], executionAuthority: authority,
      executionSurface: Tool.executionSurface(["list"], []),
      metadata() {},
      async ask() { throw new Error("Unexpected external permission request") },
    }
    const tool = await ListTool.init()
    const listed = await tool.execute({ path: directory }, context)
    assert.match(listed.output, /opal-note\.txt/)
    return { title: listed.title, metadata: listed.metadata, output: listed.output }
  } })
  await writeFile(path.join(root, "baseline-tool-list.json"), JSON.stringify(result,null,2)+"\n")
  console.log(JSON.stringify(result))
} finally {
  await Instance.disposeAll()
}