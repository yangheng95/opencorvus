import { expect, test } from "bun:test"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { runHostCommandWithInactivity } from "../src/shell/command-inactivity"
import { readRunnerEvidence, removeVerifiedRunnerEvidence, RUNNER_EVIDENCE_BYTES } from "./fixture/runner-evidence"

const evidenceModule = pathToFileURL(path.join(import.meta.dir, "fixture/runner-evidence.ts")).href

test.each([1, 7])(
  "test runner identifies the selected file and preserves exit %d",
  async (exitCode) => {
    const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!root) throw new Error("Runner diagnostic test requires repository runtime")
    const directory = await createManagedTemporaryDirectory(root, "runner-diagnostic-")
    const file = path.join(directory, "selected failure.ts")
    const manifest = path.join(directory, "original-evidence.json")
    try {
      await Bun.write(
        file,
        `import { test } from "bun:test";
import { writeRunnerEvidence } from ${JSON.stringify(evidenceModule)};
test("diagnostic fixture", () => {
  writeRunnerEvidence(${JSON.stringify(manifest)}, ${JSON.stringify(`exit-${exitCode}`)});
  console.log("RUNNER_FIXTURE_STDOUT");
  console.error("RUNNER_FIXTURE_STDERR");
  ${exitCode === 1 ? 'throw new Error("deliberate runner fixture failure")' : "process.exit(7)"};
});`,
      )
      const result = await runHostCommandWithInactivity({
        executable: process.execPath,
        args: ["script/run-tests.ts", file],
        cwd: path.resolve(import.meta.dir, ".."),
        env: { ...process.env },
        inactivityTimeoutMs: 30_000,
      })
      expect(result.exitCode).toBe(exitCode)
      expect(result.stdout).toContain("RUNNER_FIXTURE_STDOUT")
      expect(result.stderr).toContain("RUNNER_FIXTURE_STDERR")
      expect(result.stderr).toContain(`OpenCorvus test file failed (exit=${exitCode}): ${file}`)
      const evidence = readRunnerEvidence(manifest)
      expect({ row: evidence.row, binary: evidence.binary }).toEqual({
        row: {
          id: `exit-${exitCode}`,
          outcome: "effect_written_before_checker_failure",
          evidence: RUNNER_EVIDENCE_BYTES,
        },
        binary: RUNNER_EVIDENCE_BYTES,
      })
      expect(result.stderr).toContain(`Test runtime retained after unsuccessful run: ${evidence.original.ownerRoot}`)
      await removeVerifiedRunnerEvidence(
        evidence,
        result.settlementConfirmed && result.stderr.includes("Physical/output settlement confirmed: true"),
      )
    } finally {
      await removeManagedDirectoryTree(directory)
    }
  },
  60_000,
)

test("a settled native stdout observer failure retains the original runner database and binary bytes", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Runner observer test requires its owned runtime")
  const directory = await createManagedTemporaryDirectory(owner, "runner-observer-")
  const file = path.join(directory, "observer.case.ts"),
    manifest = path.join(directory, "original-evidence.json")
  try {
    await Bun.write(
      file,
      `import {test} from "bun:test";
import {writeRunnerEvidence} from ${JSON.stringify(evidenceModule)};
test("real observer failure", async()=>{
writeRunnerEvidence(${JSON.stringify(manifest)}, "observer");
console.log("RUNNER_EVIDENCE_AFTER_DURABLE_EFFECT");
await new Promise(()=>{});
});`,
    )
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: ["--preload", path.join(import.meta.dir, "fixture/runner-output-observer.ts"), "script/run-tests.ts", file],
      cwd: path.resolve(import.meta.dir, ".."),
      env: process.env,
      inactivityTimeoutMs: 30_000,
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("controlled runner stdout observer failure after synthetic durable effect")
    const evidence = readRunnerEvidence(manifest)
    expect({ row: evidence.row, binary: evidence.binary }).toEqual({
      row: { id: "observer", outcome: "effect_written_before_checker_failure", evidence: RUNNER_EVIDENCE_BYTES },
      binary: RUNNER_EVIDENCE_BYTES,
    })
    expect(result.stderr).toContain(`Test runtime retained after unsuccessful run: ${evidence.original.ownerRoot}`)
    expect(result.stderr).toContain("Physical/output settlement confirmed: true")
    await removeVerifiedRunnerEvidence(evidence, result.settlementConfirmed)
  } finally {
    await removeManagedDirectoryTree(directory)
  }
}, 60_000)

test("the inactivity CLI retains original synthetic effects after its real native watchdog settles", async () => {
  const owner = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!owner) throw new Error("Runner watchdog test requires its owned runtime")
  const directory = await createManagedTemporaryDirectory(owner, "runner-watchdog-")
  const file = path.join(directory, "watchdog.ts"),
    manifest = path.join(directory, "original-evidence.json")
  try {
    await Bun.write(
      file,
      `import {writeRunnerEvidence} from ${JSON.stringify(evidenceModule)};
writeRunnerEvidence(${JSON.stringify(manifest)},"watchdog");
console.log("synthetic watchdog effect persisted");
setInterval(()=>{},1000);`,
    )
    const result = await runHostCommandWithInactivity({
      executable: process.execPath,
      args: ["script/run-with-inactivity.ts", "--inactivity-ms", "1000", "--", process.execPath, file],
      cwd: path.resolve(import.meta.dir, ".."),
      env: process.env,
      inactivityTimeoutMs: 30_000,
    })
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain("Command produced no stdout/stderr activity for 1000ms")
    const evidence = readRunnerEvidence(manifest)
    expect({ row: evidence.row, binary: evidence.binary }).toEqual({
      row: { id: "watchdog", outcome: "effect_written_before_checker_failure", evidence: RUNNER_EVIDENCE_BYTES },
      binary: RUNNER_EVIDENCE_BYTES,
    })
    expect(result.stderr).toContain(`Test runtime retained after unsuccessful run: ${evidence.original.ownerRoot}`)
    expect(result.stderr).toContain("Physical/output settlement confirmed: true")
    await removeVerifiedRunnerEvidence(evidence, result.settlementConfirmed)
  } finally {
    await removeManagedDirectoryTree(directory)
  }
}, 60_000)
