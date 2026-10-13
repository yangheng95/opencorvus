import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PassThrough } from "node:stream"
import { finished } from "node:stream/promises"
import { ProcessOutputLimitError } from "@opencorvus-ai/util/process"
import { resolveSessionExecutionAuthority } from "../../src/engine/task-session-lineage"
import { prepareTaskProcessBinding } from "../../src/engine/task-execution-capsule-binding"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { ProcessSupervisor } from "../../src/shell/process-supervisor"
import { SEARCH_CODE_MAX_OUTPUT_BYTES, SearchCodeExecutionError, SearchCodeTool } from "../../src/tool/grep"
import { Tool } from "../../src/tool/tool"
import { Ripgrep } from "../../src/file/ripgrep"
import { persistEstablishedTask as persistTask } from "../fixture/engine-task"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(async () => {
  await resetMemoryDatabase()
})

async function conversationContext(session: Session.Info): Promise<Tool.Context> {
  const executionAuthority = await resolveSessionExecutionAuthority({
    sessionID: session.id,
    projectID: Instance.project.id,
    expected: { kind: "conversation" },
  })
  return {
    sessionID: session.id,
    messageID: "message_search_code_bounded_execution",
    callID: "tool_search_code_bounded_execution",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    executionAuthority,
    executionSurface: Tool.executionSurface(["search_code"], []),
    metadata() {},
  }
}

async function taskContext(projectPath: string): Promise<Tool.Context> {
  const taskSession = Session.prepareRootNext({
    kind: "root",
    title: "Bounded search Task root",
    directory: projectPath,
  })
  const taskID = Identifier.ascending("task")
  const packageRevision = {
    scope: "built_in" as const,
    projectID: null,
    namespace: "builtin",
    id: "base",
    version: "2026.08.26.1",
    packageDigest: "b".repeat(64),
  }
  const now = Date.now()
  persistTask({
    taskID,
    rootSession: taskSession,
    now,
    title: "Bounded search Task",
    request: "Verify bounded search execution",
    productPillar: "code",
    metadata: {},
    projectID: Instance.project.id,
    packageRevision,
    executionCapsuleBinding: await prepareTaskProcessBinding({
      mode: "native",
      taskID,
      projectID: Instance.project.id,
      rootDirectory: projectPath,
      packageRevisionSHA256: packageRevision.packageDigest,
      timeCreated: now,
    }),
  })
  const workerSession = await Session.create({
    kind: "assistant",
    title: "Bounded search Task worker",
    parentID: taskSession.id,
  })
  const executionAuthority = await resolveSessionExecutionAuthority({
    sessionID: workerSession.id,
    projectID: Instance.project.id,
    expected: { kind: "task", taskID },
  })
  return {
    sessionID: workerSession.id,
    messageID: "message_search_code_task_bounded_execution",
    callID: "tool_search_code_task_bounded_execution",
    agent: "coding",
    abort: new AbortController().signal,
    messages: [],
    executionAuthority,
    executionSurface: Tool.executionSurface(["search_code"], []),
    metadata() {},
  }
}

function completedHandle(input: {
  pid: number
  code: number
  stdoutText: string
  stderrText: string
  onSettled?: () => void
}): ProcessSupervisor.Handle {
  const stdout = new PassThrough()
  const stderr = new PassThrough()
  let resolveExit!: (code: number) => void
  const exited = new Promise<number>((resolve) => (resolveExit = resolve))
  const outputSettled = Promise.allSettled([finished(stdout, { cleanup: true }), finished(stderr, { cleanup: true })]).then((outcomes) => {
    const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : [])
    if (failures.length) throw ProcessSupervisor.combineFailures("Fixture output delivery failed", failures)
  })
  const settled = Promise.allSettled([exited, outputSettled]).then((outcomes) => {
    input.onSettled?.()
    const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : [])
    if (failures.length) throw ProcessSupervisor.combineFailures("Fixture process settlement failed", failures)
  })
  void outputSettled.catch(() => undefined)
  void settled.catch(() => undefined)
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    stdout.end(input.stdoutText)
    stderr.end(input.stderrText)
    resolveExit(input.code)
  }
  setTimeout(close, 0)
  return {
    pid: input.pid,
    stdin: new PassThrough(),
    stdout,
    stderr,
    exited,
    terminalFact: exited.then((exitCode) => ({ exitCode, signal: null })),
    outputSettled,
    settled,
    async terminate() {
      close()
    },
    async dispose() {
      close()
    },
    unref() {},
  }
}

function matchOutput(filename: string, text: string): string {
  return JSON.stringify({ type: "match", data: {
    path: { text: filename }, lines: { text: `${text}\n` }, line_number: 1, absolute_offset: 0,
    submatches: [],
  } }) + "\n"
}

function expectedSearchSource(filename: string, line: number, snippet: string, startColumn?: number) {
  return {
    type: "source-file" as const, sourceId: expect.any(String), path: filename, title: path.basename(filename),
    range: { startLine: line, endLine: line, ...(startColumn === undefined ? {} : { startColumn }) }, provider: "opencorvus-search-code", snippet,
  }
}

describe("search_code bounded execution", () => {
  test.each([
    { name: "unicode", bytes: Buffer.from("before中😀NEEDLE"), pattern: "NEEDLE", line: 1, column: 10 },
    { name: "invalid-prefix", bytes: Buffer.concat([Buffer.from([255, 255]), Buffer.from("中😀NEEDLE")]), pattern: "NEEDLE", line: 1, column: 6 },
    { name: "inside-codepoint", bytes: Buffer.from("beforeé suffix"), pattern: "(?-u:\\xA9)", line: 1, column: 7 },
    { name: "inside-replacement", bytes: Buffer.concat([Buffer.from("before"), Buffer.from([0xe1, 0x80]), Buffer.from(" suffix")]), pattern: "(?-u:\\x80)", line: 1, column: 7 },
    { name: "crlf", bytes: Buffer.from("header\r\nbefore中😀NEEDLE\r\n"), pattern: "NEEDLE", line: 2, column: 10 },
    { name: "cr", bytes: Buffer.from("header\rprefix\rbefore中😀NEEDLE\rtail"), pattern: "NEEDLE", line: 3, column: 10 },
    { name: "mixed-prefix", bytes: Buffer.from("a\rb\nc\rd\r\nbefore中😀NEEDLE\n"), pattern: "NEEDLE", line: 5, column: 10 },
    { name: "utf8-bom", bytes: Buffer.from("\uFEFFbefore中😀NEEDLE\n"), pattern: "NEEDLE", line: 1, column: 11 },
  ])("publishes the displayed character column of a real $name match", async ({ name, bytes, pattern, line, column }) => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, `${name}.md`)
      await fs.writeFile(filename, bytes)
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Exact source column" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern, path: filename }, context))
      expect(result.sources).toEqual([{
        type: "source-file", sourceId: expect.any(String), path: filename, title: path.basename(filename),
        range: { startLine: line, endLine: line, startColumn: column }, provider: "opencorvus-search-code",
        snippet: expect.any(String),
      }])
    } })
  })

  test("publishes each real matching CR line from one ripgrep record", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "cr-matches.txt")
      await fs.writeFile(filename, "header\r前😀NEEDLE_A\rbetween\r次NEEDLE_B\rtail")
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "CR source lines" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "NEEDLE_", path: filename }, context))
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 2 matches\n${filename}:\n  Line 2: 前😀NEEDLE_A\n  Line 4: 次NEEDLE_B`,
        sources: [expectedSearchSource(filename, 2, "前😀NEEDLE_A", 4), expectedSearchSource(filename, 4, "次NEEDLE_B", 2)],
      })
    } })
  })

  test("publishes a real regex spanning CR as its complete logical line range", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "cr-range.txt")
      await fs.writeFile(filename, "header\rBEGIN372\rEND372\rtail")
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "CR source range" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "BEGIN372\\rEND372", path: filename }, context))
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Lines 2-3: BEGIN372\nEND372`,
        sources: [{ ...expectedSearchSource(filename, 2, "BEGIN372\nEND372"), range: { startLine: 2, endLine: 3 } }],
      })
    } })
  })

  test.each(["conversation", "task"] as const)("projects unmatched CR prefix lines under real %s authority", async (kind) => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "prefix-lines.txt")
      await fs.writeFile(filename, "a\r\rb\nc\rd\r\n前😀NEEDLE\n")
      const context = kind === "task" ? await taskContext(project.path)
        : await conversationContext(await Session.create({ kind: "assistant", title: "Source line authority" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "NEEDLE", path: filename }, context))
      expect(result.sources).toEqual([expectedSearchSource(filename, 6, "前😀NEEDLE", 4)])
    } })
  })

  test("retains the complete CR record range for a real zero-width match without a span", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "cr-empty-span.txt")
      await fs.writeFile(filename, "header\ra\rb\rtail")
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Source record range" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "$", path: filename }, context))
      expect(result.sources).toEqual([{ ...expectedSearchSource(filename, 1, "header\na\nb\ntail"), range: { startLine: 1, endLine: 4 } }])
    } })
  })

  test.each(["conversation", "task"] as const)("settles a real %s line-boundary scan within the shared output budget", async (kind) => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "large-prefix.txt")
      await fs.writeFile(filename, "x\r".repeat(250_000) + "tail\nNEEDLE\n")
      const context = kind === "task" ? await taskContext(project.path)
        : await conversationContext(await Session.create({ kind: "assistant", title: "Bounded line facts" }))
      const liveBefore = ProcessSupervisor.metricsSnapshot().live
      let observed: unknown
      try { await SearchCodeTool.init().then(tool => tool.execute({ pattern: "NEEDLE", path: filename }, context)) }
      catch (error) { observed = error }
      const limitError = observed instanceof SearchCodeExecutionError && observed.cause instanceof Error ? observed.cause.cause : undefined
      if (!(limitError instanceof ProcessOutputLimitError)) throw observed ?? new Error("Expected line-boundary output-limit receipt")
      const bytes = limitError.result.stdout.byteLength + limitError.result.stderr.byteLength
      console.info("real line-boundary budget receipt", JSON.stringify({ kind, receipt: limitError.result.receipt, bytes }))
      expect({ code: (observed as SearchCodeExecutionError).code, reason: limitError.result.receipt.reason, live: ProcessSupervisor.metricsSnapshot().live }).toEqual({
        code: "SEARCH_CODE_EXECUTION_FAILED", reason: "output_limit", live: liveBefore,
      })
      expect(bytes).toBeGreaterThan(0)
      expect(bytes).toBeLessThan(SEARCH_CODE_MAX_OUTPUT_BYTES)
    } })
  }, 30_000)

  test("previews a late real regex match with complete Unicode window boundaries", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "late-unicode-match.md")
      const contextText = "😀" + "文".repeat(39)
      await fs.writeFile(filename, "p".repeat(2400) + contextText + "MATCH366" + "后".repeat(1950) + "😀 tail\n")
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Late regex match" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "MATCH[0-9]+", path: filename }, context))
      const preview = "..." + contextText + "MATCH366" + "后".repeat(1950) + "..."
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 2442)],
      })
    } })
  })

  test("locates a late match from original invalid UTF-8 bytes before displaying its text", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "late-byte-match.md")
      const tail = "界".repeat(40) + "MATCH366  after"
      await fs.writeFile(filename, Buffer.concat([Buffer.alloc(2400, 255), Buffer.from(tail)]))
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Late byte match" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "MATCH366", path: filename }, context))
      const preview = "..." + tail
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 2441)],
      })
    } })
  })

  test("preserves bounded line context when a real zero-width search reports no submatch span", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "line-end-match.md")
      await fs.writeFile(filename, "begin" + "文".repeat(2500))
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Line end match" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "$", path: filename }, context))
      const preview = "begin" + "文".repeat(1995) + "..."
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview)],
      })
    } })
  })

  test("represents a late match inside a complete inline payload with its omission marker", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "payload-window.md")
      await fs.writeFile(filename, "data:text/plain;base64," + "A".repeat(3000) + "TUFUQ0gzNjY=")
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Payload match window" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "TUFUQ0gzNjY", path: filename }, context))
      const preview = "inline_binary_omitted(kind=data_url offset=0 media=text/plain payload_chars=3012)"
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 3024)],
      })
    } })
  })

  test("keeps a real late match aligned after an earlier payload is redacted", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "match-after-payload.md")
      const tail = "文".repeat(40) + "MATCH366末尾"
      await fs.writeFile(filename, "d".repeat(2300) + " data:text/plain;base64,YQ== " + tail)
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Match after payload" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "MATCH366", path: filename }, context))
      const preview = "..." + tail
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 2370)],
      })
    } })
  })

  test("publishes one safe preview when cropping exposes a binary signature in a base64 token", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "cropped-binary-token.md")
      const header = Buffer.from("%PDF-1.7\n" + "x".repeat(21)).toString("base64")
      await fs.writeFile(filename, "YWJj".repeat(600) + header + "MATCH366" + "YWFh".repeat(600))
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Safe cropped token" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: "MATCH366", path: filename }, context))
      const preview = "...inline_binary_omitted(kind=raw_base64 offset=3 reason=binary_magic payload_chars=2000)..."
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 2441)],
      })
    } })
  })

  test("publishes the same complete-character bounded line in tool output and source preview", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "unicode-preview.md")
      const marker = "preview-364"
      const prefix = marker + "文".repeat(1999 - marker.length)
      await fs.writeFile(filename, `${prefix}😀 tail\n`)
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Unicode source preview" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: marker, path: filename }, context))
      const preview = `${prefix}...`
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 1)],
      })
    } })
  })

  test("publishes the sanitized matching line as the durable source preview", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "payload-preview.md")
      const marker = "preview-364"
      await fs.writeFile(filename, `${marker} data:text/plain;base64,YQ== tail\n`)
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Safe source preview" }))
      const result = await SearchCodeTool.init().then(tool => tool.execute({ pattern: marker, path: filename }, context))
      const preview = `${marker} inline_binary_omitted(kind=data_url offset=12 media=text/plain payload_chars=4) tail`
      expect({ output: result.output, sources: result.sources }).toEqual({
        output: `Found 1 matches\n${filename}:\n  Line 1: ${preview}`,
        sources: [expectedSearchSource(filename, 1, preview, 1)],
      })
    } })
  })

  test("preserves Unicode paths and the exact trailing whitespace of a real final matching line", async () => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "  检索 [sample].txt")
      const marker = "search-code-exact-line-318"
      const line = `${marker} | value  \t  `
      await fs.writeFile(filename, `header\r\n${line}\r\n`)
      const session = await Session.create({ kind: "assistant", title: "Exact search result text" })
      const context = await conversationContext(session)
      const result = await SearchCodeTool.init().then((tool) => tool.execute({ pattern: marker, path: filename }, context))
      expect(result).toEqual({
        title: marker, metadata: { matches: 1, truncated: false },
        output: `Found 1 matches\n${filename}:\n  Line 2: ${line}`,
        sources: [expectedSearchSource(filename, 2, line, 1)],
      })
    } })
  })

  test.each([3, 125])("publishes precise sources for the displayed lines of a real %s-match search", async (count) => {
    await using project = await memoryProject()
    await Instance.provide({ directory: project.path, fn: async () => {
      const filename = path.join(project.path, "  来源 [lines].txt")
      await fs.writeFile(filename, "heading\n" + Array.from({ length: count }, (_, index) => `source-lines-319 ${index}\nspacer\n`).join(""))
      const context = await conversationContext(await Session.create({ kind: "assistant", title: "Search source line bounds" }))
      const result = await SearchCodeTool.init().then((tool) => tool.execute({ pattern: "source-lines-319", path: filename }, context))
      const shown = Math.min(count, 100)
      expect({ metadata: result.metadata, sources: result.sources }).toEqual({
        metadata: { matches: count, truncated: count > 100 },
        sources: Array.from({ length: shown }, (_, index) => expectedSearchSource(filename, 2 + index * 2, `source-lines-319 ${index}`, 1)),
      })
    } })
  })

  test("keeps repository ignore boundaries when include is broad", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const marker = "search-code-visible-contract-20260826"
        const visible = path.join(project.path, "visible.ts")
        const ignored = path.join(project.path, "ignored", "decoy.ts")
        const gitMetadata = path.join(project.path, ".git", "objects", "search-code-decoy.ts")
        await fs.mkdir(path.dirname(ignored), { recursive: true })
        await fs.mkdir(path.dirname(gitMetadata), { recursive: true })
        await Promise.all([
          fs.writeFile(path.join(project.path, ".ignore"), "ignored/\n"),
          fs.writeFile(visible, `${marker}\n`),
          fs.writeFile(ignored, `${marker}\n`),
          fs.writeFile(gitMetadata, `${marker}\n`),
        ])
        const context = await taskContext(project.path)

        const result = await SearchCodeTool.init().then((tool) =>
          tool.execute({ pattern: marker, path: project.path, include: "*" }, context),
        )

        expect(result).toEqual({
          title: marker,
          metadata: { matches: 1, truncated: false },
          output: [`Found 1 matches`, `${visible}:`, `  Line 1: ${marker}`].join("\n"),
          sources: [expectedSearchSource(visible, 1, marker, 1)],
        })
      },
    })
  })

  test("filters ignored-aware candidates before narrow content searches consume the shared output budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const marker = "search-code-narrow-contract-20260826"
        const rootTypeScript = path.join(project.path, "root.ts")
        const nestedTypeScript = path.join(project.path, "src", "nested.ts")
        const largeJavaScript = path.join(project.path, "large.js")
        await fs.mkdir(path.dirname(nestedTypeScript), { recursive: true })
        await Promise.all([
          fs.writeFile(rootTypeScript, `${marker}\n`),
          fs.writeFile(nestedTypeScript, `${marker}\n`),
          fs.writeFile(
            largeJavaScript,
            `${marker}\n`.repeat(Math.ceil((SEARCH_CODE_MAX_OUTPUT_BYTES + 1) / (marker.length + 1))),
          ),
        ])
        await fs.utimes(rootTypeScript, new Date("2026-08-26T00:00:00Z"), new Date("2026-08-26T00:00:00Z"))
        await fs.utimes(nestedTypeScript, new Date("2026-08-26T00:01:00Z"), new Date("2026-08-26T00:01:00Z"))
        const session = await Session.create({ kind: "assistant", title: "Narrow search candidate contract" })
        const context = await conversationContext(session)
        const tool = await SearchCodeTool.init()

        const allTypeScript = await tool.execute({ pattern: marker, path: project.path, include: "*.ts" }, context)
        const nestedTypeScriptOnly = await tool.execute(
          { pattern: marker, path: project.path, include: "src/*.ts" },
          context,
        )

        expect({ allTypeScript, nestedTypeScriptOnly }).toEqual({
          allTypeScript: {
            title: marker,
            metadata: { matches: 2, truncated: false },
            output: [
              `Found 2 matches`,
              `${nestedTypeScript}:`,
              `  Line 1: ${marker}`,
              "",
              `${rootTypeScript}:`,
              `  Line 1: ${marker}`,
            ].join("\n"),
            sources: [expectedSearchSource(nestedTypeScript, 1, marker, 1), expectedSearchSource(rootTypeScript, 1, marker, 1)],
          },
          nestedTypeScriptOnly: {
            title: marker,
            metadata: { matches: 1, truncated: false },
            output: [`Found 1 matches`, `${nestedTypeScript}:`, `  Line 1: ${marker}`].join("\n"),
            sources: [expectedSearchSource(nestedTypeScript, 1, marker, 1)],
          },
        })
      },
    })
  })

  test("preserves partial enumeration results across argument batches under one deadline and output budget", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const marker = "search-code-batch-contract-20260826"
        const visible = path.join(project.path, "visible.ts")
        await fs.writeFile(visible, `${marker}\n`)
        const candidates = [visible]
        let candidateCharacters = visible.length + 3
        for (let index = 0; candidateCharacters < 30_000; index++) {
          const candidate = path.join(
            project.path,
            "generated",
            `${String(index).padStart(4, "0")}-${"x".repeat(120)}.ts`,
          )
          candidates.push(candidate)
          candidateCharacters += candidate.length + 3
        }
        const enumerationOutput = `${candidates.join("\0")}\0`
        const enumerationError = "one path was inaccessible\n"
        const contentOutput = matchOutput(visible, marker)
        const spawned: ProcessSupervisor.CommandSpawnOptions[] = []
        let settledCount = 0
        const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
          const callIndex = spawned.push(options) - 1
          return completedHandle({
            pid: 992000 + callIndex,
            code: callIndex === 0 ? 2 : callIndex === 1 ? 0 : 1,
            stdoutText: callIndex === 0 ? enumerationOutput : callIndex === 1 ? contentOutput : "",
            stderrText: callIndex === 0 ? enumerationError : "",
            onSettled: () => settledCount++,
          })
        })
        const session = await Session.create({ kind: "assistant", title: "Search batch budget contract" })
        const context = await conversationContext(session)
        try {
          const result = await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: marker, path: project.path, include: "*.ts" }, context),
          )
          const contentCalls = spawned.slice(1)

          expect({
            result,
            multipleContentBatches: contentCalls.length > 1,
            argumentBounds: contentCalls.map(
              (call) =>
                call.executable.length + call.args.reduce((total, value) => total + value.length + 3, 0) <= 12_000,
            ),
            owners: spawned.map((call) => call.owner),
            settledCount,
          }).toEqual({
            result: {
              title: marker,
              metadata: { matches: 1, truncated: false },
              output: [
                `Found 1 matches`,
                `${visible}:`,
                `  Line 1: ${marker}`,
                "",
                "(Some paths were inaccessible and skipped)",
              ].join("\n"),
              sources: [expectedSearchSource(visible, 1, marker)],
            },
            multipleContentBatches: true,
            argumentBounds: contentCalls.map(() => true),
            owners: spawned.map(() => "search-code"),
            settledCount: spawned.length,
          })
        } finally {
          restore()
        }
      },
    })
  })

  test("shares one retained-output budget across enumeration and successive content batches", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const visible = path.join(project.path, "visible.ts")
        await fs.writeFile(visible, "batch-budget\n")
        const candidates: string[] = [visible]
        let candidateCharacters = visible.length + 3
        for (let index = 0; candidateCharacters < 30_000; index++) {
          const candidate = path.join(
            project.path,
            "generated",
            `${String(index).padStart(4, "0")}-${"x".repeat(120)}.ts`,
          )
          candidates.push(candidate)
          candidateCharacters += candidate.length + 3
        }
        const enumerationOutput = `${candidates.join("\0")}\0`
        const remainingAfterEnumeration = SEARCH_CODE_MAX_OUTPUT_BYTES - Buffer.byteLength(enumerationOutput)
        const overhead = Buffer.byteLength(matchOutput(visible, "batch-budget "))
        const firstContentOutput = matchOutput(visible, `batch-budget ${"x".repeat(Math.floor(remainingAfterEnumeration / 2) - overhead)}`)
        const secondContentOutput = matchOutput(visible, `batch-budget ${"y".repeat(remainingAfterEnumeration - Buffer.byteLength(firstContentOutput) + 1 - overhead)}`)
        const spawned: ProcessSupervisor.CommandSpawnOptions[] = []
        const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
          const callIndex = spawned.push(options) - 1
          return completedHandle({
            pid: 993000 + callIndex,
            code: 0,
            stdoutText:
              callIndex === 0 ? enumerationOutput : callIndex === 1 ? firstContentOutput : secondContentOutput,
            stderrText: "",
          })
        })
        const session = await Session.create({ kind: "assistant", title: "Search shared output budget contract" })
        const context = await conversationContext(session)
        let observed: unknown
        try {
          await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: "batch-budget", path: project.path, include: "*.ts" }, context),
          )
        } catch (error) {
          observed = error
        } finally {
          restore()
        }

        expect({
          error:
            observed instanceof SearchCodeExecutionError
              ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
              : observed,
          calls: spawned.length,
          owners: spawned.map((call) => call.owner),
        }).toEqual({
          error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true },
          calls: 3,
          owners: spawned.map(() => "search-code"),
        })
      },
    })
  })

  test("returns a typed regex failure even when include selects no candidates", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Search regex validation contract" })
        const context = await conversationContext(session)
        let observed: unknown
        try {
          await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: "[", path: project.path, include: "*.missing" }, context),
          )
        } catch (error) {
          observed = error
        }

        expect(
          observed instanceof SearchCodeExecutionError
            ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
            : observed,
        ).toEqual({ name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true })
      },
    })
  })

  test("rejects include complexity that cannot be matched completely", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const session = await Session.create({ kind: "assistant", title: "Search include complexity contract" })
        const context = await conversationContext(session)
        const tool = await SearchCodeTool.init()
        const patterns = [
          `{${Array.from({ length: 257 }, (_, index) => `f${index}`).join(",")}}.ts`,
          `${Array.from({ length: 33 }, () => "**").join("/")}/*.ts`,
          "x".repeat(4097),
        ]
        const errors: Array<{ name: string; code: string; cause: boolean }> = []
        for (const include of patterns) {
          try {
            await tool.execute({ pattern: "include-complexity", path: project.path, include }, context)
          } catch (error) {
            if (error instanceof SearchCodeExecutionError) {
              errors.push({ name: error.name, code: error.code, cause: error.cause instanceof Error })
            }
          }
        }

        expect(errors).toEqual(
          patterns.map(() => ({
            name: "SearchCodeExecutionError",
            code: "SEARCH_CODE_EXECUTION_FAILED",
            cause: true,
          })),
        )
      },
    })
  })

  test("returns typed incomplete errors when partial enumeration cannot establish a match", async () => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        await Ripgrep.filepath()
        const session = await Session.create({ kind: "assistant", title: "Search partial zero-result contract" })
        const context = await conversationContext(session)
        const scenarios = [
          { candidate: path.join(project.path, "visible.js"), include: "*.ts" },
          { candidate: path.join(project.path, "visible.ts"), include: "*.ts" },
        ]
        const results: Array<{
          error: { name: string; code: string; cause: boolean } | unknown
          partialEnumerationFact: boolean
          calls: number
          owners: Array<string | undefined>
        }> = []
        for (let scenarioIndex = 0; scenarioIndex < scenarios.length; scenarioIndex++) {
          const scenario = scenarios[scenarioIndex]!
          const spawned: ProcessSupervisor.CommandSpawnOptions[] = []
          const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
            const callIndex = spawned.push(options) - 1
            return completedHandle({
              pid: 994000 + scenarioIndex * 10 + callIndex,
              code: callIndex === 0 ? 2 : 1,
              stdoutText: callIndex === 0 ? `${scenario.candidate}\0` : "",
              stderrText: callIndex === 0 ? "enumeration incomplete\n" : "",
            })
          })
          let observed: unknown
          try {
            await SearchCodeTool.init().then((tool) =>
              tool.execute({ pattern: "partial-zero", path: project.path, include: scenario.include }, context),
            )
          } catch (error) {
            observed = error
          } finally {
            restore()
          }
          results.push({
            error:
              observed instanceof SearchCodeExecutionError
                ? { name: observed.name, code: observed.code, cause: observed.cause instanceof Error }
                : observed,
            partialEnumerationFact:
              observed instanceof SearchCodeExecutionError &&
              observed.message.includes("enumeration incomplete") &&
              observed.cause instanceof Error &&
              observed.cause.message.includes("enumeration incomplete"),
            calls: spawned.length,
            owners: spawned.map((call) => call.owner),
          })
        }

        expect(results).toEqual(
          scenarios.map(() => ({
            error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED", cause: true },
            partialEnumerationFact: true,
            calls: 2,
            owners: ["search-code", "search-code"],
          })),
        )
      },
    })
  })

  test.each(["conversation", "task"] as const)("settles a real over-budget %s search with its output-limit receipt", async (kind) => {
    await using project = await memoryProject()
    await Instance.provide({
      directory: project.path,
      fn: async () => {
        const filename = path.join(project.path, "large-search.txt")
        const marker = "real-bounded-search-318"
        await fs.writeFile(filename, `${marker} ${"x".repeat(1000)}\n`.repeat(6000))
        const context = kind === "task"
          ? await taskContext(project.path)
          : await conversationContext(await Session.create({ kind: "assistant", title: "Real bounded search" }))
        const liveBefore = ProcessSupervisor.metricsSnapshot().live
        let observed: unknown
        try {
          await SearchCodeTool.init().then((tool) =>
            tool.execute({ pattern: marker, path: filename }, context),
          )
        } catch (error) {
          observed = error
        }
        const limitError = observed instanceof SearchCodeExecutionError && observed.cause instanceof Error
          ? observed.cause.cause : undefined
        if (!(limitError instanceof ProcessOutputLimitError)) throw observed ?? new Error("Expected actual output-limit receipt")
        console.info("real search budget receipt", JSON.stringify({ kind, receipt: limitError.result.receipt, bytes: limitError.result.stdout.byteLength + limitError.result.stderr.byteLength }))
        expect({
          error: { name: (observed as SearchCodeExecutionError).name, code: (observed as SearchCodeExecutionError).code },
          reason: limitError.result.receipt.reason,
          retainedBytes: limitError.result.stdout.byteLength + limitError.result.stderr.byteLength,
          authority: context.executionAuthority?.kind,
          liveProcesses: ProcessSupervisor.metricsSnapshot().live,
        }).toEqual({
          error: { name: "SearchCodeExecutionError", code: "SEARCH_CODE_EXECUTION_FAILED" },
          reason: "output_limit",
          retainedBytes: SEARCH_CODE_MAX_OUTPUT_BYTES,
          authority: kind,
          liveProcesses: liveBefore,
        })
      },
    })
  }, 30_000)
})
