import fs from "node:fs/promises"
import fsSync from "node:fs"
import path from "node:path"
import { Config } from "@/config/config"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { serverErrorResponse } from "@/server/error-handler"
import { SessionRoutes } from "@/server/routes/session"
import { Session } from "@/session"
import { SessionPromptOwner } from "@/session/prompt/owner"
import { SessionLoop } from "@/session/loop"
import { Database } from "@/storage/db"
import { observeRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Hono } from "hono"

const [mode, projectDirectory, barrierDirectory, sessionID, messageID, label, apiURL, text, hold, ownerObservation] =
  process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory) {
  throw new Error("Session prompt owner worker requires mode, project directory and barrier directory")
}

const model = { providerID: "session-prompt-owner-provider", modelID: "session-prompt-owner-model" }

async function run() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      if (mode === "init" || mode === "init-history" || mode === "init-source-only") {
        if (!apiURL) throw new Error("Session prompt owner init requires an API URL")
        await Config.updateGlobalPatch({
          model: `${model.providerID}/${model.modelID}`,
          provider: {
            [model.providerID]: {
              name: "Session prompt owner test provider",
              npm: "@ai-sdk/openai-compatible",
              api: apiURL,
              models: {
                [model.modelID]: {
                  name: "Session prompt owner test model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })
        const session = await Session.create({ kind: "assistant", title: "Cross-process prompt owner" })
        if (mode === "init-history" || mode === "init-source-only") {
          const created = Date.now()
          const userMessageID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: userMessageID,
              sessionID: session.id,
              role: "user",
              author: "user",
              time: { created },
              agent: "chat",
              model,
            },
            parts: [
              {
                id: Identifier.ascending("part"),
                sessionID: session.id,
                messageID: userMessageID,
                type: "text",
                text:
                  mode === "init-source-only"
                    ? "A sole source message has no prior compactable material"
                    : "Durable history before the cross-process request",
              },
            ],
          })
          if (mode === "init-source-only") return { sessionID: session.id, messageID: userMessageID }
          const assistantMessageID = Identifier.ascending("message")
          await Session.persistMessage({
            info: {
              id: assistantMessageID,
              sessionID: session.id,
              parentID: userMessageID,
              acceptedInputMessageIDs: [userMessageID],
              role: "assistant",
              author: "chat",
              time: { created: created + 1, completed: created + 2 },
              agent: "chat",
              providerID: model.providerID,
              modelID: model.modelID,
              path: { cwd: projectDirectory, root: projectDirectory },
              cost: 0,
              tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
              finish: "stop",
            },
            parts: [
              {
                id: Identifier.ascending("part"),
                sessionID: session.id,
                messageID: assistantMessageID,
                type: "text",
                text: "Durable assistant history before the cross-process request",
              },
            ],
          })
        }
        return { sessionID: session.id }
      }
      if (!sessionID || !messageID || !label) throw new Error(`${mode} requires Session, Message and label`)
      if (mode === "inspect") {
        const owner = SessionPromptOwner.current(sessionID)
        const messages = await Session.messages({ sessionID })
        return {
          owner: owner
            ? {
                generation: owner.generation,
                pid: owner.owner_pid,
                occurrenceID: owner.owner_occurrence_id,
                observation: SessionPromptOwner.observation(owner),
              }
            : undefined,
          messages: messages.map((message) => ({
            id: message.info.id,
            role: message.info.role,
            parentID: message.info.role === "assistant" ? message.info.parentID : undefined,
            accepted: message.info.role === "assistant" ? message.info.acceptedInputMessageIDs : undefined,
            finish: message.info.role === "assistant" ? message.info.finish : undefined,
            summary: message.info.role === "assistant" ? message.info.summary : undefined,
            error: message.info.role === "assistant" ? message.info.error : undefined,
          })),
        }
      }
      if (mode !== "route" && mode !== "summarize" && mode !== "summarize-auto") {
        throw new Error(`Unknown Session prompt owner worker mode: ${mode}`)
      }

      const app = new Hono().route("/session", SessionRoutes())
      let standbyCount = 0
      let observationBlocked = false
      const observationCapture =
        ownerObservation === "block-once"
          ? SessionPromptOwner.TestHooks.installOwnerObservation((authority) => {
              if (!observationBlocked) {
                observationBlocked = true
                fsSync.writeFileSync(path.join(barrierDirectory, `${label}.owner-observation`), "observing")
                const gate = new Int32Array(new SharedArrayBuffer(4))
                while (!fsSync.existsSync(path.join(barrierDirectory, `${label}.owner-observation-release`))) {
                  Atomics.wait(gate, 0, 0, 25)
                }
              }
              return observeRuntimeProcessOccurrence({
                pid: authority.owner_pid,
                processInstanceID: authority.owner_process_instance_id,
                occurrenceID: authority.owner_occurrence_id,
              })
            })
          : undefined
      const standbyCapture = SessionLoop.TestHooks.installStandbyObserver(async (standbySessionID) => {
        if (standbySessionID !== sessionID) return
        standbyCount += 1
        await fs.writeFile(path.join(barrierDirectory, `${label}.standby`), "standby")
        await fs.writeFile(path.join(barrierDirectory, `${label}.standby-${standbyCount}`), "standby")
      })
      app.onError((error, context) => {
        void fs.writeFile(
          path.join(barrierDirectory, `${label}.route-error.txt`),
          error instanceof Error ? (error.stack ?? error.message) : String(error),
        )
        return serverErrorResponse(error, context)
      })
      await fs.writeFile(path.join(barrierDirectory, `${label}.ready`), "ready")
      while (!(await fs.stat(path.join(barrierDirectory, `${label}.start`)).catch(() => undefined))) {
        await Bun.sleep(10)
      }
      const response = await app.fetch(
        new Request(
          `http://opencorvus.test/session/${sessionID}/${mode.startsWith("summarize") ? "summarize" : "message"}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(
              mode.startsWith("summarize")
                ? { ...model, auto: mode === "summarize-auto", focus: text ?? label }
                : {
                    messageID,
                    model,
                    agent: "chat",
                    parts: [{ type: "text", text: text ?? label }],
                  },
            ),
          },
        ),
      )
      const body = (await response.json()) as any
      const result =
        mode.startsWith("summarize")
          ? response.ok
            ? { status: response.status, summarized: body }
            : {
                status: response.status,
                error: body.name,
                errorMessage: body.message,
                errorData: body.data,
              }
          : {
              status: response.status,
              assistantID: body.info?.id,
              parentID: body.info?.parentID,
              accepted: body.info?.acceptedInputMessageIDs,
              finish: body.info?.finish,
              error: body.name ?? body.info?.error?.name,
              errorMessage: body.message ?? body.info?.error?.data?.message,
              errorData: body.data,
            }
      await fs.writeFile(path.join(barrierDirectory, `${label}.response.json`), JSON.stringify(result))
      if (hold === "hold") {
        while (!(await fs.stat(path.join(barrierDirectory, `${label}.exit`)).catch(() => undefined))) {
          await Bun.sleep(10)
        }
      }
      standbyCapture[Symbol.dispose]()
      observationCapture?.[Symbol.dispose]()
      return result
    },
  })
}

try {
  const output = await run()
  await Instance.disposeAll()
  console.log(JSON.stringify(output))
  Database.close()
} catch (error) {
  console.error(error instanceof Error ? error.stack : String(error))
  process.exit(1)
}
