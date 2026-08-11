import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves the fourth ten Skill-and-asset domain Squads through isolated production HTTP routes", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-fourth-domain-http-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "fourth-domain-expansion-production-route-probe.ts")

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
    if (exitCode !== 0) throw new Error("Fourth-domain production-route probe failed (" + exitCode + "): " + stderr)

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
      { id: "aviation-maintenance-reliability", skillRef: "aviation-maintenance-reliability/shared/method" },
      { id: "semiconductor-yield-engineering", skillRef: "semiconductor-yield-engineering/shared/method" },
      { id: "climate-risk-adaptation", skillRef: "climate-risk-adaptation/shared/method" },
      { id: "geospatial-analysis-cartography", skillRef: "geospatial-analysis-cartography/shared/method" },
      { id: "cultural-heritage-preservation", skillRef: "cultural-heritage-preservation/shared/method" },
      { id: "sports-performance-analysis", skillRef: "sports-performance-analysis/shared/method" },
      { id: "clinical-trial-operations", skillRef: "clinical-trial-operations/shared/method" },
      { id: "media-rights-clearance", skillRef: "media-rights-clearance/shared/method" },
      { id: "emergency-management-continuity", skillRef: "emergency-management-continuity/shared/method" },
      { id: "mining-resource-operations", skillRef: "mining-resource-operations/shared/method" },
    ])
    expect(
      result.projections.map(({ id, agentCount, rootCount, joinCount }) => ({ id, agentCount, rootCount, joinCount })),
    ).toEqual([
      { id: "aviation-maintenance-reliability", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "semiconductor-yield-engineering", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "climate-risk-adaptation", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "geospatial-analysis-cartography", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "cultural-heritage-preservation", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "sports-performance-analysis", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "clinical-trial-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "media-rights-clearance", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "emergency-management-continuity", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "mining-resource-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
    ])
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
