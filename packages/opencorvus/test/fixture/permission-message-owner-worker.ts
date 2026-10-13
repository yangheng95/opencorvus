import fs from "node:fs/promises"
import { setTimeout as pause } from "node:timers/promises"
import { Instance } from "../../src/project/instance"
import { declareNativeTaskProcessDeployment } from "../../src/runtime/task-process-deployment"
import { SessionLoop } from "../../src/session/loop"
import { SessionPromptOwner } from "../../src/session/prompt/owner"
import { SessionPromptState } from "../../src/session/prompt/state"
import { MessageStore } from "../../src/session/message-store"
import { Database } from "../../src/storage/db"
import { permissionMessageResult } from "./permission-message-result"
import { completedReadResult, openResultRecoveryMission } from "./completed-read-result"
import { PermissionAuthority } from "../../src/permission/authority"
import { recoverMissionProcessSession } from "../../src/mission/process-recovery"
import { SessionWake } from "../../src/session/wake"
import { installDefaultControlPlaneToolLoaders } from "../../src/tool/control-plane-tool-composition"

const [mode, directory, filePath, stateFile] = process.argv.slice(2)
if (!mode || !directory || !filePath || !stateFile) throw new Error("Exact owned process inputs required")
declareNativeTaskProcessDeployment()
installDefaultControlPlaneToolLoaders()
await Instance.provide({
  directory,
  fn: async () => {
    if (mode === "mission-cut") {
      const mission = await openResultRecoveryMission()
      const value = await permissionMessageResult(filePath, mission)
      const requested = Promise.withResolvers<PermissionAuthority.Request>()
      void completedReadResult({
        mode: "ask",
        filePath,
        session: mission,
        message: value.assistant,
        approve: async (request) => {
          requested.resolve(request)
          await new Promise(() => {})
        },
      }).catch(() => undefined)
      const pending = await requested.promise
      const abort = SessionPromptState.start(mission.id, directory)
      if (!abort) throw new Error("Actual Mission Prompt owner required")
      SessionPromptState.bindMessageOwner(mission.id, value.assistant.id, abort)
      const state = { request: value.request, pending, owner: SessionPromptOwner.current(mission.id), pid: process.pid }
      await fs.writeFile(stateFile, JSON.stringify(state), { flag: "wx" })
      process.stdout.write(JSON.stringify(state))
      process.exit(86)
    }
    if (mode === "hold") {
      const value = await permissionMessageResult(filePath)
      const abort = SessionPromptState.start(value.session.id, directory)
      if (!abort) throw new Error("Actual prompt owner required")
      SessionPromptState.bindMessageOwner(value.session.id, value.assistant.id, abort)
      try {
        await fs.writeFile(
          stateFile,
          JSON.stringify({
            request: value.request,
            owner: SessionPromptOwner.current(value.session.id),
            pid: process.pid,
          }),
          { flag: "wx" },
        )
        for await (const input of process.stdin) {
          if (input.length > 0) break
        }
      } finally {
        await SessionPromptState.finish(value.session.id, abort, directory)
      }
      return
    }
    if (mode !== "inspect" && mode !== "inspect-mission") throw new Error(`Unexpected owner probe mode ${mode}`)
    const state = JSON.parse(await fs.readFile(stateFile, "utf8"))
    const identity = { sessionID: state.request.sessionID, messageID: state.request.messageID }
    const before = await MessageStore.get(identity)
    const observed = SessionPromptOwner.observeCurrent(identity.sessionID)
    using wake =
      mode === "inspect-mission" ? SessionWake.TestHooks.installWakeLoopExecutor(async () => undefined) : undefined
    let outcome: unknown
    try {
      outcome = await Promise.race([
        SessionLoop.resumePermissionContinuation(state.request),
        pause(5_000).then(() => ({ observation: "continuation-still-pending" })),
      ])
    } catch (error) {
      outcome = { error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }
    }
    const after = await MessageStore.get(identity)
    let missionRecovery: unknown
    if (mode === "inspect-mission") {
      try {
        missionRecovery = await recoverMissionProcessSession(identity.sessionID)
      } catch (error) {
        missionRecovery = { error: error instanceof Error ? error.message : String(error) }
      }
    }
    const evidence = {
      state,
      observed,
      outcome,
      before,
      after,
      currentOwner: SessionPromptOwner.current(identity.sessionID),
      missionRecovery,
    }
    // The inspector observes a held peer; never join that peer's open Turn just
    // to publish the observation. Its owned process is the bounded probe scope.
    await new Promise<void>((resolve) => process.stdout.write(JSON.stringify(evidence), () => resolve()))
    process.exit(0)
  },
})
await Instance.disposeAll()
Database.close()
