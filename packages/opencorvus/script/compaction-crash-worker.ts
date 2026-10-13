import assert from "node:assert/strict"
import fs from "node:fs/promises"
import { writeFileSync } from "node:fs"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { MessageStore } from "@/session/message-store"
import { SessionCompaction } from "@/session/compaction"
import { SessionControl } from "@/session/control"
import { SessionLoop } from "@/session/loop"
import { SessionMemory } from "@/memory/session-memory"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { Identifier } from "@/id/id"
import { Database } from "@/storage/db"
import { Bus } from "@/bus"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import { installDefaultControlPlaneToolLoaders } from "@/tool/control-plane-tool-composition"
import {
  CatalogOccurrenceBinding,
  CATALOG_SNAPSHOT_REF_METADATA_KEY,
  CATALOG_SNAPSHOT_HASH_METADATA_KEY,
} from "@/capability/catalog-binding"

const [mode, cut, controlKind, directory, statePath, endpoint] = process.argv.slice(2)
assert(mode && cut && controlKind && directory && statePath && endpoint, "Exact isolated worker arguments required")
const model = { providerID: "compaction-crash-local", modelID: "checkpoint" }
const checkpoint = "Verified correction: retain eu-west; permission: read only; evidence trace CRASH-317."
const codes: Record<string, number> = {
  streaming: 81,
  summary_saved: 82,
  checkpoint_transaction: 83,
  checkpoint_saved: 84,
}
assert(codes[cut], "Unknown cut")
declareNativeTaskProcessDeployment()
installDefaultControlPlaneToolLoaders()

await Instance.provide({
  directory,
  fn: async () => {
    await Config.updateGlobalPatch({
      model: `${model.providerID}/${model.modelID}`,
      small_model: `${model.providerID}/${model.modelID}`,
      enabled_providers: [model.providerID],
      compaction: { tail_turns: 0, max_context_tokens: 256_000 },
      provider: {
        [model.providerID]: {
          name: "Isolated crash transport",
          npm: "@ai-sdk/openai-compatible",
          api: endpoint,
          models: {
            [model.modelID]: {
              name: "Checkpoint",
              tool_call: true,
              modalities: { input: ["text"], output: ["text"] },
              limit: { context: 1_000_000, output: 16_000 },
            },
          },
        },
      },
    })
    let state: any
    async function source(sessionID: string, text: string) {
      const info = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID,
        role: "user",
        author: "user",
        agent: "chat",
        model,
        time: { created: Date.now() },
      })
      await Session.updatePart({ id: Identifier.ascending("part"), sessionID, messageID: info.id, type: "text", text })
      assert(info.role === "user")
      return info
    }
    async function assistant(sessionID: string, parentID: string, text: string, summary = false) {
      const info = await Session.updateMessage({
        id: Identifier.ascending("message"),
        sessionID,
        parentID,
        role: "assistant",
        author: summary ? "compaction" : "chat",
        agent: summary ? "compaction" : "chat",
        summary,
        modelID: model.modelID,
        providerID: model.providerID,
        time: { created: Date.now() },
        path: { cwd: directory, root: directory },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, total: 0, cache: { read: 0, write: 0 } },
      })
      await Session.updatePart({ id: Identifier.ascending("part"), sessionID, messageID: info.id, type: "step-start" })
      await Session.updatePart({ id: Identifier.ascending("part"), sessionID, messageID: info.id, type: "text", text })
      assert(info.role === "assistant")
      const finished = await Session.updateMessage({
        ...info,
        finish: "stop",
        time: { ...info.time, completed: Date.now() },
      })
      assert(finished.role === "assistant")
      return finished
    }
    async function snapshot() {
      const history = await Session.messages({ sessionID: state.sessionID })
      const original = history.filter((message) => state.originalIDs.includes(message.info.id))
      const comparable = structuredClone(original)
      for (const message of comparable) {
        if (message.info.role !== "user") continue
        const binding = CatalogOccurrenceBinding.bindingFromInput(message)
        if (!binding) continue
        const previous = state.original.find((item: Message.WithParts) => item.info.id === message.info.id)
        if (CatalogOccurrenceBinding.bindingFromInput(previous)) continue
        assert.equal(controlKind, "automatic")
        assert.equal(message.info.id, state.sourceID)
        await CatalogOccurrenceBinding.read({ projectID: state.projectID, binding })
        // The canonical next-Turn binder adds only this validated snapshot
        // pair; every preexisting authored field still compares exactly.
        for (const part of message.parts) {
          if (part.type !== "text" || !part.metadata) continue
          delete part.metadata[CATALOG_SNAPSHOT_REF_METADATA_KEY]
          delete part.metadata[CATALOG_SNAPSHOT_HASH_METADATA_KEY]
          const old = previous.parts.find((item: Message.Part) => item.id === part.id)
          if (Object.keys(part.metadata).length === 0 && old?.metadata === undefined) delete part.metadata
        }
      }
      assert.deepEqual(comparable, state.original, "Original authored source facts must survive byte-for-field")
      return {
        memory: await SessionMemory.read(state.sessionID),
        control: SessionControl.get(state.controlID),
        projection: (await Message.filterCompacted(MessageStore.stream(state.sessionID))).map((m) => m.info.id),
        originalIDs: original.map((m) => m.info.id),
        summaries: history
          .filter((m) => m.info.author === "compaction")
          .map((m) => ({
            info: m.info,
            text: SessionMemory.continuationText(m.parts),
            checkpoints: m.parts.filter((part) => part.type === "compaction"),
          })),
      }
    }
    function exitAt(messageID: string) {
      const owner = SessionPromptOwner.current(state.sessionID)
      assert(owner, "The real Session loop must own this cut")
      writeFileSync(
        statePath,
        JSON.stringify({ ...state, interruptedMessageID: messageID, owner, cutPID: process.pid }),
      )
      process.stdout.write(JSON.stringify({ stage: "cut", cut, controlKind, messageID, pid: process.pid }) + "\n")
      process.exit(codes[cut])
    }
    if (mode === "cut") {
      const session = await Session.create({
        kind: "assistant",
        title: `Compaction physical cut ${cut}/${controlKind}`,
      })
      const initial = await source(session.id, "Original request: preserve evidence and read-only authority.")
      const stable = await assistant(
        session.id,
        initial.id,
        "Previous valid checkpoint: original request retained.",
        true,
      )
      await Session.publishCompactionCheckpoint({
        info: stable,
        part: {
          id: Identifier.ascending("part"),
          messageID: stable.id,
          sessionID: session.id,
          type: "compaction",
          auto: true,
          anchor_id: initial.id,
        },
      })
      await assistant(session.id, initial.id, "Verified trace CRASH-317; source bytes remain durable. ".repeat(700))
      const correction = await source(session.id, "Correction: use eu-west. Permission remains read only.")
      const control = await SessionCompaction.create({
        sessionID: session.id,
        source: correction,
        model,
        auto: controlKind === "automatic",
      })
      const original = await Session.messages({ sessionID: session.id })
      state = {
        sessionID: session.id,
        projectID: session.projectID,
        controlID: control.id,
        sourceID: correction.id,
        stableID: stable.id,
        initialID: initial.id,
        originalIDs: original.map((m) => m.info.id),
        original,
        checkpoint,
      }
      writeFileSync(statePath, JSON.stringify(state))
      if (cut === "streaming") {
        const update = Session.updatePartWithSignal
        Session.updatePartWithSignal = (async (signal, input) => {
          const result = await update(signal, input)
          if (input.sessionID === session.id && input.type === "text" && input.text.length > 0) exitAt(input.messageID)
          return result
        }) as typeof update
      }
      if (cut === "summary_saved") {
        const publish = Session.publishCompactionCheckpoint
        Object.assign(Session, {
          publishCompactionCheckpoint: Object.assign(async (input: Parameters<typeof publish>[0]) => {
            exitAt(input.info.id)
            return publish(input)
          }, publish),
        })
      }
      if (cut === "checkpoint_transaction") {
        const publish = Bus.publishOwnedInTransaction
        Bus.publishOwnedInTransaction = ((definition, properties) => {
          const result = publish(definition, properties)
          const part = (properties as { part?: Message.Part }).part
          if (
            definition.type === Message.Event.PartUpdated.type &&
            part?.type === "compaction" &&
            part.sessionID === session.id
          ) {
            assert(Database.hasActiveTransaction(), "Cut must be inside the uncommitted checkpoint transaction")
            exitAt(part.messageID)
          }
          return result
        }) as typeof publish
      }
      if (cut === "checkpoint_saved") {
        const consume = SessionControl.consume
        SessionControl.consume = (input) => {
          if (input.id === state.controlID) {
            assert.equal(typeof input.payload?.result_summary_message_id, "string")
            exitAt(input.payload!.result_summary_message_id as string)
          }
          return consume(input)
        }
      }
    } else {
      state = JSON.parse(await fs.readFile(statePath, "utf8"))
    }
    const before = await snapshot()
    if (mode === "inspect") {
      process.stdout.write(JSON.stringify({ stage: "inspect", snapshot: before }) + "\n")
      return
    }
    if (mode === "recover") {
      assert.equal(
        SessionPromptOwner.observation(state.owner),
        "dead_or_reused",
        "The original physical owner must be dead",
      )
      assert.equal(before.control?.status, "pending")
      assert.equal(
        before.memory?.sourceMessageID,
        cut === "checkpoint_saved" ? state.interruptedMessageID : state.stableID,
      )
      process.stdout.write(JSON.stringify({ stage: "recovery-start", cut, controlKind, before }) + "\n")
    }
    const result = await SessionLoop.loop({
      sessionID: state.sessionID,
      result_mode: controlKind === "automatic" ? "reply" : "summary",
      summary_source_message_id: state.sourceID,
      summary_control_id: state.controlID,
    })
    assert.equal(mode, "recover", "Requested physical cut must have been reached")
    const after = await snapshot()
    assert.equal(after.control?.status, "consumed")
    const summaryID = after.control.payload.result_summary_message_id
    assert.equal(after.memory?.sourceMessageID, summaryID)
    assert.equal(after.memory?.content, checkpoint)
    assert.deepEqual(after.projection, [
      state.initialID,
      summaryID,
      state.sourceID,
      ...(controlKind === "automatic" ? [result.info.id] : []),
    ])
    if (controlKind === "manual") assert.equal(result.info.id, summaryID)
    else {
      assert.equal(result.info.role === "assistant" && result.info.finish, "stop")
      assert.equal(result.info.role === "assistant" && result.info.author, "chat")
      assert.equal(SessionMemory.continuationText(result.parts), checkpoint)
    }
    if (cut === "checkpoint_saved") assert.equal(summaryID, state.interruptedMessageID)
    if (cut === "streaming") {
      const interrupted = after.summaries.find((m) => m.info.id === state.interruptedMessageID)
      assert.equal(
        interrupted?.info.role === "assistant" && interrupted.info.error?.name,
        "ProcessExecutionInterruptedError",
      )
      assert(interrupted?.text.length, "Real partial source text must remain visible")
    }
    process.stdout.write(
      JSON.stringify({ stage: "recovered", cut, controlKind, before, after, resultID: result.info.id }) + "\n",
    )
  },
})
await Instance.disposeAll()
Database.close()
