import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { memoryProject } from "../fixture/memory"

for (const cut of ["receipt-cut", "transaction-cut", "mission-cut"] as const) {
  test(`an actual process exit at ${cut} recovers the original completed result once`, async () => {
    await using project = await memoryProject()
    const processRoot = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!processRoot) throw new Error("Isolated process root required")
    const scope = await createManagedTemporaryDirectory(processRoot, `result-process-${cut}-`)
    const filePath = path.join(scope, "source.txt"), stateFile = path.join(scope, "state.json")
    await fs.writeFile(filePath, "actual process recovery input\nsecond line\n")
    const children: ReturnType<typeof Bun.spawn>[] = []
    const run = async (mode: string, expectedExit: number) => {
      const child = Bun.spawn([
        process.execPath, `--config=${path.resolve(import.meta.dir, "../empty-bunfig.toml")}`,
        path.resolve(import.meta.dir, "../fixture/tool-result-recovery-process-worker.ts"),
        mode, project.path, filePath, stateFile,
      ], {
        cwd: path.resolve(import.meta.dir, "../.."),
        env: { ...process.env, OPENCORVUS_HOME: path.join(scope, "runtime"), OPENCORVUS_TEST_PROCESS_ROOT: processRoot },
        stdout: "pipe", stderr: "pipe",
      })
      children.push(child)
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited,
      ])
      expect(exitCode, stderr).toBe(expectedExit)
      return JSON.parse(stdout.trim())
    }
    try {
      const original = await run(cut, cut === "receipt-cut" ? 86 : cut === "transaction-cut" ? 87 : 88)
      expect(original.state.executeCount).toBe(1)
      const recovered = await run("recover", 0)
      if (cut === "mission-cut") expect(recovered.missionRecovery).toMatchObject({ status: "woken", sessionID: original.state.sessionID, attempt: 1 })
      expect(recovered.before.parts.find((part: any) => part.type === "tool")).toMatchObject({ state: { status: "running" } })
      expect(recovered.first.parts.find((part: any) => part.type === "tool")).toMatchObject({
        id: original.state.partID, state: { status: "completed", output: original.state.output },
      })
      expect(recovered.first.parts.filter((part: any) => part.type === "source-file")).toMatchObject(original.state.sources)
      expect(recovered.second).toEqual(recovered.first)
      expect({ starts: recovered.executionStarts, successes: recovered.executionSuccesses }).toEqual({ starts: 1, successes: 1 })
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.all(children.map((child) => child.exited))
      await removeManagedDirectoryTree(scope)
    }
  }, 120_000)
}
