import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionShell } from "@/session/shell-exec"
import { Database, eq } from "@/storage/db"
import { acquireControlLease, currentControlLease } from "@/engine/control-lease"
import { EngineControlActivationLeaseTable } from "@/engine/engine.sql"
import { currentRuntimeProcessOccurrence } from "@/runtime/process-occurrence"
import { Config } from "@/config/config"
import { Hono } from "hono"
import { PublicSessionExecutionTestHooks, SessionRoutes } from "@/server/routes/session"
import { serverErrorResponse } from "@/server/error-handler"
import { SessionPromptState } from "@/session/prompt/state"

const [mode, projectDirectory, barrierDirectory, sessionID, messageID, label, command] = process.argv.slice(2)
if (!mode || !projectDirectory || !barrierDirectory) {
  throw new Error("Session Message pair worker requires mode, project directory and barrier directory")
}

const model = { providerID: "session-pair-provider", modelID: "session-pair-model" }

async function run() {
  return Instance.provide({
    directory: projectDirectory,
    fn: async () => {
      if (mode === "init") {
        await Config.updateGlobalPatch({
          model: `${model.providerID}/${model.modelID}`,
          provider: {
            [model.providerID]: {
              name: "Session pair test provider",
              npm: "@ai-sdk/openai-compatible",
              api: "http://127.0.0.1:9/session-pair-model",
              models: {
                [model.modelID]: {
                  name: "Session pair test model",
                  tool_call: true,
                  modalities: { input: ["text"], output: ["text"] },
                  limit: { context: 1_000_000, output: 4_096 },
                },
              },
            },
          },
        })
        const session = await Session.create({ kind: "assistant", title: "Cross-process Message pair" })
        return { sessionID: session.id }
      }
      if (!sessionID || !messageID) throw new Error(`${mode} worker requires Session and Message identities`)
      if (mode === "inspect") {
        const messages = await Session.messages({ sessionID })
        const accepted = messages.filter(
          (message) => message.info.role === "assistant" && Message.acceptsInputMessage(message.info, messageID),
        )
        const tools = accepted
          .flatMap((message) => message.parts)
          .filter((part): part is Message.ToolPart => part.type === "tool")
        return {
          userCount: messages.filter((message) => message.info.id === messageID).length,
          assistantCount: accepted.length,
          toolCount: tools.length,
          ownedToolCount: tools.filter((tool) => SessionShell.processOwnership(tool) !== undefined).length,
          exactLeaseCount: tools.filter((tool) => {
            const ownership = SessionShell.processOwnership(tool)
            const lease = currentControlLease("session_shell", tool.id)
            return (
              ownership !== undefined &&
              lease?.id === ownership.leaseID &&
              lease.owner_occurrence_id === ownership.leaseOwnerOccurrenceID
            )
          }).length,
          shellLeaseRowCount: Database.use((db) =>
            db
              .select({ id: EngineControlActivationLeaseTable.id })
              .from(EngineControlActivationLeaseTable)
              .where(eq(EngineControlActivationLeaseTable.target, "session_shell"))
              .all(),
          ).length,
        }
      }
      if (mode === "standby") {
        const owner = SessionPromptState.start(sessionID, projectDirectory)
        if (!owner) throw new Error(`Session ${sessionID} standby worker did not acquire the Prompt owner`)
        await fs.writeFile(path.join(barrierDirectory, `${label}.ready`), "ready")
        while (!(await fs.stat(path.join(barrierDirectory, `${label}.release`)).catch(() => undefined))) {
          await Bun.sleep(5)
        }
        await SessionPromptState.release(sessionID, projectDirectory)
        return { result: "released", label }
      }
      if (
        (mode !== "claim" &&
          mode !== "route" &&
          mode !== "route-after-owner-snapshot" &&
          mode !== "route-after-shell-owner") ||
        !label
      ) {
        throw new Error(`Unknown Session Message pair worker mode: ${mode}`)
      }

      if (mode === "route-after-owner-snapshot") {
        PublicSessionExecutionTestHooks.afterInitialOwnerRead = async () => {
          await fs.writeFile(path.join(barrierDirectory, `${label}.snapshot`), "snapshot")
          while (!(await fs.stat(path.join(barrierDirectory, `${label}.continue`)).catch(() => undefined))) {
            await Bun.sleep(5)
          }
        }
        PublicSessionExecutionTestHooks.afterBusyBeforeConvergence = async () => {
          await fs.writeFile(path.join(barrierDirectory, `${label}.busy`), "busy")
        }
      }
      if (mode === "route-after-shell-owner") {
        SessionShell.TestHooks.afterPromptOwnerAcquired = async () => {
          await fs.writeFile(path.join(barrierDirectory, `${label}.shell-owner`), "owner")
          while (!(await fs.stat(path.join(barrierDirectory, `${label}.shell-owner.continue`)).catch(() => undefined))) {
            await Bun.sleep(5)
          }
        }
      }
      await fs.writeFile(path.join(barrierDirectory, `${label}.ready`), "ready")
      while (!(await fs.stat(path.join(barrierDirectory, "release")).catch(() => undefined))) await Bun.sleep(5)
      if (mode === "route" || mode === "route-after-owner-snapshot" || mode === "route-after-shell-owner") {
        if (!command) throw new Error("Session route worker requires a shell command")
        const app = new Hono().route("/session", SessionRoutes())
        app.onError(serverErrorResponse)
        const response = await app.fetch(
          new Request(`http://opencorvus.test/session/${sessionID}/shell`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messageID, agent: "chat", model, command }),
          }),
        )
        const body = (await response.json()) as any
        return {
          status: response.status,
          errorName: body.name,
          assistantID: body.info?.id,
          finish: body.info?.finish,
          toolState: body.parts?.[0]?.state?.status,
        }
      }
      const created = Date.now()
      const assistantID = Identifier.deterministic("message", `session-message-pair\0${label}`)
      const toolPartID = Identifier.deterministic("part", `session-message-pair-tool\0${label}`)
      const callID = Identifier.deterministic("call", `session-message-pair-call\0${label}`)
      const leaseID = Identifier.deterministic("call", `session-message-pair-lease\0${label}`)
      try {
        await Session.persistClaimedMessagePair({
          claim: {
            info: {
              id: messageID,
              sessionID,
              author: "user",
              time: { created },
              role: "user",
              agent: "chat",
              model,
            },
            parts: [
              {
                type: "text",
                id: Identifier.deterministic("part", `session-message-pair-input\0${label}`),
                messageID,
                sessionID,
                text: "Cross-process input occurrence",
              },
            ],
          },
          dependent: {
            info: {
              id: assistantID,
              sessionID,
              author: "chat",
              parentID: messageID,
              acceptedInputMessageIDs: [messageID],
              agent: "chat",
              cost: 0,
              path: { cwd: projectDirectory, root: projectDirectory },
              time: { created },
              role: "assistant",
              tokens: { total: 0, input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
              modelID: model.modelID,
              providerID: model.providerID,
            },
            parts: [
              {
                type: "tool",
                id: toolPartID,
                messageID: assistantID,
                sessionID,
                tool: "bash",
                callID,
                metadata: SessionShell.processOwnershipMetadata(currentRuntimeProcessOccurrence(), {
                  leaseID,
                  ownerOccurrenceID: callID,
                }),
                state: {
                  status: "running",
                  input: { command: "echo pair" },
                  time: { start: created },
                },
              },
            ],
          },
          commit: () => {
            const acquired = acquireControlLease({
              target: "session_shell",
              targetID: toolPartID,
              leaseID,
              ownerOccurrenceID: callID,
              now: Date.now(),
              leaseMilliseconds: 30_000,
            })
            if (!acquired.acquired) throw new Error(`Could not acquire exact shell lease for ${label}`)
          },
        })
        return { result: "claimed", label }
      } catch (error) {
        if (error instanceof Session.MessageOccurrenceClaimConflictError) return { result: "conflict", label }
        throw error
      }
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
