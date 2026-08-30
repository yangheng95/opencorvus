import { describe, expect, test } from "bun:test"
import fs, { readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { payloadPackageSources } from "../../generated/expert-squad-payload"
import { ExpertSquadRegistry } from "../../src/expert-squad/registry"

describe("Expert Squad package snapshot publication", () => {
  test("publishes one complete embedded package at its content digest", async () => {
    const base = payloadPackageSources[0]!
    const readme = `${base.files["README.md"]}\nSnapshot publication contract.\n`
    const source = { ...base, files: { ...base.files, "README.md": readme } }

    const snapshot = await ExpertSquadRegistry.materializeEmbeddedPackageSnapshot(source)

    expect(snapshot.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(path.basename(snapshot.root)).toBe(snapshot.digest)
    expect(await ExpertSquadRegistry.packageDigest(snapshot.root)).toBe(snapshot.digest)
    expect(await readFile(path.join(snapshot.root, "README.md"), "utf8")).toBe(readme)
  })

  test("converges two process publishers on one verified content-addressed snapshot", async () => {
    const isolatedRoot = await fs.mkdtemp(path.join(os.tmpdir(), "opencorvus-package-snapshot-race-"))
    const barrierRoot = path.join(isolatedRoot, "barrier")
    const worker = path.join(import.meta.dir, "package-snapshot-publication-process-worker.ts")
    await fs.mkdir(barrierRoot, { recursive: true })
    const children = ["one", "two"].map((workerID) =>
      Bun.spawn([process.execPath, worker, barrierRoot, workerID], {
        cwd: path.resolve(import.meta.dir, "../../../.."),
        env: { ...Bun.env, OPENCORVUS_HOME: path.join(isolatedRoot, "runtime") },
        stdout: "pipe",
        stderr: "pipe",
      }),
    )

    try {
      for (const workerID of ["one", "two"]) {
        const ready = path.join(barrierRoot, `ready-${workerID}`)
        const deadline = Date.now() + 10_000
        while (true) {
          try {
            await fs.access(ready)
            break
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
            if (Date.now() >= deadline) throw new Error(`Timed out waiting for snapshot worker ${workerID}`)
            await Bun.sleep(10)
          }
        }
      }
      await fs.writeFile(path.join(barrierRoot, "release"), "release", { flag: "wx" })

      const results = await Promise.all(
        children.map(async (child) => {
          const [exitCode, stdout, stderr] = await Promise.all([
            child.exited,
            new Response(child.stdout).text(),
            new Response(child.stderr).text(),
          ])
          if (exitCode !== 0) throw new Error(`Snapshot publication worker failed (${exitCode}): ${stderr}`)
          return JSON.parse(stdout.trim().split(/\r?\n/).filter(Boolean).at(-1) ?? "null") as {
            root: string
            digest: string
          }
        }),
      )

      expect(results[0]).toEqual(results[1])
      expect(path.basename(results[0]!.root)).toBe(results[0]!.digest)
      expect(await ExpertSquadRegistry.packageDigest(results[0]!.root)).toBe(results[0]!.digest)
    } finally {
      for (const child of children) {
        try {
          child.kill()
        } catch {}
      }
      await Promise.all(children.map((child) => child.exited.catch(() => -1)))
      await fs.rm(isolatedRoot, { recursive: true, force: true })
    }
  }, 30_000)
})
