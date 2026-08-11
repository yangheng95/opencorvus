import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("production bootstrap preserves legacy project and global installations with an inert provisioning ledger", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-legacy-payload-migration-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "legacy-payload-migration-production-route-probe.ts")

  try {
    const child = Bun.spawn([process.execPath, probe, isolatedProject], {
      cwd: path.resolve(import.meta.dir, "../../../.."),
      env: { ...Bun.env, OPENCORVUS_HOME: isolatedHome },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0) throw new Error(`Legacy payload migration probe failed (${exitCode}): ${stderr}`)

    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
    const result = JSON.parse(outputLine ?? "null") as {
      project: { id: string; digest: string; scope: string; bytes: { digest: string; fileCount: number } }
      global: { id: string; digest: string; scope: string; bytes: { digest: string; fileCount: number } }
      ledgerDigest: string
      activeSquadID: string
    }

    expect(result).toEqual({
      project: {
        id: "cloud-platform-architecture",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        scope: "project",
        bytes: { digest: expect.stringMatching(/^[a-f0-9]{64}$/), fileCount: expect.any(Number) },
      },
      global: {
        id: "customer-success",
        digest: expect.stringMatching(/^[a-f0-9]{64}$/),
        scope: "global",
        bytes: { digest: expect.stringMatching(/^[a-f0-9]{64}$/), fileCount: expect.any(Number) },
      },
      ledgerDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
      activeSquadID: "base",
    })
    expect(result.project.bytes.fileCount).toBeGreaterThan(0)
    expect(result.global.bytes.fileCount).toBeGreaterThan(0)
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 240_000)
