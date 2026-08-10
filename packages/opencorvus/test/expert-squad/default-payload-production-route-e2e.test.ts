import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"

test("full production HTTP bootstrap installs every repository-hosted Expert Squad by default", async () => {
  const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-default-payload-http-"))
  const isolatedHome = path.join(isolatedRoot, "home")
  const isolatedProject = path.join(isolatedRoot, "project")
  const probe = path.join(import.meta.dir, "default-payload-production-route-probe.ts")

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
    if (exitCode !== 0) throw new Error(`Default payload production-route probe failed (${exitCode}): ${stderr}`)

    const outputLine = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .at(-1)
    const result = JSON.parse(outputLine ?? "null") as {
      payloadCount: number
      installedByDefault: number
      requestCount: number
      activeSquadID: string
      removedDisposition: string
      modifiedDisposition: string
      modifiedUpdateAvailable: boolean
    }

    expect(result).toEqual({
      payloadCount: 35,
      installedByDefault: 35,
      requestCount: 7,
      activeSquadID: "base",
      removedID: "browser-research-acceptance",
      removedDisposition: "removed",
      modifiedID: "cloud-platform-architecture",
      modifiedDisposition: "modified",
      modifiedUpdateAvailable: true,
    })
  } finally {
    await fs.rm(isolatedRoot, { recursive: true, force: true })
  }
}, 180_000)
