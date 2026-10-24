import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"
import { readRunnerEvidence, removeVerifiedRunnerEvidence, RUNNER_EVIDENCE_BYTES } from "./fixture/runner-evidence"

test("the isolated runner completes selected files and reports their failed exit", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Selected-file runner test requires its owned runtime")
  const root = await fs.mkdtemp(path.join(owner, "selected-runner-"))
  if (path.dirname(await fs.realpath(root)) !== (await fs.realpath(owner))) {
    throw new Error("Selected-file fixture escaped its owned runtime")
  }
  const receipt = path.join(root, "receipts.jsonl")
  const files = [path.join(root, "first.case.ts"), path.join(root, "second.case.ts")]
  const manifests = files.map((_, index) => path.join(root, `original-${index + 1}.json`))
  try {
    for (const [index, file] of files.entries()) {
      const record = { file: index + 1, outcome: index === 0 ? "failed" : "passed" }
      await fs.writeFile(
        file,
        [
          'import { test } from "bun:test"',
          'import fs from "node:fs"',
          `import {writeRunnerEvidence} from ${JSON.stringify(pathToFileURL(path.join(import.meta.dir, "fixture/runner-evidence.ts")).href)}`,
          `test("selected case ${index + 1}", () => {`,
          `writeRunnerEvidence(${JSON.stringify(manifests[index])},${JSON.stringify(`selected-${index + 1}`)})`,
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
    const evidence = manifests.map(readRunnerEvidence)
    expect(
      evidence.map((item) => ({ row: item.row, binary: item.binary, ownerRoot: item.original.ownerRoot })),
    ).toEqual(
      [1, 2].map((index) => ({
        row: {
          id: `selected-${index}`,
          outcome: "effect_written_before_checker_failure",
          evidence: RUNNER_EVIDENCE_BYTES,
        },
        binary: RUNNER_EVIDENCE_BYTES,
        ownerRoot: evidence[0].original.ownerRoot,
      })),
    )
    expect(result.stderr).toContain(`Test runtime retained after unsuccessful run: ${evidence[0].original.ownerRoot}`)
    await removeVerifiedRunnerEvidence(
      evidence[0],
      result.settlementConfirmed && result.stderr.includes("Physical/output settlement confirmed: true"),
    )
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
}, 60_000)
