import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves the sixth ten Skill-and-asset domain Squads through isolated production HTTP routes", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-sixth-domain-http-"))
  const probe = path.join(import.meta.dir, "sixth-domain-expansion-production-route-probe.ts")
  try {
    const child = Bun.spawn([process.execPath, probe, path.join(isolatedRoot, "project")], {
      cwd: path.resolve(import.meta.dir, "../../../.."),
      env: { ...Bun.env, OPENCORVUS_HOME: path.join(isolatedRoot, "home") },
      stdout: "pipe",
      stderr: "pipe",
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    if (exitCode !== 0) throw new Error("Sixth-domain production-route probe failed (" + exitCode + "): " + stderr)
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
    expect(result.projections.map(({ id, skillRef }) => ({ id, skillRef }))).toEqual(
      [
        "satellite-mission-operations",
        "food-safety-quality",
        "privacy-data-protection-operations",
        "nuclear-facility-operations-safety",
        "payments-fraud-risk-operations",
        "biopharmaceutical-manufacturing-quality",
        "robotics-safety-validation",
        "forensic-accounting-investigations",
        "petroleum-well-integrity-operations",
        "urban-mobility-transport-planning",
      ].map((id) => ({ id, skillRef: id + "/shared/method" })),
    )
    expect(
      result.projections.map(({ id, agentCount, rootCount, joinCount }) => ({ id, agentCount, rootCount, joinCount })),
    ).toEqual([
      { id: "satellite-mission-operations", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "food-safety-quality", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "privacy-data-protection-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "nuclear-facility-operations-safety", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "payments-fraud-risk-operations", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "biopharmaceutical-manufacturing-quality", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "robotics-safety-validation", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "forensic-accounting-investigations", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "petroleum-well-integrity-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "urban-mobility-transport-planning", agentCount: 5, rootCount: 4, joinCount: 1 },
    ])
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
