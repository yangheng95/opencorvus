import { afterEach, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PrimaryAssistantRegistry } from "../../src/agent/primary-assistant-registry"
import { sessionRuntimeFromNativeAgent } from "../../src/agent/session-agent-runtime"
import { CapabilitySearchInput } from "../../src/capability/descriptor"
import { CAPABILITY_REVEAL_RECEIPT_METADATA_KEY } from "../../src/capability/reveal-receipt"
import { Config } from "../../src/config/config"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Message, Session } from "../../src/session"
import { SessionLoop } from "../../src/session/loop"
import { MessageStore } from "../../src/session/message-store"
import { SessionProcessor } from "../../src/session/processor"
import { ToolPartRequestTable } from "../../src/session/session.sql"
import { Database, eq } from "../../src/storage/db"
import { resolveTestCapabilityTools } from "../fixture/capability-occurrence"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

const model = {
  id: "reveal-request-contract",
  providerID: "reveal-request-test",
  name: "Reveal request contract",
  api: { id: "reveal-request-contract", npm: "@ai-sdk/anthropic" },
  options: {},
  limit: { context: 1000000, input: 900000, output: 4096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: {
    toolcall: true,
    attachment: false,
    reasoning: false,
    temperature: true,
    input: { text: true, image: false, audio: false, video: false },
    output: { text: true, image: false, audio: false, video: false },
  },
} as Provider.Model

afterEach(async () => {
  await Instance.disposeAll()
  await resetMemoryDatabase()
})

async function occurrence() {
  const config = await Config.get()
  const agent = sessionRuntimeFromNativeAgent(await PrimaryAssistantRegistry.get("coding", { config }))
  const session = await Session.create({ kind: "assistant", title: "Provider metadata search" })
  const user = await Session.updateMessage({
    id: Identifier.ascending("message"),
    sessionID: session.id,
    role: "user",
    author: "user",
    agent: "coding",
    time: { created: Date.now() },
    model: { providerID: model.providerID, modelID: model.id },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: session.id,
    messageID: user.id,
    type: "text",
    kind: "user_content",
    text: "Discover the requested file-reading capability.",
  })
  const assistant = Message.Assistant.parse({
    id: Identifier.ascending("message"),
    parentID: user.id,
    sessionID: session.id,
    role: "assistant",
    author: "coding",
    agent: "coding",
    path: { cwd: Instance.directory, root: Instance.worktree },
    cost: 0,
    tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    modelID: model.id,
    providerID: model.providerID,
    time: { created: Date.now() },
  })
  const processor = SessionProcessor.create({
    assistantMessage: assistant,
    sessionID: session.id,
    model,
    abort: new AbortController().signal,
    retainAssistantForNextProviderStep: () => true,
  })
  const resolve = () =>
    resolveTestCapabilityTools({ config, model, session, assistant, processor, agent, agentID: "coding", messages: [] })
  const resolved = await resolve()
  return { session, user, assistant, processor, resolved, resolve }
}

type Occurrence = Awaited<ReturnType<typeof occurrence>>
type Result = { output: string; title: string; metadata: Record<string, unknown> }

async function executeSearch(
  context: Occurrence,
  callID: string,
  query: string,
  metadata: Message.ToolPart["metadata"],
) {
  const params = CapabilitySearchInput.parse({ queries: [query], limit: 5 })
  const running = await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: context.session.id,
    messageID: context.assistant.id,
    type: "tool",
    tool: "capability_search",
    callID,
    metadata,
    state: { status: "running", input: params, time: { start: Date.now() } },
  })
  const readRequest = () =>
    Database.use((db) => db.select().from(ToolPartRequestTable).where(eq(ToolPartRequestTable.id, running.id)).get())
  const request = readRequest()
  const options = { toolCallId: callID, messages: [], abortSignal: new AbortController().signal }
  const result = (await context.resolved.tools.capability_search!.execute!(params, options)) as Result
  const completed = (await MessageStore.parts(context.assistant.id)).find((part) => part.id === running.id)
  expect(completed).toMatchObject({
    id: running.id,
    sessionID: context.session.id,
    messageID: context.assistant.id,
    tool: "capability_search",
    callID,
    metadata,
    state: {
      status: "completed",
      input: params,
      output: result.output,
      title: "Capability search",
      metadata: result.metadata,
    },
  })
  expect(readRequest()).toEqual(request)
  expect(JSON.parse(result.output).caller).toBe("conversation")
  const receipt = result.metadata[CAPABILITY_REVEAL_RECEIPT_METADATA_KEY] as {
    occurrence_id: string
    search_call_id: string
    revision: number
  }
  expect(receipt).toMatchObject({ occurrence_id: context.user.id, search_call_id: callID })
  await context.processor.completeRecoveredToolPart({ toolCallID: callID, toolInput: params, output: result })
  expect((await MessageStore.parts(context.assistant.id)).find((part) => part.id === running.id)).toEqual(completed)
  return { params, options, result, completed, request, receipt }
}

test("metadata-bearing search commits its current request, current projection and exact replay after process restart", async () => {
  await using project = await memoryProject("reveal-metadata-restart")
  const statePath = path.join(project.path, "metadata-replay.json")
  let expectedParts: Message.Part[] = []
  await Instance.provide({
    directory: project.path,
    fn: async () => {
      const context = await occurrence()
      const first = await executeSearch(context, "call_metadata_one", "read", { openai: { itemId: "fc_metadata_one" } })
      expect(first.receipt.revision).toBe(1)
      const second = await executeSearch(context, "call_metadata_two", "webfetch", {
        openai: { itemId: "fc_metadata_two", diagnostic: { source: "provider" } },
      })
      expect(second.receipt.revision).toBe(2)
      const rebuilt = await context.resolve()
      expect(SessionLoop.capabilityProjectionForResolvedTools(rebuilt.tools)).toMatchObject({
        occurrence_id: context.user.id,
        revision: 2,
        harness_projection_hash: rebuilt.occurrence.harnessProjection.projection_hash,
        catalog_snapshot_ref: rebuilt.occurrence.binding.snapshot_ref,
        catalog_snapshot_hash: rebuilt.occurrence.binding.snapshot_hash,
      })
      expect(await rebuilt.tools.capability_search!.execute!(first.params, first.options)).toEqual(first.result)
      expectedParts = (await MessageStore.parts(context.assistant.id)).filter((part) => part.type === "tool")
      expect(expectedParts).toEqual([first.completed, second.completed])
      await fs.writeFile(
        statePath,
        JSON.stringify({
          sessionID: context.session.id,
          assistantID: context.assistant.id,
          userID: context.user.id,
          callID: first.options.toolCallId,
          params: first.params,
          model,
        }),
      )
    },
  })
  await Instance.disposeAll()
  // Existing backend replay fixture uses a controlled stream to re-deliver the
  // actual persisted call. This is a process recovery contract, not Provider E2E.
  const child = Bun.spawn(
    [process.execPath, "test/fixture/capability-search-processor-replay-worker.ts", project.path, statePath],
    { cwd: path.resolve(import.meta.dir, "../.."), env: { ...process.env }, stdout: "pipe", stderr: "pipe" },
  )
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ])
  expect(exitCode, stderr).toBe(0)
  const marker = stdout.split(/\r?\n/).find((line) => line.startsWith("CAPABILITY_SEARCH_REPLAY="))
  if (!marker) throw new Error(`Replay worker returned no result: ${stdout}`)
  expect(JSON.parse(marker.slice("CAPABILITY_SEARCH_REPLAY=".length))).toEqual({ parts: expectedParts })
}, 120000)

test("parallel projects retain each exact metadata-bearing request with the same provider call ID", async () => {
  await using left = await memoryProject("reveal-metadata-left")
  await using right = await memoryProject("reveal-metadata-right")
  const results = await Promise.all(
    [left, right].map((project, index) =>
      Instance.provide({
        directory: project.path,
        fn: async () => {
          const context = await occurrence()
          const metadata = {
            provider: { itemId: `item_project_${index}`, nested: { ordinal: index, tags: ["request", "annotation"] } },
          }
          const completed = await executeSearch(context, "call_shared_between_projects", "read", metadata)
          expect(completed.receipt.revision).toBe(1)
          return {
            projectID: Instance.project.id,
            sessionID: context.session.id,
            messageID: context.assistant.id,
            partID: completed.completed!.id,
            metadata,
            output: completed.result.output,
          }
        },
      }),
    ),
  )
  expect(new Set(results.map((result) => result.projectID)).size).toBe(2)
  expect(new Set(results.map((result) => result.sessionID)).size).toBe(2)
  for (const [index, project] of [left, right].entries()) {
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const expected = results[index]!
        const message = await MessageStore.get({ sessionID: expected.sessionID, messageID: expected.messageID })
        expect(Instance.project.id).toBe(expected.projectID)
        expect(message.parts.find((part) => part.id === expected.partID)).toMatchObject({
          sessionID: expected.sessionID,
          metadata: expected.metadata,
          state: { status: "completed", output: expected.output },
        })
      },
    })
  }
}, 120000)
