import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves all ten new Skill-and-asset domain Squads through an isolated production HTTP route", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-domain-squad-http-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "domain-expansion-production-route-probe.ts")

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
    if (exitCode !== 0) throw new Error(`Domain production-route probe failed (${exitCode}): ${stderr}`)

    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
    const result = JSON.parse(outputLine ?? "null") as {
      packages: number
      requestCount: number
      projections: Array<{
        id: string
        packageDigest: string
        skillRef: string
        agentCount: number
        rootCount: number
        joinCount: number
      }>
    }

    expect(result.packages).toBe(10)
    expect(result.requestCount).toBe(40)
    expect(result.projections).toHaveLength(10)
    expect(result.projections.every((entry) => /^[a-f0-9]{64}$/.test(entry.packageDigest))).toBe(true)
    expect(result.projections.every((entry) => entry.skillRef === `${entry.id}/shared/method`)).toBe(true)
    expect(result.projections.every((entry) => entry.agentCount === 4)).toBe(true)
    expect(result.projections.every((entry) => entry.rootCount === 3 && entry.joinCount === 1)).toBe(true)
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 0)
