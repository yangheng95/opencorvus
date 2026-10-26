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
import { Config } from "@/config/config"

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
    if (!result.truncated) throw new Error("Truncated result with its full output path required")
    expect(await fs.readFile(result.outputPath, "utf8")).toBe(output)
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
    const outputs: Awaited<ReturnType<typeof SessionShell.shell>>[] = []
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
      const exits: number[] = []
      for (const exit of [7, 0]) {
        const result = await SessionShell.shell({
          sessionID: session.id, agent: "chat", model: { providerID: model.providerID, modelID: model.id }, command: `exit ${exit}`,
        })
        const part = result.parts.find((part): part is Message.ToolPart => part.type === "tool")
        if (!part || part.state.status !== "completed") throw new Error("Completed parallel shell result required")
        const observedExit = part.state.metadata.exit
        if (typeof observedExit !== "number") throw new Error("Observed numeric parallel shell exit required")
        exits.push(observedExit)
      }
      expect((await Session.get(session.id)).projectID).toBe(projectID)
      return { projectID, exits }
    },
  })))
  expect(results.map(result => result.exits)).toEqual([[7, 0], [7, 0]])
  expect(new Set(results.map(result => result.projectID)).size).toBe(2)
}, 30_000)

const python = Bun.which(process.platform === "win32" ? "python" : "python3")

test.skipIf(!python).each(["bash", "user-shell"] as const)(
  "a real %s command emits Unicode through the discovered Python standard streams",
  async (surface) => {
    await using project = await memoryProject()
    await fs.writeFile(path.join(project.path, "unicode-stdio.py"), [
      "import sys",
      "print('stdio:' + sys.stdout.encoding + '/' + sys.stderr.encoding, flush=True)",
      "print('中文输出🙂', flush=True)",
      "print('错误流完成🚀', file=sys.stderr, flush=True)",
    ].join("\n"), "utf8")
    await Instance.provide({ directory: project.path, fn: async () => {
      const command = `${JSON.stringify(python!.replaceAll("\\", "/"))} -u unicode-stdio.py`
      const result = surface === "bash"
        ? await (await BashTool.init()).execute({ command, description: "Real Unicode standard streams" }, await context())
        : await SessionShell.shell({
          sessionID: (await Session.create({ kind: "assistant", title: "Unicode user shell" })).id,
          agent: "chat", model: { providerID: model.providerID, modelID: model.id }, command,
        }).then(result => {
          const part = result.parts.find((part): part is Message.ToolPart => part.type === "tool")
          if (!part || part.state.status !== "completed") throw new Error("Completed Unicode user shell required")
          return { metadata: part.state.metadata, output: part.state.output }
        })
      expect(result.metadata.exit).toBe(0)
      expect(result.output).toContain("stdio:utf-8/utf-8")
      expect(result.output).toContain("中文输出🙂")
      expect(result.output).toContain("错误流完成🚀")
    } })
  }, 30_000,
)

test.skipIf(!python)("a project standard-stream override reaches the real Python child", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    await Config.updateProjectPatch({ local_environment: { name: "Explicit text environment", variables: { PYTHONIOENCODING: "ascii" } } })
    await fs.writeFile(path.join(project.path, "explicit-stdio.py"), "import sys\nprint('configured:' + sys.stdout.encoding)\n", "utf8")
    const result = await (await BashTool.init()).execute({
      command: `${JSON.stringify(python!.replaceAll("\\", "/"))} explicit-stdio.py`, description: "Real configured standard stream",
    }, await context())
    expect(result.metadata.exit).toBe(0)
    expect(result.output).toContain("configured:ascii")
  } })
}, 30_000)

test("a real user shell preserves split Unicode bytes independently across stdout and stderr", async () => {
  await using project = await memoryProject()
  await fs.writeFile(path.join(project.path, "split-stdio.cjs"), [
    "const streams = [[process.stdout, Buffer.from('中文🙂\\n')], [process.stderr, Buffer.from('错误🚀\\n')]];",
    "(async () => { for (let i = 0; streams.some(([, b]) => i < b.length); i++) {",
    "for (const [stream, bytes] of streams) if (i < bytes.length) { stream.write(bytes.subarray(i, i + 1)); await new Promise(r => setTimeout(r, 30)); }",
    "} })().catch(error => { console.error(error); process.exitCode = 1; });",
  ].join("\n"), "utf8")
  await Instance.provide({ directory: project.path, fn: async () => {
    const session = await Session.create({ kind: "assistant", title: "Split Unicode user shell" })
    const result = await SessionShell.shell({
      sessionID: session.id, agent: "chat", model: { providerID: model.providerID, modelID: model.id },
      command: `${JSON.stringify(process.execPath.replaceAll("\\", "/"))} split-stdio.cjs`,
    })
    const part = result.parts.find((part): part is Message.ToolPart => part.type === "tool")
    if (!part || part.state.status !== "completed") throw new Error("Completed split standard-stream result required")
    expect(part.state.metadata.exit).toBe(0)
    // Each stream's character order survives their deliberately interleaved bytes.
    expect([...part.state.output].filter(c => "中文🙂".includes(c)).join("")).toBe("中文🙂")
    expect([...part.state.output].filter(c => "错误🚀".includes(c)).join("")).toBe("错误🚀")
    const body = part.state.output.split("<bash_metadata>")[0]
    expect([...body].filter(c => c !== "\n" && c !== "\r").sort()).toEqual([..."中文🙂错误🚀"].sort())
    const stored = (await Session.messages({ sessionID: session.id })).flatMap(message => message.parts).find(row => row.id === part.id)
    expect(stored).toEqual(part)
  } })
}, 30_000)

test.skipIf(!python || process.platform !== "win32")("a Windows project encoding wins over the host with its actual case-insensitive name", async () => {
  await using project = await memoryProject()
  const previous = process.env.PYTHONIOENCODING
  process.env.PYTHONIOENCODING = "latin-1"
  try {
    await Instance.provide({ directory: project.path, fn: async () => {
      await Config.updateProjectPatch({ local_environment: { name: "Native text override", variables: { pythonioencoding: "ascii" } } })
      await fs.writeFile(path.join(project.path, "native-stdio.py"), "import sys\nprint('native:' + sys.stdout.encoding)\n", "utf8")
      const result = await (await BashTool.init()).execute({
        command: `${JSON.stringify(python!.replaceAll("\\", "/"))} native-stdio.py`, description: "Real native environment-name override",
      }, await context())
      expect(result.metadata.exit).toBe(0)
      expect(result.output).toContain("native:ascii")
    } })
  } finally {
    if (previous === undefined) delete process.env.PYTHONIOENCODING
    else process.env.PYTHONIOENCODING = previous
  }
}, 30_000)
