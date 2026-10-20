import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { parsePrePushUpdates, scan, type PrePushUpdate } from "./secret-scan"

const zero = "0".repeat(40)
const fakeProvider = "sk-" + "FixtureValue".repeat(3)
const fakeGithub = "ghp_" + "FixtureValue".repeat(3)
const fakeSlack = "xoxb-" + "FixtureValue".repeat(3)

function fixture(run: (repo: string) => void) {
  const parent = path.resolve(os.tmpdir())
  const repo = fs.mkdtempSync(path.join(parent, "opencorvus-secret-scan-"))
  try {
    git(repo, ["init", "--initial-branch=scan-fixture"])
    run(repo)
  } finally {
    if (path.dirname(path.resolve(repo)) !== parent || !path.basename(repo).startsWith("opencorvus-secret-scan-")) {
      throw new Error("Scanner fixture cleanup escaped its owned temporary parent")
    }
    if (fs.lstatSync(repo).isSymbolicLink()) throw new Error("Scanner fixture root is a symbolic link")
    fs.rmSync(repo, { recursive: true })
  }
}

function git(repo: string, args: string[], input?: string) {
  const env = { ...process.env }
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key]
  const result = spawnSync(
    "git",
    [
      "-C",
      repo,
      "-c",
      "user.name=Scanner Fixture",
      "-c",
      "user.email=scanner@example.invalid",
      "-c",
      "commit.gpgsign=false",
      "-c",
      `core.hooksPath=${repo}/empty-hooks`,
      ...args,
    ],
    { input, env, encoding: "utf8", windowsHide: true },
  )
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr)
  return result.stdout.trim()
}

function write(repo: string, file: string, value: string) {
  fs.writeFileSync(path.join(repo, file), value + "\n")
  git(repo, ["add", "--", file])
}

function commit(repo: string) {
  git(repo, ["commit", "-m", "scanner fixture snapshot"])
  return git(repo, ["rev-parse", "HEAD"])
}

function update(localObjectId: string, remoteObjectId: string): PrePushUpdate {
  return { localRef: "refs/heads/scan-fixture", localObjectId, remoteRef: "refs/heads/scan-fixture", remoteObjectId }
}

function report(hits: ReturnType<typeof scan>) {
  return hits
    .map(({ file, lineNumber, patternId }) => ({ file, lineNumber, patternId }))
    .sort((a, b) => a.file.localeCompare(b.file) || a.patternId.localeCompare(b.patternId))
}

test("pre-push input preserves update, creation and deletion object boundaries", () => {
  const first = "1".repeat(40),
    second = "2".repeat(40)
  expect(
    parsePrePushUpdates(
      [
        `refs/heads/main ${second} refs/heads/main ${first}`,
        `refs/heads/new ${first} refs/heads/new ${zero}`,
        `(delete) ${zero} refs/heads/old ${second}`,
      ].join("\n"),
    ),
  ).toEqual([
    { localRef: "refs/heads/main", localObjectId: second, remoteRef: "refs/heads/main", remoteObjectId: first },
    { localRef: "refs/heads/new", localObjectId: first, remoteRef: "refs/heads/new", remoteObjectId: zero },
    { localRef: "(delete)", localObjectId: zero, remoteRef: "refs/heads/old", remoteObjectId: second },
  ])
})

test("malformed hook input returns the explicit protocol error", () => {
  expect(() => parsePrePushUpdates("refs/heads/main invalid refs/heads/main " + zero)).toThrow(
    "invalid pre-push ref line: refs/heads/main invalid refs/heads/main " + zero,
  )
})

test("historical versions, shared content paths and the staged snapshot produce their credential reports", () => {
  fixture((repo) => {
    write(repo, "a.ts", "export const mode = 'public'")
    write(repo, "b.ts", "export const mode = 'public'")
    const base = commit(repo)
    write(repo, "a.ts", fakeProvider)
    write(repo, "b.ts", fakeProvider)
    write(repo, "raw.bin", fakeGithub)
    commit(repo)
    write(repo, "a.ts", fakeGithub)
    write(repo, "b.ts", "export const mode = 'public again'")
    git(repo, ["mv", "raw.bin", "renamed.ts"])
    commit(repo)
    write(repo, "a.ts", "export const mode = 'public again'")
    git(repo, ["rm", "renamed.ts"])
    const tip = commit(repo)
    write(repo, "staged.ts", fakeSlack)
    fs.writeFileSync(path.join(repo, "staged.ts"), "public working copy\n")
    expect(report(scan({ repoRoot: repo, pushUpdates: [update(tip, base)] }))).toEqual([
      { file: "a.ts", lineNumber: 1, patternId: "github-pat" },
      { file: "a.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "b.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "renamed.ts", lineNumber: 1, patternId: "github-pat" },
      { file: "staged.ts", lineNumber: 1, patternId: "slack-token" },
    ])
  })
})

test("new refs and merge ancestry expose their changed file snapshots", () => {
  fixture((repo) => {
    write(repo, "base.ts", "public baseline")
    write(repo, "root.ts", fakeSlack)
    const base = commit(repo)
    write(repo, "root.ts", "public root")
    write(repo, "left.ts", fakeProvider)
    const leftTree = git(repo, ["write-tree"])
    const left = git(repo, ["commit-tree", leftTree, "-p", base, "-m", "left snapshot"])
    write(repo, "left.ts", "public left")
    write(repo, "right.ts", fakeGithub)
    const rightTree = git(repo, ["write-tree"])
    const right = git(repo, ["commit-tree", rightTree, "-p", base, "-m", "right snapshot"])
    write(repo, "right.ts", "public right")
    const mergeTree = git(repo, ["write-tree"])
    const merge = git(repo, ["commit-tree", mergeTree, "-p", left, "-p", right, "-m", "merged public snapshot"])
    git(repo, ["update-ref", "HEAD", merge])
    expect(report(scan({ repoRoot: repo, pushUpdates: [update(merge, zero), update(right, base)] }))).toEqual([
      { file: "left.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "right.ts", lineNumber: 1, patternId: "github-pat" },
      { file: "root.ts", lineNumber: 1, patternId: "slack-token" },
    ])
  })
})

test("default HEAD and index scans retain each path of a committed credential blob", () => {
  fixture((repo) => {
    write(repo, "a.ts", fakeProvider)
    write(repo, "b.ts", fakeProvider)
    commit(repo)
    expect(scan({ repoRoot: repo })).toEqual([
      { file: "a.ts", lineNumber: 1, patternId: "provider-key", description: "Model-provider key (sk-...)" },
      { file: "b.ts", lineNumber: 1, patternId: "provider-key", description: "Model-provider key (sk-...)" },
    ])
    expect(report(scan({ repoRoot: repo }))).toEqual([
      { file: "a.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "b.ts", lineNumber: 1, patternId: "provider-key" },
    ])
  })
})

test("the real CLI rejects a pushed intermediate credential with an explicit file and pattern", () => {
  fixture((repo) => {
    write(repo, "transient.ts", "public baseline")
    const base = commit(repo)
    write(repo, "transient.ts", fakeProvider)
    commit(repo)
    write(repo, "transient.ts", "public final snapshot")
    const tip = commit(repo)
    const script = path.join(repo, "script", "secret-scan.ts")
    fs.mkdirSync(path.dirname(script))
    fs.copyFileSync(fileURLToPath(new URL("./secret-scan.ts", import.meta.url)), script)
    const result = spawnSync(process.execPath, [script, "--pre-push-stdin"], {
      cwd: repo,
      input: `refs/heads/scan-fixture ${tip} refs/heads/scan-fixture ${base}\n`,
      encoding: "utf8",
      windowsHide: true,
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain("[secret-scan] Checking pushed file snapshots and the index")
    expect(result.stderr).toContain("[secret-scan] FAIL — 1 hit(s)")
    expect(result.stderr.split(/\r?\n/).filter((line) => line.startsWith("  "))).toEqual([
      "  transient.ts:1  [provider-key] Model-provider key (sk-...)",
    ])
  })
})
