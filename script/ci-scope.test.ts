import { expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { classifyCIPaths, resolveCIScope } from "./ci-scope"

test("classifies prose separately from compiled Markdown and arbitrary source changes", () => {
  expect(classifyCIPaths(["README.zh-CN.md", "specs/records/2026-09/release.md", "docs/packaging.md"])).toBe("docs")
  for (const source of [
    "expert-squads/builtin/team/README.md",
    "packages/web/src/content/index.mdx",
    "docs/check.ts",
    "bun.lock",
    ".github/workflows/test.yml",
  ]) {
    expect(classifyCIPaths(["README.md", source])).toBe("code")
  }
  expect(resolveCIScope({ event: "workflow_dispatch" })).toBe("code")
  expect(resolveCIScope({ event: "push", base: "0".repeat(40) })).toBe("code")
  expect(() => resolveCIScope({ event: "push", base: "--output=unexpected" })).toThrow(
    "CI base must be an exact Git commit SHA",
  )
})

test("reads the complete actual Git range including renamed compiled inputs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-ci-scope-"))
  expect(path.dirname(await fs.realpath(root)).toLowerCase()).toBe((await fs.realpath(os.tmpdir())).toLowerCase())
  const git = (...args: string[]) =>
    execFileSync(
      "git",
      ["-c", "user.name=CI Test", "-c", "user.email=ci@example.invalid", "-c", "commit.gpgsign=false", ...args],
      { cwd: root, encoding: "utf8" },
    ).trim()
  const commit = () => {
    git("add", ".")
    git("-c", "core.hooksPath=/dev/null", "commit", "-m", "CI scope fixture")
    return git("rev-parse", "HEAD")
  }
  try {
    git("init")
    await fs.writeFile(path.join(root, "source.ts"), "export const value = 1\n")
    const base = commit()
    await fs.writeFile(path.join(root, "README.md"), "Documentation\n")
    commit()
    expect(resolveCIScope({ event: "push", base, cwd: root })).toBe("docs")
    expect(resolveCIScope({ event: "pull_request", base, cwd: root })).toBe("docs")
    await fs.mkdir(path.join(root, "docs"))
    await fs.rename(path.join(root, "source.ts"), path.join(root, "docs", "old-source.md"))
    commit()
    expect(resolveCIScope({ event: "push", base, cwd: root })).toBe("code")
    expect(resolveCIScope({ event: "pull_request", base, cwd: root })).toBe("code")
  } finally {
    await fs.rm(root, { recursive: true, force: true, maxRetries: 10 })
  }
})
