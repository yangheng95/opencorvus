import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { applyBundledEnv } from "../src/bundled-env"

const repoRoot = path.resolve(import.meta.dir, "../../..")
const originalOpenCorvusHome = process.env.OPENCORVUS_HOME

const temp: string[] = []
const vars = [
  "OPENCORVUS_CHANNEL_BUNDLED_ENV_FILE",
  "OPENCORVUS_CHANNEL_BUNDLED_TTL_HOURS",
  "BUNDLE_TOKEN",
  "BUNDLE_REGION",
  "BUNDLE_ONLY",
]

beforeEach(() => {
  for (const key of vars) {
    delete process.env[key]
  }
})

afterEach(async () => {
  for (const key of vars) {
    delete process.env[key]
  }
  while (temp.length > 0) {
    const dir = temp.pop()!
    await rm(dir, { recursive: true, force: true })
  }
  if (originalOpenCorvusHome === undefined) delete process.env.OPENCORVUS_HOME
  else process.env.OPENCORVUS_HOME = originalOpenCorvusHome
})

async function fixture() {
  const dir = await mkdtemp(path.join(os.tmpdir(), "channel-bundle-"))
  temp.push(dir)
  const file = path.join(dir, "bundle.env")
  const home = path.join(dir, "runtime-root")
  const state = path.join(home, "state", "channel-runtime", "bundled-env-state.json")
  process.env.OPENCORVUS_CHANNEL_BUNDLED_ENV_FILE = file
  process.env.OPENCORVUS_HOME = home
  return { file, state, home }
}

describe("bundled env", () => {
  test("applies bundled env and records first use", async () => {
    const data = await fixture()
    await writeFile(data.file, "BUNDLE_TOKEN=trial-token\nBUNDLE_REGION=us\n")
    const now = Date.parse("2026-03-03T08:00:00.000Z")

    const result = await applyBundledEnv(now)

    expect(result.enabled).toBe(true)
    expect(result.expired).toBe(false)
    expect(result.applied).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.firstUsedAt).toBe("2026-03-03T08:00:00.000Z")
    expect(result.expireAt).toBe("2026-03-04T08:00:00.000Z")
    expect(process.env.BUNDLE_TOKEN).toBe("trial-token")
    expect(process.env.BUNDLE_REGION).toBe("us")

    const state = JSON.parse(await readFile(data.state, "utf-8")) as { first_used_at: number }
    expect(state.first_used_at).toBe(now)
  })

  test("a partially invalid bundle is refused before it can spend the one-shot window", async () => {
    const data = await fixture()
    // One valid line and one malformed line. The malformed line used to be
    // skipped silently, so the bundle still looked usable — and the bounded
    // secret window was signed before the caller learned anything was wrong.
    await writeFile(data.file, "BUNDLE_TOKEN=trial-token\nthis line has no assignment\n")
    const now = Date.parse("2026-03-03T08:00:00.000Z")

    const result = await applyBundledEnv(now)

    expect({
      enabled: result.enabled,
      applied: result.applied,
      skipped: result.skipped,
      reason: result.reason,
      applied_to_env: process.env.BUNDLE_TOKEN,
      stateWritten: await readFile(data.state, "utf8").then(
        () => true,
        () => false,
      ),
    }).toEqual({
      enabled: false,
      applied: 0,
      skipped: 1,
      reason: "invalid_bundle",
      applied_to_env: undefined,
      stateWritten: false,
    })
  })

  test("an invalid variable name is an invalid bundle, not a skipped line", async () => {
    const data = await fixture()
    await writeFile(data.file, "BUNDLE_TOKEN=trial-token\n1INVALID=nope\n")
    const result = await applyBundledEnv(Date.parse("2026-03-03T08:00:00.000Z"))
    expect({ enabled: result.enabled, reason: result.reason, skipped: result.skipped }).toEqual({
      enabled: false,
      reason: "invalid_bundle",
      skipped: 1,
    })
    expect(
      await readFile(data.state, "utf8").then(
        () => true,
        () => false,
      ),
    ).toBe(false)
  })

  test("keeps user env as higher priority than bundled env", async () => {
    const data = await fixture()
    await writeFile(data.file, "BUNDLE_TOKEN=trial-token\nBUNDLE_ONLY=from-bundle\n")
    process.env.BUNDLE_TOKEN = "user-token"

    const result = await applyBundledEnv(Date.parse("2026-03-03T08:00:00.000Z"))

    expect(result.enabled).toBe(true)
    expect(result.applied).toBe(1)
    expect(result.skipped).toBe(1)
    expect(process.env.BUNDLE_TOKEN).toBe("user-token")
    expect(process.env.BUNDLE_ONLY).toBe("from-bundle")
  })

  test("returns the corrupt first-use state error contract", async () => {
    const data = await fixture()
    await writeFile(data.file, "BUNDLE_TOKEN=trial-token\n")
    await mkdir(path.dirname(data.state), { recursive: true })
    await writeFile(data.state, "{")

    await expect(applyBundledEnv(Date.parse("2026-03-30T08:00:00.000Z"))).rejects.toThrow("Invalid bundled env state")

  })

  test("real concurrent Bun runtimes claim one immutable first-use timestamp", async () => {
    const data = await fixture()
    await writeFile(data.file, "BUNDLE_TOKEN=trial-token\n")
    const child = path.join(import.meta.dir, "fixture", "bundled-env-first-use.ts")
    const env = {
      ...process.env,
      OPENCORVUS_CHANNEL_BUNDLED_ENV_FILE: data.file,
      OPENCORVUS_HOME: data.home,
    }

    const children = Array.from({ length: 12 }, () =>
      Bun.spawn([process.execPath, child], {
        env,
        stdout: "pipe",
        stderr: "pipe",
      }),
    )
    const outputs = await Promise.all(
      children.map(async (childProcess) => {
        const [stdout, stderr, exitCode] = await Promise.all([
          new Response(childProcess.stdout).text(),
          new Response(childProcess.stderr).text(),
          childProcess.exited,
        ])
        expect(exitCode, stderr).toBe(0)
        return JSON.parse(stdout) as { firstUsedAt: string }
      }),
    )

    expect(new Set(outputs.map((output) => output.firstUsedAt)).size).toBe(1)
    const persisted = JSON.parse(await readFile(data.state, "utf8")) as { first_used_at: number }
    expect(new Date(persisted.first_used_at).toISOString()).toBe(outputs[0]!.firstUsedAt)
  })

  test("bundle example names the runtime env variable", () => {
    const example = readFileSync(path.join(repoRoot, "packages/channel-runtime/.env.bundle.example"), "utf8")

    expect(example).toContain("OPENCORVUS_CHANNEL_BUNDLED_ENV_FILE")
  })
})
