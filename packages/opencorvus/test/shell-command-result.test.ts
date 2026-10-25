import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { resolveSessionExecutionAuthority } from "@/engine/task-session-lineage"
import { Instance } from "@/project/instance"
import type { Provider } from "@/provider/provider"
import { Session } from "@/session"
import { Message } from "@/session/message"
import { SessionShell } from "@/session/shell-exec"
import { Shell } from "@/shell/shell"
import { shellResultOutput } from "@/shell/result"
import { BashTool } from "@/tool/bash"
import { Tool } from "@/tool/tool"
import { Truncate } from "@/tool/truncation"
import { memoryProject, resetMemoryDatabase } from "./fixture/memory"

afterAll(resetMemoryDatabase)

const model = {
  id: "shell-result-contract", providerID: "local-contract", name: "Shell result contract",
  api: { id: "shell-result-contract", npm: "@ai-sdk/anthropic" }, options: {},
  limit: { context: 100000, input: 90000, output: 4096 },
  cost: { available: true, input: 0, output: 0, cache: { read: 0, write: 0 } },
  capabilities: { toolcall: true, attachment: false, reasoning: false, temperature: true,
    input: { text: true, image: false, audio: false, video: false, pdf: false },
    output: { text: true, image: false, audio: false, video: false, pdf: false } },
} as Provider.Model

async function context(): Promise<Tool.Context> {
  const session = await Session.create({ kind: "assistant", title: "Real shell result" })
  return {
    sessionID: session.id, messageID: "msg_shell_result", callID: "call_shell_result", agent: "coding",
    abort: new AbortController().signal, messages: [], metadata() {},
    executionAuthority: await resolveSessionExecutionAuthority({
      sessionID: session.id, projectID: Instance.project.id, expected: { kind: "conversation" },
    }),
    executionSurface: Tool.executionSurface(["bash", "read"], []),
  }
}

function command(exit: number, shell: string): string {
  const separator = path.basename(shell).toLowerCase() === "cmd.exe" ? " & " : "; "
  return `echo COMMAND_RESULT_READY${separator}exit ${exit}`
}

test.each([0, 7])("real Bash exit %i reaches both structured result and model-visible body", async (exit) => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const result = await (await BashTool.init()).execute({
      command: command(exit, Shell.acceptable()), description: "Report actual command exit",
    }, await context())
    expect(result.metadata.exit).toBe(exit)
    expect(result.output).toContain("COMMAND_RESULT_READY")
    expect(result.output.endsWith(`<bash_metadata>\nexit code: ${exit}\n</bash_metadata>`)).toBe(true)
    expect(await Message.toolResultToModelOutput({ toolCallId: "call_shell_result", output: result }, model))
      .toEqual({ type: "text", value: result.output })
  } })
}, 30_000)

test("a real user shell persists its observed exit and the same visible result", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "User shell exit" })
    const result = await SessionShell.shell({
      sessionID: session.id, agent: "chat", model: { providerID: model.providerID, modelID: model.id },
      command: command(7, Shell.preferred()),
    })
    const part = result.parts.find((part): part is Message.ToolPart => part.type === "tool")!
    expect(part.state).toMatchObject({ status: "completed", metadata: { exit: 7 } })
    if (part.state.status !== "completed") throw new Error("Completed user shell result required")
    expect(part.state.output).toContain("COMMAND_RESULT_READY")
    expect(part.state.output.endsWith("<bash_metadata>\nexit code: 7\n</bash_metadata>")).toBe(true)
    const stored = (await Session.messages({ sessionID: session.id })).flatMap(message => message.parts).find(row => row.id === part.id)
    expect(stored).toEqual(part)
  } })
}, 30_000)

test("tail truncation retains the actual exit and a readable full result", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const ctx = await context(), output = shellResultOutput("诊断输出\n".repeat(Truncate.MAX_LINES + 100), 7)
    const result = await Truncate.output(output, {
      sessionID: ctx.sessionID, executionAuthority: ctx.executionAuthority,
    }, ctx.executionSurface)
    expect(result.truncated).toBe(true)
    expect(result.content.endsWith("<bash_metadata>\nexit code: 7\n</bash_metadata>")).toBe(true)
    expect(await fs.readFile(result.outputPath!, "utf8")).toBe(output)
  } })
}, 30_000)

test("an unavailable exit retains its explicit result and original lifecycle detail", () => {
  expect(shellResultOutput("", null, ["background command is running"]))
    .toBe("<bash_metadata>\nexit code: unavailable\nbackground command is running\n</bash_metadata>")
})

test("one Session accepts successive completed user shell occurrences", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Successive shell results" })
    const outputs = []
    for (const exit of [7, 0]) outputs.push(await SessionShell.shell({
      sessionID: session.id, agent: "chat", model: { providerID: model.providerID, modelID: model.id },
      command: command(exit, Shell.preferred()),
    }))
    expect(outputs.map(result => result.info)).toMatchObject([
      { role: "assistant", finish: "stop" }, { role: "assistant", finish: "stop" },
    ])
    const tools = (await Session.messages({ sessionID: session.id })).flatMap(message => message.parts)
      .filter((part): part is Message.ToolPart => part.type === "tool")
    expect(tools.map(part => part.state)).toMatchObject([
      { status: "completed", metadata: { exit: 7 } },
      { status: "completed", metadata: { exit: 0 } },
    ])
    expect(new Set(tools.map(part => part.id)).size).toBe(2)
  } })
}, 30_000)

test("a model-configuration error is followed by a successful explicit user shell", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Shell initialization retry" })
    const error = await SessionShell.shell({ sessionID: session.id, agent: "chat", command: "exit 7" })
      .then(() => undefined, error => error)
    expect(error?.name).toBe("MissingModelConfigError")
    const result = await SessionShell.shell({
      sessionID: session.id, agent: "chat", model: { providerID: model.providerID, modelID: model.id }, command: "exit 0",
    })
    expect(result.info).toMatchObject({ role: "assistant", finish: "stop" })
    expect(result.parts.find(part => part.type === "tool")?.state).toMatchObject({
      status: "completed", metadata: { exit: 0 },
    })
  } })
}, 30_000)

test("two Projects independently complete successive real user shells in parallel", async () => {
  await using first = await memoryProject("shell-isolation-first")
  await using second = await memoryProject("shell-isolation-second")
  const results = await Promise.all([first, second].map(project => Instance.provide({
    directory: project.path, fn: async () => {
      const projectID = Instance.project.id, session = await Session.create({ kind: "assistant", title: "Parallel shell" })
      const exits = []
      for (const exit of [7, 0]) {
        const result = await SessionShell.shell({
          sessionID: session.id, agent: "chat", model: { providerID: model.providerID, modelID: model.id }, command: `exit ${exit}`,
        })
        const part = result.parts.find((part): part is Message.ToolPart => part.type === "tool")
        if (!part || part.state.status !== "completed") throw new Error("Completed parallel shell result required")
        exits.push(part.state.metadata.exit)
      }
      expect((await Session.get(session.id)).projectID).toBe(projectID)
      return { projectID, exits }
    },
  })))
  expect(results.map(result => result.exits)).toEqual([[7, 0], [7, 0]])
  expect(new Set(results.map(result => result.projectID)).size).toBe(2)
}, 30_000)
