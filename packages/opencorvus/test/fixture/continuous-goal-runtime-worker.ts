import fs from "node:fs/promises"
import path from "node:path"
import { Auth } from "@/auth"
import { Config } from "@/config/config"
import { Instance } from "@/project/instance"
import { Database } from "@/storage/db"
import { Session } from "@/session"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionPromptState } from "@/session/prompt/state"
import { Scheduler } from "@/scheduler"
import { createRightSidebarConversationSession } from "@/chat/session"
import { declareNativeTaskProcessDeployment } from "@/runtime/task-process-deployment"
import {
  createContinuousGoal,
  latestGoalContinuation,
  readContinuousGoal,
  resolveGoalOwner,
} from "@/continuous-goal/store"
import {
  goalContinuationIdentity,
  initializeContinuousGoals,
  projectGoalExecutionCandidates,
  reconcileContinuousGoal,
} from "@/continuous-goal/controller"
import { publishJSONBarrier } from "./json-barrier"

const [mode, directory, barriers, apiURL] = process.argv.slice(2)
if (!mode || !directory || !barriers || !apiURL)
  throw new Error("Goal runtime worker requires mode, project, barriers and provider")
declareNativeTaskProcessDeployment()
const model = { providerID: "goal-runtime-contract", modelID: "controlled-stream" }
const holdDeadline = Date.now() + 90_000
try {
  const result = await Instance.provide({
    directory,
    fn: async () => {
      await Config.updateProjectPatch({
        model: `${model.providerID}/${model.modelID}`,
        small_model: `${model.providerID}/goal-runtime-memory`,
        permission_mode: "full_access",
        provider: {
          [model.providerID]: {
            name: "Local goal runtime contract",
            npm: "@ai-sdk/openai-compatible",
            api: apiURL,
            models: {
              "goal-runtime-memory": {
                name: "Controlled memory stream",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 1_000_000, output: 4096 },
              },
              [model.modelID]: {
                name: "Controlled stream",
                tool_call: true,
                modalities: { input: ["text"], output: ["text"] },
                limit: { context: 1_000_000, output: 4096 },
              },
            },
          },
        },
      })
      await Auth.set(model.providerID, { type: "api", key: "local-controlled-provider" })
      if (mode === "start") {
        const session = await createRightSidebarConversationSession("chat")
        const owner = resolveGoalOwner({ kind: "chat", id: session.id })
        const created = createContinuousGoal(
          owner,
          { requestID: "runtime-create", objective: "Return one visible streamed response", turnBudget: 1 },
          "user",
        )
        const outcome = await reconcileContinuousGoal(owner)
        const request = latestGoalContinuation(owner)!
        await publishJSONBarrier(path.join(barriers, "ready.json"), {
          sessionID: session.id,
          goalID: created.id,
          requestID: request.id,
          messageID: goalContinuationIdentity(request).messageID,
          outcome,
        })
        while (Date.now() < holdDeadline) await Bun.sleep(50)
        throw new Error("Owning test did not interrupt its private process")
      }
      const start = JSON.parse(await fs.readFile(path.join(barriers, "ready.json"), "utf8"))
      const owner = resolveGoalOwner({ kind: "chat", id: start.sessionID })
      const recoveryCandidates = await projectGoalExecutionCandidates()
      await publishJSONBarrier(path.join(barriers, "recover-entered.json"), { goal: readContinuousGoal(owner) })
      initializeContinuousGoals()
      await publishJSONBarrier(path.join(barriers, "recovering.json"), { driver: "continuous-goal.reconcile" })
      let lastActivity = Date.now()
      let priorMessages = ""
      for (;;) {
        const messages = await Session.messages({ sessionID: start.sessionID })
        const activity = JSON.stringify(messages)
        if (activity !== priorMessages) {
          priorMessages = activity
          lastActivity = Date.now()
        }
        const replies = messages.filter(
          (message) =>
            message.info.role === "assistant" &&
            message.info.parentID === start.messageID &&
            message.info.finish === "stop" &&
            message.info.time.completed !== undefined,
        )
        if (replies.length && !SessionPromptOwner.activeExecution(start.sessionID)) {
          await SessionPromptState.release(start.sessionID, directory)
          return {
            recoveryDriver: "continuous-goal.reconcile",
            recoveryCandidates,
            goal: readContinuousGoal(owner),
            request: latestGoalContinuation(owner),
            controllerInputs: messages
              .filter((message) => message.info.role === "user" && message.info.author === "goal-controller")
              .map((message) => message.info.id),
            replies: replies.map((message) => ({
              id: message.info.id,
              parentID: message.info.role === "assistant" ? message.info.parentID : undefined,
              text: message.parts
                .filter((part) => part.type === "text")
                .map((part) => part.text)
                .join("\n"),
            })),
          }
        }
        if (Date.now() - lastActivity > 90_000) {
          await publishJSONBarrier(path.join(barriers, "recover-timeout.json"), {
            goal: readContinuousGoal(owner),
            messages: messages.map((message) => message.info),
          })
          throw new Error("Goal restart made no message progress for90s")
        }
        await Bun.sleep(25)
      }
    },
  })
  await publishJSONBarrier(path.join(barriers, "result.json"), result)
  console.log("[goal-runtime-result]" + JSON.stringify(result))
} catch (error) {
  await publishJSONBarrier(path.join(barriers, "error.json"), {
    error: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  })
  throw error
} finally {
  await Scheduler.disposeGlobal()
  await Instance.disposeAll()
  Database.close()
}
