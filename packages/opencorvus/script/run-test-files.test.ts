import { afterAll, describe, expect, test } from "bun:test"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { discoverTestFiles, parseTestFileRunInput, runTestFiles } from "./run-test-files"

const roots: string[] = []

afterAll(async () => {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })))
})

describe("isolated test-file runner", () => {
  test("parses the repository's bounded two-process execution contract", () => {
    expect(parseTestFileRunInput(["--concurrency", "2", "test"])).toEqual({ concurrency: 2, root: "test" })
  })

  test("discovers nested TypeScript test files in canonical UTF-8 byte order", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-test-files-"))
    roots.push(root)
    await mkdir(path.join(root, "nested"))
    await Promise.all([
      writeFile(path.join(root, "zeta.test.ts"), "export {}\n"),
      writeFile(path.join(root, "nested", "alpha.test.ts"), "export {}\n"),
    ])
    expect(await discoverTestFiles(root)).toEqual([
      path.relative(process.cwd(), path.join(root, "nested", "alpha.test.ts")),
      path.relative(process.cwd(), path.join(root, "zeta.test.ts")),
    ])
  })

  test("loads the repository preload per file and aggregates every failed child before returning", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "opencorvus-test-runner-contract-"))
    roots.push(root)
    const passMarker = path.join(root, "pass-preload.txt")
    const failMarker = path.join(root, "fail-preload.txt")
    const passFile = path.join(root, "pass.test.ts")
    const failFile = path.join(root, "fail.test.ts")
    await Promise.all([
      writeFile(
        passFile,
        `import { expect, test } from "bun:test"\nimport { writeFile } from "node:fs/promises"\ntest("pass child", async () => {\n  expect(process.env.OPENCORVUS_TEST_PROCESS_ROOT).toBeTruthy()\n  await writeFile(${JSON.stringify(passMarker)}, process.env.OPENCORVUS_TEST_PROCESS_ROOT!)\n  console.log("isolated-pass-output")\n})\n`,
      ),
      writeFile(
        failFile,
        `import { expect, test } from "bun:test"\nimport { writeFile } from "node:fs/promises"\ntest("failed child contract", async () => {\n  expect(process.env.OPENCORVUS_TEST_PROCESS_ROOT).toBeTruthy()\n  await writeFile(${JSON.stringify(failMarker)}, process.env.OPENCORVUS_TEST_PROCESS_ROOT!)\n  console.error("isolated-fail-output")\n  expect("actual").toBe("expected")\n})\n`,
      ),
    ])

    expect(await runTestFiles({ concurrency: 2, root })).toEqual({
      passed: 1,
      failed: [path.relative(process.cwd(), failFile)],
    })
    const [passPreloadRoot, failPreloadRoot] = await Promise.all([
      readFile(passMarker, "utf8"),
      readFile(failMarker, "utf8"),
    ])
    expect(passPreloadRoot).not.toBe(failPreloadRoot)

    const cli = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "run-test-files.ts"), "--concurrency", "2", root],
      { cwd: process.cwd(), env: process.env, stdout: "pipe", stderr: "pipe" },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      cli.exited,
      new Response(cli.stdout).text(),
      new Response(cli.stderr).text(),
    ])
    expect(exitCode).toBe(1)
    expect(stdout).toContain("isolated-pass-output")
    expect(stderr).toContain("isolated-fail-output")
    expect(stderr).toContain("1 test file(s) failed:")
    expect(stderr).toContain(path.relative(process.cwd(), failFile))
  }, 90_000)
})
