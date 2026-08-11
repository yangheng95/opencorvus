import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("serves the seventh ten Skill-and-asset domain Squads through isolated production HTTP routes", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-seventh-domain-http-"))
  const probe = path.join(import.meta.dir, "seventh-domain-expansion-production-route-probe.ts")
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
    if (exitCode !== 0) throw new Error("Seventh-domain production-route probe failed (" + exitCode + "): " + stderr)
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
        "public-health-surveillance",
        "medical-imaging-quality-assurance",
        "veterinary-care-operations",
        "industrial-hygiene-exposure-assessment",
        "battery-safety-reliability",
        "materials-failure-analysis",
        "digital-forensics-incident-investigation",
        "anti-money-laundering-compliance",
        "customs-trade-compliance",
        "forestry-wildfire-resource-management",
      ].map((id) => ({ id, skillRef: id + "/shared/method" })),
    )
    expect(
      result.projections.map(({ id, agentCount, rootCount, joinCount }) => ({ id, agentCount, rootCount, joinCount })),
    ).toEqual([
      { id: "public-health-surveillance", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "medical-imaging-quality-assurance", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "veterinary-care-operations", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "industrial-hygiene-exposure-assessment", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "battery-safety-reliability", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "materials-failure-analysis", agentCount: 4, rootCount: 3, joinCount: 1 },
      { id: "digital-forensics-incident-investigation", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "anti-money-laundering-compliance", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "customs-trade-compliance", agentCount: 5, rootCount: 4, joinCount: 1 },
      { id: "forestry-wildfire-resource-management", agentCount: 5, rootCount: 4, joinCount: 1 },
    ])
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
