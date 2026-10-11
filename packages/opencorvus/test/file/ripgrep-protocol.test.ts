import { afterAll, expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { PassThrough } from "node:stream"
import { Ripgrep } from "../../src/file/ripgrep"
import { Instance } from "../../src/project/instance"
import { ProcessSupervisor } from "../../src/shell/process-supervisor"
import { memoryProject, resetMemoryDatabase } from "../fixture/memory"

afterAll(resetMemoryDatabase)

test("JSON file identities retain separators, line breaks and Unicode as one protocol field", () => {
  const expected = {
    path: { text: "search|目录\nquoted-\"name\".txt" }, lines: { text: "needle | value  \t  \n" }, line_number: 1, absolute_offset: 0,
    submatches: [{ match: { text: "needle" }, start: 0, end: 6 }],
  }
  expect(Ripgrep.parseSearchOutput(JSON.stringify({ type: "match", data: expected }))).toEqual([expected])
})

test("actual host search decodes byte-encoded line content while preserving its Unicode file identity", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const name = "  检索 [bytes].txt"
    await fs.writeFile(path.join(project.path, name), Buffer.concat([Buffer.from("needle "), Buffer.from([255]), Buffer.from("  \n")]))
    const matches = await Ripgrep.searchHost({ cwd: project.path, pattern: "needle" })
    expect(matches).toEqual([{
      path: { text: name }, lines: { text: "needle \uFFFD  \n" }, line_number: 1, absolute_offset: 0,
      submatches: [{ match: { text: "needle" }, start: 0, end: 6 }],
    }])
  } })
})

test("actual NUL file enumeration retains Unicode and whitespace names under explicit glob rules", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const names = ["  source [a].txt", "中文&source.txt", "\uFEFFsource.txt"]
    await Promise.all(names.map((name) => fs.writeFile(path.join(project.path, name), "needle\n")))
    await fs.writeFile(path.join(project.path, "ignored.txt"), "decoy\n")
    const files = await Array.fromAsync(Ripgrep.filesForHost({ cwd: project.path, glob: ["*.txt", "!ignored.txt"] }))
    expect(files.sort()).toEqual(names.sort())
  } })
})

test("the streaming file-list reader retains a Unicode filename split inside a UTF-8 character", async () => {
  await using project = await memoryProject()
  await Instance.provide({ directory: project.path, fn: async () => {
    const expected = "  中|line\nbreak.txt"
    const bytes = Buffer.from(expected + "\0")
    const stdout = new PassThrough({ objectMode: true })
    const stderr = new PassThrough()
    const drained = Promise.all([new Promise<void>((resolve) => stdout.once("end", resolve)), new Promise<void>((resolve) => stderr.once("end", resolve))]).then(() => undefined)
    let nulMode = false
    const restore = ProcessSupervisor.setCommandFactoryForTest(async (options) => {
      nulMode = options.args.includes("--null")
      stdout.write(bytes.subarray(0, 3))
      stdout.end(bytes.subarray(3))
      stderr.end()
      return {
        pid: 992318, stdin: new PassThrough(), stdout, stderr,
        exited: Promise.resolve(0), outputSettled: drained, settled: drained,
        async terminate() { stdout.resume(); stderr.resume() },
        async dispose() {}, unref() {},
      }
    })
    try {
      const files = await Array.fromAsync(Ripgrep.filesForHost({ cwd: project.path }))
      expect({ files, nulMode }).toEqual({ files: [expected], nulMode: true })
    } finally { restore() }
  } })
})

test("NUL file framing retains newline and separator characters as one filename", () => {
  const names = ["a|b.txt", "line\nbreak.txt", "\uFEFF中文.txt"]
  expect(Ripgrep.parseFileList(Buffer.from(names.join("\0") + "\0"))).toEqual(names)
})

test("an incomplete file frame produces a precise protocol error", () => {
  expect(() => Ripgrep.parseFileList(Buffer.from("incomplete.txt"))).toThrow("ripgrep file list ended without a NUL terminator")
})

test("an unrepresentable file identity produces a UTF-8 decode error", () => {
  const record = { type: "match", data: {
    path: { bytes: Buffer.from([255]).toString("base64") }, lines: { text: "needle\n" }, line_number: 1,
    absolute_offset: 0, submatches: [{ match: { text: "needle" }, start: 0, end: 6 }],
  } }
  expect(() => Ripgrep.parseSearchOutput(JSON.stringify(record))).toThrow(TypeError)
})
