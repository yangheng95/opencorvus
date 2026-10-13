import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Database } from "@/storage/db"
import { Log } from "@/util/log"
import {
  createContinuousGoal,
  resolveGoalOwner,
  readContinuousGoal,
  requestGoalContinuation,
  updateContinuousGoal,
} from "@/continuous-goal/store"

const [mode, directory, sessionID] = process.argv.slice(2)
if (!mode || !directory) throw new Error("Goal worker requires mode and project directory.")
await Log.init({ print: false })
try {
  const result = await Instance.provide({
    directory,
    fn: async () => {
      if (mode === "create") {
        const session = await Session.create({ kind: "assistant", title: "Durable goal fact race" })
        const goal = createContinuousGoal(
          resolveGoalOwner({ kind: "chat", id: session.id }),
          {
            requestID: "create",
            objective: "Persist exact goal identity across process restarts",
            turnBudget: 2,
          },
          "user",
        )
        return { sessionID: session.id, goal }
      }
      if (!sessionID) throw new Error("Goal worker requires Session identity.")
      const owner = resolveGoalOwner({ kind: "chat", id: sessionID })
      const goal = readContinuousGoal(owner)!
      if (mode === "admit")
        return { request: requestGoalContinuation(owner, goal, "settled-frontier"), goal: readContinuousGoal(owner) }
      if (mode === "pause")
        return updateContinuousGoal(
          owner,
          {
            requestID: "pause",
            goalID: goal.id,
            expectedRevision: goal.revision,
            status: "paused",
            reason: "User pause",
          },
          "user",
        )
      if (mode === "read") return goal
      throw new Error("Unknown goal worker mode.")
    },
  })
  console.log("[goal-result]" + JSON.stringify(result))
} finally {
  await Instance.disposeAll()
  Database.close()
}
