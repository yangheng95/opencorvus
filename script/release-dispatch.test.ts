import { afterAll, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const repositoryRoot = path.join(import.meta.dir, "..")
const gitBash = "C:\\Program Files\\Git\\bin\\bash.exe"
const temporaryRoots: string[] = []

function run(command: string, args: string[], cwd: string, env?: Record<string, string>) {
  return Bun.spawnSync([command, ...args], {
    cwd,
    env: { ...process.env, ...env },
    stdout: "pipe",
    stderr: "pipe",
  })
}

function assertSucceeded(result: ReturnType<typeof run>): void {
  expect(result.exitCode, result.stderr.toString()).toBe(0)
}

function bashPath(value: string): string {
  return value.replace(/^([A-Za-z]):/, (_, drive: string) => `/${drive.toLowerCase()}`).replaceAll("\\", "/")
}

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-release-dispatch-"))
  temporaryRoots.push(root)
  const remote = path.join(root, "remote.git")
  const checkout = path.join(root, "checkout")
  const commands = path.join(root, "commands")
  const log = path.join(root, "gh-args.bin")
  await fs.mkdir(checkout)
  await fs.mkdir(commands)
  assertSucceeded(run("git", ["init", "--bare", remote], root))
  assertSucceeded(run("git", ["init", "-b", "local-release"], checkout))
  assertSucceeded(run("git", ["config", "user.name", "Release Contract"], checkout))
  assertSucceeded(run("git", ["config", "user.email", "release@example.invalid"], checkout))
  await fs.writeFile(path.join(checkout, "source.txt"), "reviewed source\n")
  assertSucceeded(run("git", ["add", "source.txt"], checkout))
  assertSucceeded(run("git", ["commit", "-m", "reviewed source"], checkout))
  assertSucceeded(run("git", ["remote", "add", "origin", remote], checkout))
  assertSucceeded(run("git", ["push", "-u", "origin", "HEAD:release-source"], checkout))
  assertSucceeded(run("git", ["remote", "set-url", "origin", "git@github.com:owner/repository.git"], checkout))

  await fs.writeFile(
    path.join(commands, "bun"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "-e" ]]; then
  if [[ "$2" == *"Remote is not a GitHub repository"* ]]; then
    printf '%s\\n' 'owner/repository'
  else
    printf '%s\\n' "\${3}"
  fi
  exit 0
fi
if [[ "$1" == "./script/sync-version.ts" && "$3" == "--check" ]]; then
  exit 0
fi
exit 91
`,
  )
  await fs.writeFile(
    path.join(commands, "gh"),
    `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\0' "$@" > "$GH_ARGUMENT_LOG"
`,
  )
  await fs.writeFile(
    path.join(commands, "git"),
    `#!/usr/bin/env bash
set -euo pipefail
if [[ "$1" == "fetch" ]]; then
  exec /mingw64/bin/git fetch --quiet "$REAL_GIT_REMOTE" refs/heads/release-source:refs/remotes/origin/release-source
fi
exec /mingw64/bin/git "$@"
`,
  )
  await fs.chmod(path.join(commands, "bun"), 0o755)
  await fs.chmod(path.join(commands, "gh"), 0o755)
  await fs.chmod(path.join(commands, "git"), 0o755)
  return { root, remote, checkout, commands, log }
}

afterAll(async () => {
  await Promise.all(temporaryRoots.map((root) => fs.rm(root, { recursive: true, force: true })))
})

describe("release dispatcher", () => {
  test("dispatches the exact checked remote merge ref and repository despite GH_REPO", async () => {
    const input = await fixture()
    const head = run("git", ["rev-parse", "HEAD"], input.checkout).stdout.toString().trim()
    const result = run(
      gitBash,
      [bashPath(path.join(repositoryRoot, "script", "release")), "0.0.57-beta"],
      input.checkout,
      {
        GH_ARGUMENT_LOG: bashPath(input.log),
        GH_REPO: "attacker/other",
        REAL_GIT_REMOTE: bashPath(input.remote),
        PATH: `${bashPath(input.commands)}:/mingw64/bin:/usr/bin`,
      },
    )
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    expect(result.stdout.toString()).toContain(
      `Dispatching build.yml for v0.0.57-beta from owner/repository:release-source@${head}`,
    )
    const args = (await fs.readFile(input.log)).toString().split("\0").filter(Boolean)
    expect(args).toEqual([
      "workflow",
      "run",
      "build.yml",
      "--repo",
      "owner/repository",
      "--ref",
      "release-source",
      "-f",
      "version=0.0.57-beta",
      "-f",
      `expected_source_sha=${head}`,
    ])
  }, 20_000)

  test("fails closed when the fetched upstream moved beyond local HEAD", async () => {
    const input = await fixture()
    const remoteCheckout = path.join(input.root, "remote-checkout")
    assertSucceeded(run("git", ["clone", input.remote, remoteCheckout], input.root))
    assertSucceeded(run("git", ["checkout", "release-source"], remoteCheckout))
    assertSucceeded(run("git", ["config", "user.name", "Remote Writer"], remoteCheckout))
    assertSucceeded(run("git", ["config", "user.email", "remote@example.invalid"], remoteCheckout))
    await fs.writeFile(path.join(remoteCheckout, "advanced.txt"), "advanced\n")
    assertSucceeded(run("git", ["add", "advanced.txt"], remoteCheckout))
    assertSucceeded(run("git", ["commit", "-m", "advance remote"], remoteCheckout))
    assertSucceeded(run("git", ["push", "origin", "HEAD:release-source"], remoteCheckout))

    const result = run(
      gitBash,
      [bashPath(path.join(repositoryRoot, "script", "release")), "0.0.57-beta"],
      input.checkout,
      {
        GH_ARGUMENT_LOG: bashPath(input.log),
        REAL_GIT_REMOTE: bashPath(input.remote),
        PATH: `${bashPath(input.commands)}:/mingw64/bin:/usr/bin`,
      },
    )
    expect(result.exitCode, result.stderr.toString()).toBe(1)
    expect(result.stdout.toString()).toContain("Release dispatch requires HEAD to equal origin/release-source")
    await expect(fs.readFile(input.log)).rejects.toThrow()
  }, 20_000)
})
