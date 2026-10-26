import { expect, test } from "bun:test"
import { spawnSync } from "node:child_process"
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { fileURLToPath } from "node:url"
import { listTrackedEntries, parsePrePushUpdates, scan, type PrePushUpdate } from "./secret-scan"

const zero = "0".repeat(40)
const fakeProvider = "sk-" + "FixtureValue".repeat(3)
const fakeGithub = "ghp_" + "FixtureValue".repeat(3)
const fakeSlack = "xoxb-" + "FixtureValue".repeat(3)

function fixture(run: (repo: string) => void, objectFormat = "sha1") {
  const parent = path.resolve(os.tmpdir())
  const repo = fs.mkdtempSync(path.join(parent, "opencorvus-secret-scan-"))
  try {
    git(repo, ["init", "--initial-branch=scan-fixture", `--object-format=${objectFormat}`])
    const remote = path.join(repo, ".git", "scanner-target.git")
    git(repo, ["init", "--bare", `--object-format=${objectFormat}`, remote])
    git(repo, ["remote", "add", "origin", remote])
    run(repo)
  } finally {
    if (path.dirname(path.resolve(repo)) !== parent || !path.basename(repo).startsWith("opencorvus-secret-scan-")) {
      throw new Error("Scanner fixture cleanup escaped its owned temporary parent")
    }
    if (fs.lstatSync(repo).isSymbolicLink()) throw new Error("Scanner fixture root is a symbolic link")
    fs.rmSync(repo, { recursive: true })
  }
}

function git(repo: string, args: string[], input?: string, extraEnv: NodeJS.ProcessEnv = {}) {
  const env = { ...process.env }
  for (const key of Object.keys(env)) if (key.startsWith("GIT_")) delete env[key]
  Object.assign(env, extraEnv)
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
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true })
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
    expect(report(scan({ repoRoot: repo, targetRemote: "origin", pushUpdates: [update(tip, base)] }))).toEqual([
      { file: "a.ts", lineNumber: 1, patternId: "github-pat" },
      { file: "a.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "b.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "renamed.ts", lineNumber: 1, patternId: "github-pat" },
      { file: "staged.ts", lineNumber: 1, patternId: "slack-token" },
    ])
  })
})

test("multi-ref publication shares its published boundary and reports new merge snapshots", () => {
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
    expect(
      report(scan({ repoRoot: repo, targetRemote: "origin", pushUpdates: [update(merge, zero), update(right, base)] })),
    ).toEqual([
      { file: "left.ts", lineNumber: 1, patternId: "provider-key" },
      { file: "right.ts", lineNumber: 1, patternId: "github-pat" },
    ])
  })
})

test("new tag publication reports new historical and staged credentials beyond the target's published commits", () => {
  fixture((repo) => {
    write(repo, "published.ts", fakeProvider)
    commit(repo)
    write(repo, "published.ts", "public baseline")
    commit(repo)
    git(repo, ["push", "origin", "HEAD:refs/heads/published"])
    write(repo, "new.ts", fakeGithub)
    commit(repo)
    write(repo, "new.ts", "public final snapshot")
    const tip = commit(repo)
    write(repo, "staged.ts", fakeSlack)
    expect(
      report(
        scan({
          repoRoot: repo,
          targetRemote: "origin",
          pushUpdates: [{ ...update(tip, zero), localRef: "refs/tags/v1", remoteRef: "refs/tags/v1" }],
        }),
      ),
    ).toEqual([
      { file: "new.ts", lineNumber: 1, patternId: "github-pat" },
      { file: "staged.ts", lineNumber: 1, patternId: "slack-token" },
    ])
  })
})

test("a published credential in the exact release tip still produces its report", () => {
  fixture((repo) => {
    write(repo, "tip.ts", fakeProvider)
    const tip = commit(repo)
    git(repo, ["push", "origin", "HEAD:refs/heads/published"])
    expect(report(scan({ repoRoot: repo, targetRemote: "origin", pushUpdates: [update(tip, zero)] }))).toEqual([
      { file: "tip.ts", lineNumber: 1, patternId: "provider-key" },
    ])
  })
})

test("a different empty remote receives the complete historical credential report", () => {
  fixture((repo) => {
    write(repo, "history.ts", fakeProvider)
    commit(repo)
    write(repo, "history.ts", "public final snapshot")
    const tip = commit(repo)
    git(repo, ["push", "origin", "HEAD:refs/heads/published"])
    const other = path.join(repo, ".git", "other-target.git")
    git(repo, ["init", "--bare", other])
    expect(report(scan({ repoRoot: repo, targetRemote: other, pushUpdates: [update(tip, zero)] }))).toEqual([
      { file: "history.ts", lineNumber: 1, patternId: "provider-key" },
    ])
  })
})

test("a missing target identity returns its explicit pre-push error", () => {
  fixture((repo) => {
    write(repo, "public.ts", "public baseline")
    const tip = commit(repo)
    expect(() => scan({ repoRoot: repo, pushUpdates: [update(tip, zero)] })).toThrow(
      "Pre-push secret scan requires the target remote",
    )
  })
})

test("an unavailable target inventory returns its explicit error", () => {
  fixture((repo) => {
    write(repo, "public.ts", "public baseline")
    const tip = commit(repo)
    expect(() =>
      scan({ repoRoot: repo, targetRemote: path.join(repo, "missing.git"), pushUpdates: [update(tip, zero)] }),
    ).toThrow("Secret scan remote inventory unavailable:")
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
    const result = spawnSync(process.execPath, [script, "--pre-push-stdin", "--remote", "origin"], {
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

for (const format of ["sha1", "sha256"]) {
  for (const index of ["v2", "v3", "v4", "split"]) {
    test(`${format} ${index} index returns complete staged metadata and its credential report`, () => {
      fixture((repo) => {
        write(repo, "base.ts", "public baseline")
        commit(repo)
        const file = "folder with space/凭据.ts"
        write(repo, file, fakeProvider)
        const version = index === "split" ? 2 : Number(index.slice(1))
        if (index === "v3") git(repo, ["update-index", "--skip-worktree", "base.ts"])
        git(repo, ["update-index", `--index-version=${version}`])
        if (index === "split") git(repo, ["update-index", "--split-index"])
        else expect(fs.readFileSync(path.join(repo, ".git", "index")).readUInt32BE(4)).toBe(version)
        expect(listTrackedEntries(repo)).toEqual([
          { file: "base.ts", objectId: git(repo, ["rev-parse", ":base.ts"]), mode: 0o100644, stage: 0, size: 16 },
          {
            file,
            objectId: git(repo, ["rev-parse", `:${file}`]),
            mode: 0o100644,
            stage: 0,
            size: fakeProvider.length + 1,
          },
        ])
        expect(report(scan({ repoRoot: repo }))).toEqual([{ file, lineNumber: 1, patternId: "provider-key" }])
      }, format)
    })
  }
}

test("sparse index supplies the full staged paths and the staged credential report", () => {
  fixture((repo) => {
    write(repo, "inside/public.ts", "inside public")
    write(repo, "outside/public.ts", "outside public")
    commit(repo)
    git(repo, ["sparse-checkout", "init", "--cone", "--sparse-index"])
    git(repo, ["sparse-checkout", "set", "inside"])
    write(repo, "inside/staged.ts", fakeProvider)
    const entries = listTrackedEntries(repo)
    expect(entries.map((entry) => entry.file)).toEqual(["inside/public.ts", "inside/staged.ts", "outside/public.ts"])
    expect(entries.find((entry) => entry.file === "outside/public.ts")).toEqual({
      file: "outside/public.ts",
      objectId: git(repo, ["rev-parse", ":outside/public.ts"]),
      mode: 0o100644,
      stage: 0,
      size: 15,
    })
    expect(report(scan({ repoRoot: repo }))).toEqual([
      { file: "inside/staged.ts", lineNumber: 1, patternId: "provider-key" },
    ])
  })
})

test("cacheinfo entries report the actual immutable blob size", () => {
  fixture((repo) => {
    write(repo, "base.ts", "public baseline")
    commit(repo)
    const content = fakeProvider + "\n" + "x".repeat(1024 * 1024 + 17)
    const objectId = git(repo, ["hash-object", "-w", "--stdin"], content)
    git(repo, ["update-index", "--add", "--cacheinfo", "100644", objectId, "cached.ts"])
    expect(listTrackedEntries(repo).find((entry) => entry.file === "cached.ts")).toEqual({
      file: "cached.ts",
      objectId,
      mode: 0o100644,
      stage: 0,
      size: Buffer.byteLength(content),
    })
  })
})

test("normalized staged content uses its blob size and produces the credential report", () => {
  fixture((repo) => {
    git(repo, ["config", "core.autocrlf", "true"])
    write(repo, "base.ts", "public baseline")
    commit(repo)
    const body = fakeProvider + "\r\n" + "x\r\n".repeat(400000)
    fs.writeFileSync(path.join(repo, "normalized.ts"), body)
    git(repo, ["add", "normalized.ts"])
    expect(listTrackedEntries(repo).find((entry) => entry.file === "normalized.ts")).toEqual({
      file: "normalized.ts",
      objectId: git(repo, ["rev-parse", ":normalized.ts"]),
      mode: 0o100644,
      stage: 0,
      size: fakeProvider.length + 1 + 800000,
    })
    expect(report(scan({ repoRoot: repo }))).toEqual([
      { file: "normalized.ts", lineNumber: 1, patternId: "provider-key" },
    ])
  })
})

test("relative alternate indexes use Git's repository ownership and staged content", () => {
  fixture((repo) => {
    write(repo, "base.ts", "public baseline")
    commit(repo)
    const extra = { GIT_INDEX_FILE: "alternate-index" }
    git(repo, ["read-tree", "HEAD"], undefined, extra)
    const objectId = git(repo, ["hash-object", "-w", "--stdin"], fakeProvider + "\n")
    git(repo, ["update-index", "--add", "--cacheinfo", "100644", objectId, "alternate.ts"], undefined, extra)
    const previous = process.env.GIT_INDEX_FILE
    process.env.GIT_INDEX_FILE = extra.GIT_INDEX_FILE
    try {
      expect(listTrackedEntries(repo).find((entry) => entry.file === "alternate.ts")).toEqual({
        file: "alternate.ts",
        objectId,
        mode: 0o100644,
        stage: 0,
        size: fakeProvider.length + 1,
      })
      expect(report(scan({ repoRoot: repo }))).toEqual([
        { file: "alternate.ts", lineNumber: 1, patternId: "provider-key" },
      ])
    } finally {
      if (previous === undefined) delete process.env.GIT_INDEX_FILE
      else process.env.GIT_INDEX_FILE = previous
    }
  })
})

test("Gitlink metadata and ordinary staged credentials retain their declared types", () => {
  fixture((repo) => {
    write(repo, "base.ts", "public baseline")
    const objectId = commit(repo)
    git(repo, ["update-index", "--add", "--cacheinfo", "160000", objectId, "subproject"])
    write(repo, "staged.ts", fakeProvider)
    expect(listTrackedEntries(repo).find((entry) => entry.file === "subproject")).toEqual({
      file: "subproject",
      objectId,
      mode: 0o160000,
      stage: 0,
      size: 0,
    })
    expect(report(scan({ repoRoot: repo }))).toEqual([{ file: "staged.ts", lineNumber: 1, patternId: "provider-key" }])
  })
})

test("a corrupt index returns the explicit Git read error", () => {
  fixture((repo) => {
    write(repo, "base.ts", "public baseline")
    commit(repo)
    fs.writeFileSync(path.join(repo, ".git", "index"), "invalid index data")
    expect(() => listTrackedEntries(repo)).toThrow(/^git ls-files failed:/)
  })
})
