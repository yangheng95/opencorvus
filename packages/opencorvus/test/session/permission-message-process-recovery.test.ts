import { expect, test } from "bun:test"
import fs from "node:fs/promises"
import path from "node:path"
import { createManagedTemporaryDirectory, removeManagedDirectoryTree } from "@opencorvus-ai/util/runtime-directories"
import { memoryProject } from "../fixture/memory"

for (const cut of ["result", "part"] as const) {
  test(`Task permission recovery completes one real wait after the ${cut} process boundary`, async () => {
    await using project = await memoryProject()
    const root = process.env.OPENCORVUS_TEST_PROCESS_ROOT
    if (!root) throw new Error("Isolated process root required")
    const scope = await createManagedTemporaryDirectory(root, `permission-task-${cut}-`)
    const stateFile = path.join(scope, "state.json")
    const children: ReturnType<typeof Bun.spawn>[] = []
    const run = async (mode: string, expected: number) => {
      const child = Bun.spawn(
        [
          process.execPath,
          `--config=${path.resolve(import.meta.dir, "../empty-bunfig.toml")}`,
          path.resolve(import.meta.dir, "../fixture/tool-result-control-permission-process-worker.ts"),
          mode,
          project.path,
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
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
      ])
      if (stdout.trim())
        console.log("permission-process-phase " + JSON.stringify({ cut, mode, exitCode, evidence: JSON.parse(stdout) }))
      expect(exitCode, stderr).toBe(expected)
      return JSON.parse(stdout)
    }
    try {
      const initial = await run("init", 86)
      expect(initial).toMatchObject({
        assistant: {},
        part: { status: "running" },
        executionStarts: 0,
        executionSuccesses: 0,
      })
      const interrupted = await run(`cut-${cut}`, cut === "result" ? 87 : 88)
      expect(
        interrupted.requestFacts
          .filter((row: { event_type: string }) => row.event_type === "requested")
          .map((row: { request_id: string }) => row.request_id),
      ).toEqual([initial.requestFacts[0].request_id])
      expect(interrupted).toMatchObject({
        assistant: {},
        part: { status: cut === "result" ? "running" : "completed" },
        resultCount: 1,
        automationCount: 1,
        executionStarts: 1,
        executionSuccesses: 1,
      })
      const recovered = await run("recover", 0)
      console.log(
        "permission-process-evidence " +
          JSON.stringify({
            cut,
            initial,
            interrupted,
            recovered,
            identity: JSON.parse(await fs.readFile(stateFile, "utf8")),
          }),
      )
      expect(recovered.first).toMatchObject({
        assistant: { finish: "tool-calls", completed: expect.any(Number) },
        part: { status: "completed", control: { kind: "immediate_park" } },
        resultCount: 1,
        automationCount: 1,
        executionStarts: 1,
        executionSuccesses: 1,
      })
      expect(recovered.second).toEqual(recovered.first)
    } finally {
      for (const child of children) if (child.exitCode === null) child.kill()
      await Promise.all(children.map((child) => child.exited))
      await removeManagedDirectoryTree(scope)
    }
  }, 120_000)
}

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
