import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { memoryProject } from "../fixture/memory"

test("Mission recovery retains the interrupted occurrence while another Tool still awaits approval", async () => {
  await using project = await memoryProject()
  const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
  if (!root) throw new Error("Isolated process root required")
  const scope = await createManagedTemporaryDirectory(root, "permission-mission-")
  const stateFile = path.join(scope, "owner.json"),
    filePath = path.join(scope, "source.txt")
  await fs.writeFile(filePath, "Mission permission recovery source.\n")
  const children: ReturnType<typeof Bun.spawn>[] = []
  const run = async (mode: string, expected: number) => {
    const child = Bun.spawn(
      [
        process.execPath,
        `--config=${path.resolve(import.meta.dir, "../empty-bunfig.toml")}`,
        path.resolve(import.meta.dir, "../fixture/permission-message-owner-worker.ts"),
        mode,
        project.path,
        filePath,
        stateFile,
      ],
      {
        cwd: path.resolve(import.meta.dir, "../.."),
        env: { ...process.env, OPENCORVUS_HOME: path.join(scope, "runtime") },
        stdout: "pipe",
        stderr: "pipe",
      },
    )
    children.push(child)
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(code, stderr).toBe(expected)
    return JSON.parse(stdout)
  }
  try {
    const cut = await run("mission-cut", 86)
    const evidence = await run("inspect-mission", 0)
    console.log("permission-process-phase " + JSON.stringify({ cut: "mission-pending", evidence }))
    expect(evidence.observed).toMatchObject({ observation: "dead_or_reused", authority: cut.owner })
    expect(evidence.outcome).toBe("resumed")
    expect(
      evidence.after.parts.find(
        (part: { type: string; callID?: string }) => part.type === "tool" && part.callID === cut.request.toolCallID,
      ),
    ).toMatchObject({ state: { status: "completed" } })
    expect(
      evidence.after.parts.find(
        (part: { type: string; callID?: string }) => part.type === "tool" && part.callID === cut.pending.toolCallID,
      ),
    ).toMatchObject({ state: { status: "error", failure: { kind: "process-execution-interrupted" } } })
    expect(evidence.after.parts.filter((part: { type: string }) => part.type === "source-file")).toEqual(
      evidence.before.parts.filter((part: { type: string }) => part.type === "source-file"),
    )
    expect(evidence.missionRecovery).toMatchObject({ status: "woken", sessionID: cut.request.sessionID })
  } finally {
    for (const child of children) if (child.exitCode === null) child.kill()
    await Promise.all(children.map((child) => child.exited))
    await removeManagedDirectoryTree(scope)
  }
}, 120_000)
