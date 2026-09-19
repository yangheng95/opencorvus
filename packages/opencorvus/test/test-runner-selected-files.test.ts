import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"

test("the isolated runner completes selected files and reports their failed exit", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Selected-file runner test requires its owned runtime")
  const root = await fs.mkdtemp(path.join(owner, "selected-runner-"))
  if (path.dirname(await fs.realpath(root)) !== (await fs.realpath(owner))) {
    throw new Error("Selected-file fixture escaped its owned runtime")
  }
  const receipt = path.join(root, "receipts.jsonl")
  const files = [path.join(root, "first.case.ts"), path.join(root, "second.case.ts")]
  try {
    for (const [index, file] of files.entries()) {
      const record = { file: index + 1, outcome: index === 0 ? "failed" : "passed" }
      await fs.writeFile(
        file,
        [
          'import { test } from "bun:test"',
          'import fs from "node:fs"',
          `test("selected case ${index + 1}", () => {`,
          `fs.appendFileSync(${JSON.stringify(receipt)}, ${JSON.stringify(JSON.stringify(record) + "\n")})`,
          index === 0 ? 'throw new Error("controlled selected-file failure")' : "",
          "})",
        ].join("\n"),
      )
    }
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: [path.resolve(import.meta.dir, "../script/run-tests.ts"), ...files],
      cwd: path.resolve(import.meta.dir, ".."),
      env: process.env,
      inactivityTimeoutMs: 60_000,
    })
    expect(result.exitCode).toBe(1)
    const output = result.stdout.toString()
    for (const [index, file] of files.entries()) {
      const label = path
        .relative(path.resolve(import.meta.dir, ".."), file)
        .split(path.sep)
        .join("/")
      expect(output).toContain(`[${index + 1}/2] START ${label}`)
      expect(output).toContain(`[${index + 1}/2] DONE ${label} exit=${index === 0 ? 1 : 0} duration=`)
    }
    expect(
      (await fs.readFile(receipt, "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line)),
    ).toEqual([
      { file: 1, outcome: "failed" },
      { file: 2, outcome: "passed" },
    ])
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}, 60_000)
