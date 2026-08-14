import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves the third ten Skill-and-asset domain Squads through an isolated production HTTP route", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-third-domain-http-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "third-domain-expansion-production-route-probe.ts")

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
    if (exitCode !== 0) throw new Error(`Third-domain production-route probe failed (${exitCode}): ${stderr}`)

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
    expect(result.projections.map(({ id, skillRef }) => ({ id, skillRef }))).toEqual([
      { id: "insurance-claims-operations", skillRef: "insurance-claims-operations/shared/method" },
      { id: "energy-utilities-planning", skillRef: "energy-utilities-planning/shared/method" },
      { id: "agriculture-food-systems", skillRef: "agriculture-food-systems/shared/method" },
      { id: "construction-project-controls", skillRef: "construction-project-controls/shared/method" },
      { id: "telecom-network-assurance", skillRef: "telecom-network-assurance/shared/method" },
      { id: "public-sector-service-delivery", skillRef: "public-sector-service-delivery/shared/method" },
      { id: "nonprofit-grant-operations", skillRef: "nonprofit-grant-operations/shared/method" },
      { id: "hospitality-service-operations", skillRef: "hospitality-service-operations/shared/method" },
      { id: "life-sciences-regulatory", skillRef: "life-sciences-regulatory/shared/method" },
      { id: "academic-paper-review", skillRef: "academic-paper-review/shared/academic-paper-review-method" },
    ])
    expect(result.projections.map(({ id, agentCount }) => ({ id, agentCount }))).toEqual([
      { id: "insurance-claims-operations", agentCount: 4 },
      { id: "energy-utilities-planning", agentCount: 4 },
      { id: "agriculture-food-systems", agentCount: 4 },
      { id: "construction-project-controls", agentCount: 4 },
      { id: "telecom-network-assurance", agentCount: 4 },
      { id: "public-sector-service-delivery", agentCount: 4 },
      { id: "nonprofit-grant-operations", agentCount: 4 },
      { id: "hospitality-service-operations", agentCount: 4 },
      { id: "life-sciences-regulatory", agentCount: 4 },
      { id: "academic-paper-review", agentCount: 8 },
    ])
    expect(result.projections.every((entry) => entry.rootCount === 3 && entry.joinCount === 1)).toBe(true)
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 0)
