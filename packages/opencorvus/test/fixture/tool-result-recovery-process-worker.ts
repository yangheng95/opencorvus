import fs from "node:fs/promises"
import { Bus } from "../../src/bus"
import { Instance } from "../../src/project/instance"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { SessionLoop } from "../../src/session/loop"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { SessionWake } from "../../src/session/wake"
import { recoverMissionProcessSession } from "../../src/mission/process-recovery"
import { MessageStore } from "../../src/session/message-store"
import { Message } from "../../src/session/message"
import { PermissionAuthority } from "../../src/permission/authority"
import { Database } from "../../src/storage/db"
import { completedReadResult, openResultRecoveryMission } from "./completed-read-result"

const [mode, directory, filePath, stateFile] = process.argv.slice(2)
if (!mode || !directory || !filePath || !stateFile) throw new Error("Exact recovery process inputs required")
declareNativeTaskProcessDeployment()

await Instance.provide({ directory, fn: async () => {
  if (mode === "receipt-cut" || mode === "transaction-cut" || mode === "mission-cut") {
    const mission = mode === "mission-cut" ? await openResultRecoveryMission() : undefined
    if (mission) {
      const owner = SessionPromptOwner.acquire({ sessionID: mission.id, projectID: Instance.project.id, directory })
      if (!owner.acquired) throw new Error("Actual Mission prompt ownership required before process exit")
    }
    const value = await completedReadResult({ mode: "full_access", filePath, session: mission })
    const state = { sessionID: value.session.id, messageID: value.assistant.id, partID: value.part.id,
      callID: value.callID, output: value.result.output, sources: value.result.sources, executeCount: value.executeCount(),
      mission: Boolean(mission) }
    await fs.writeFile(stateFile, JSON.stringify(state), { flag: "wx" })
    if (mode === "receipt-cut" || mode === "mission-cut") {
      process.stdout.write(JSON.stringify({ mode, state }), () => process.exit(mode === "mission-cut" ? 88 : 86))
      await new Promise(() => {})
    }
    const publish = Bus.publishOwnedInTransaction
    Bus.publishOwnedInTransaction = ((definition, properties) => {
      const publication = publish(definition, properties)
      const part = (properties as { part?: Message.Part }).part
      if (definition === Message.Event.PartUpdated && part?.id === value.part.id &&
        part.type === "tool" && part.state.status === "completed") {
        if (!Database.hasActiveTransaction()) throw new Error("Exact uncommitted Tool outcome required")
        process.exit(87)
      }
      return publication
    }) as typeof publish
    await new Promise<void>((resolve) => process.stdout.write(JSON.stringify({ mode, state }), () => resolve()))
    await value.processor.completeRecoveredToolPart({ toolCallID: value.callID, toolInput: value.args, output: value.result })
    throw new Error("Exact Source transaction cut was not reached")
  }
  if (mode !== "recover") throw new Error(`Unknown recovery process mode ${mode}`)
  const state = JSON.parse(await fs.readFile(stateFile, "utf8"))
  const before = await MessageStore.get({ sessionID: state.sessionID, messageID: state.messageID })
  let missionRecovery: unknown
  if (state.mission) {
    using wakeConsumer = SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined)
    missionRecovery = await recoverMissionProcessSession(state.sessionID)
  } else await SessionLoop.terminalizeRecoveredIncompleteAssistant(state.sessionID)
  const first = await MessageStore.get({ sessionID: state.sessionID, messageID: state.messageID })
  await SessionLoop.terminalizeRecoveredIncompleteAssistant(state.sessionID)
  const second = await MessageStore.get({ sessionID: state.sessionID, messageID: state.messageID })
  const history = await PermissionAuthority.history()
  const request = history.find((row) => row.event_type === "requested" && row.tool_call_id === state.callID)
  if (!request) throw new Error("Recovered Tool requires its actual permission request")
  const events = history.filter((row) => row.request_id === request.request_id)
  process.stdout.write(JSON.stringify({ before, first, second, state, missionRecovery,
    executionStarts: events.filter((row) => row.event_type === "execution_started").length,
    executionSuccesses: events.filter((row) => row.event_type === "execution_succeeded").length,
  }))
} })
await Instance.disposeAll()
Database.close()
