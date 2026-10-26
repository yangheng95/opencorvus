import { afterEach, expect, test } from "bun:test"
import { Hono } from "hono"
import fs from "node:fs/promises"
import path from "node:path"
import { Identifier } from "@/id/id"
import { ensureTaskMessageProtocolBridge } from "@/orchestrator/protocol/message-bridge"
import { Instance } from "@/project/instance"
import { ProtocolStore } from "@/protocol/store"
import { serverErrorResponse } from "@/server/error-handler"
import { SessionRoutes } from "@/server/routes/session"
import { Session } from "@/session"
import { SessionPrompt } from "@/session/prompt"
import { SessionShell } from "@/session/shell-exec"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterEach(resetMemoryDatabase)
const model = { providerID: "test", modelID: "real-user-shell-lifecycle" }

async function occurrenceView(sessionID: string, inputMessageID: string) {
  const app = new Hono().route("/session", SessionRoutes())
  app.onError(serverErrorResponse)
  const response = await app.request(`/session/${sessionID}/conversation`, {
    headers: { "x-opencorvus-directory": Instance.directory },
  })
  expect(response.status).toBe(200)
  const body = await response.json() as { agentView: { sessions: Array<{ inputMessageID: string; status: string }> } }
  return body.agentView.sessions.find((entry) => entry.inputMessageID === inputMessageID)
}

function lifecycle(sessionID: string, inputMessageID: string) {
  return ProtocolStore.latestSessionOccurrenceEvent(sessionID, "agent.execution.lifecycle", inputMessageID)?.payload?.status
}

test("successive real user commands publish completed occurrences with their actual final messages", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    ensureTaskMessageProtocolBridge()
    const session = await Session.create({ kind: "assistant", title: "Observed shell lifecycles" })
    const completed: Array<{ inputMessageID: string; finalMessageID: string; exit: number }> = []
    for (const exit of [7, 0]) {
      const messageID = Identifier.ascending("message")
      const command = `\n  echo "原始输入🙂"\nexit ${exit}\n`
      const result = await SessionShell.shell({ sessionID: session.id, messageID, agent: "chat", model, command })
      const originalInput = (await Session.messages({ sessionID: session.id })).find(message => message.info.id === messageID)
      expect(originalInput?.parts.filter(part => part.type === "text").map(part => part.text)).toEqual([command])
      completed.push({ inputMessageID: messageID, finalMessageID: result.info.id, exit })
      expect(await occurrenceView(session.id, messageID)).toMatchObject({ inputMessageID: messageID, status: "completed" })
      expect(lifecycle(session.id, messageID)).toEqual({ type: "terminal", reason: "completed", final_message_id: result.info.id })
    }
    expect(completed.map(({ inputMessageID }) => lifecycle(session.id, inputMessageID))).toEqual(
      completed.map(({ finalMessageID }) => ({ type: "terminal", reason: "completed", final_message_id: finalMessageID })),
    )
  } })
}, 30_000)

test("a real running user command publishes its exact occurrence and retains its operator-stop disposition", async () => {
  await using project = await memoryProject()
  await fs.writeFile(path.join(project.path, "owned-command.cjs"),
    "require('fs').writeFileSync('started.txt', 'ready'); console.log('COMMAND_READY'); setInterval(() => {}, 1000)\n")
  await Instance.provide({ directory: project.path, fn: async () => {
    ensureTaskMessageProtocolBridge()
    const session = await Session.create({ kind: "assistant", title: "Running shell lifecycle" })
    const messageID = Identifier.ascending("message")
    const execution = SessionShell.shell({ sessionID: session.id, messageID, agent: "chat", model,
      command: `${JSON.stringify(process.execPath.replaceAll("\\", "/"))} owned-command.cjs`,
    })
    try {
      const deadline = Date.now() + 10_000
      while ((await fs.readFile(path.join(project.path, "started.txt"), "utf8").catch(() => "")) !== "ready") {
        if (Date.now() >= deadline) throw new Error("Original command readiness deadline exceeded")
        await Bun.sleep(20)
      }
      expect(await occurrenceView(session.id, messageID)).toMatchObject({ inputMessageID: messageID, status: "running" })
      expect(lifecycle(session.id, messageID)).toEqual({ type: "streaming" })
    } finally {
      await SessionPrompt.cancel(session.id, project.path, {
        actor: "user", source: "session.abort", surface: "session.shell", requestID: "stop-owned-command",
        reason: "Operator stopped the original command", targetSessionID: session.id,
      })
      await execution
    }
    expect(await occurrenceView(session.id, messageID)).toMatchObject({ inputMessageID: messageID, status: "skipped" })
    expect(lifecycle(session.id, messageID)).toMatchObject({ type: "terminal", reason: "aborted" })
    const stopped = await execution
    expect(stopped.info).toMatchObject({
      role: "assistant", finish: "error", error: { name: "MessageAbortedError", data: {
        cancellation: { actor: "user", source: "session.abort", requestID: "stop-owned-command" },
      } },
    })
    expect(stopped.parts[0]).toMatchObject({ type: "tool", state: {
      status: "error", failure: { kind: "MessageAbortedError", name: "MessageAbortedError", data: {
        canonical_error_metadata: { cancellation: { actor: "user", source: "session.abort", requestID: "stop-owned-command" } },
      } }, metadata: { output: expect.stringContaining("COMMAND_READY"), exit: expect.any(Number) },
    } })
    const next = await SessionShell.shell({ sessionID: session.id, agent: "chat", model, command: "exit 0" })
    if (next.info.role !== "assistant") throw new Error("Next original shell assistant required")
    expect(lifecycle(session.id, next.info.parentID)).toMatchObject({ type: "terminal", reason: "completed", final_message_id: next.info.id })
    expect(lifecycle(session.id, messageID)).toMatchObject({ type: "terminal", reason: "aborted", final_message_id: stopped.info.id })
  } })
}, 30_000)

test("parallel Projects retain each completed user command's exact lifecycle", async () => {
  await using first = await memoryProject("shell-lifecycle-first")
  await using second = await memoryProject("shell-lifecycle-second")
  const results = await Promise.all([first, second].map(project => Instance.provide({ directory: project.path, fn: async () => {
    ensureTaskMessageProtocolBridge()
    const session = await Session.create({ kind: "assistant", title: "Independent shell lifecycle" })
    const result = await SessionShell.shell({ sessionID: session.id, agent: "chat", model, command: "exit 0" })
    if (result.info.role !== "assistant") throw new Error("Original shell assistant required")
    return { projectID: session.projectID, observed: lifecycle(session.id, result.info.parentID),
      expected: { type: "terminal", reason: "completed", final_message_id: result.info.id } }
  } })))
  expect(results.map(result => result.observed)).toEqual(results.map(result => result.expected))
  expect(new Set(results.map(result => result.projectID)).size).toBe(2)
}, 30_000)
