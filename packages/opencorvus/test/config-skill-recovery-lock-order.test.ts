import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { Global } from "@/global"
import { removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"

test("published Skill recovery and a concurrent Config writer settle one catalog revision", async () => {
  const root = await fs.mkdtemp(path.join(path.dirname(Global.Path.temporary), "config-skill-recovery-"))
  const env = { ...process.env, OPENCORVUS_HOME: root }
  delete env.OPENCORVUS_TEST_HOME
  delete env.OPENCORVUS_TEST_PROCESS_ROOT
  async function run(args: string[]) {
    const child = Bun.spawn(
      [process.execPath, path.join(import.meta.dir, "fixture/skill-replacement-child.ts"), ...args],
      {
        cwd: path.join(import.meta.dir, ".."),
        env,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    const timer = setTimeout(() => child.kill(), 30000)
    try {
      const [exit, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      return { exit, stdout, stderr }
    } finally {
      clearTimeout(timer)
    }
  }
  try {
    const setup = await run(["setup"])
    expect(setup.exit, setup.stderr).toBe(0)
    const { projectID } = JSON.parse(setup.stdout.trim().split(/\r?\n/).at(-1)!)
    // This owned child is deliberately terminated at its durable publication
    // cut; the next process must recover that exact pending configuration.
    await run(["import-cut", projectID, "catalog-published"])
    const result = await run(["recover-with-config-writer", projectID])
    expect(result.exit, result.stderr).toBe(0)
    expect(JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1)!)).toEqual({
      username: "recovered-concurrent-writer",
      terminal: "committed",
      skills: [
        { name: "replacement-alpha", description: "new replacement-alpha", policy: "deny" },
        { name: "replacement-beta", description: "new replacement-beta", policy: "deny" },
      ],
    })
  } finally {
    await removeManagedDirectoryTree(root)
  }
}, 100000)
