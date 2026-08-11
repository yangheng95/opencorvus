import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves ten new and three repaired Skill-complete Squads through an isolated production HTTP route", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-squad-production-route-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "production-route-probe.ts")

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
    if (exitCode !== 0) throw new Error(`Production route probe failed (${exitCode}): ${stderr}`)

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
        workflowNodeCount: number
      }>
      repairedProjections: Array<{
        id: string
        packageDigest: string
        skillRef: string
        agentCount: number
      }>
      activeBaseSkillRefs: string[]
    }

    expect(result.packages).toBe(10)
    expect(result.requestCount).toBe(46)
    expect(result.projections).toHaveLength(10)
    expect(result.projections.every((projection) => /^[a-f0-9]{64}$/.test(projection.packageDigest))).toBe(true)
    expect(result.projections.every((projection) => projection.skillRef.length > 0)).toBe(true)
    expect(result.projections.every((projection) => projection.agentCount === 4)).toBe(true)
    expect(result.projections.every((projection) => projection.workflowNodeCount === 4)).toBe(true)
    expect(result.repairedProjections.map((projection) => projection.id)).toEqual([
      "base",
      "advanced",
      "frontend-innovate",
    ])
    expect(result.repairedProjections.map((projection) => projection.skillRef)).toEqual([
      "base/shared/method",
      "advanced/shared/method",
      "frontend-innovate/shared/method",
    ])
    expect(result.repairedProjections.every((projection) => /^[a-f0-9]{64}$/.test(projection.packageDigest))).toBe(true)
    expect(result.repairedProjections.every((projection) => projection.agentCount > 0)).toBe(true)
    expect(result.activeBaseSkillRefs).toContain("base/shared/method")
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 0)
