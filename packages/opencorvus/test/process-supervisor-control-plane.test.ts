import { describe, expect, test } from "bun:test"
import { ProcessSupervisor } from "../src/shell/process-supervisor"
import { SessionContext } from "../src/session/context"
import { Ripgrep } from "../src/file/ripgrep"
import { sampledSkillSupportingFilePaths } from "../src/tool/skill"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

describe("ProcessSupervisor control-plane authority", () => {
  test("executes a control-plane process while the Task Capsule runtime is configured", async () => {
    const previousDescriptor = process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencorvus-host-ripgrep-"))
    await writeFile(path.join(directory, "host-control.txt"), "host control plane\n")
    await writeFile(path.join(directory, "SKILL.md"), "# Host-owned projected Skill\n")
    await mkdir(path.join(directory, "references"))
    await writeFile(path.join(directory, "references", "contract.md"), "projected Skill supporting evidence\n")
    process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = "/configured/task-capsule-runtime.json"
    try {
      const nonTaskSession = { id: "mission-control-session" } as Parameters<typeof SessionContext.provide>[0]
      const handle = await SessionContext.provide(nonTaskSession, () =>
        ProcessSupervisor.spawnHostCommand({
          executable: process.execPath,
          args: ["-e", "process.stdout.write('host-control-plane')"],
          owner: "process-supervisor-control-plane-contract",
        }),
      )
      let stdout = ""
      handle.stdout?.setEncoding("utf8")
      handle.stdout?.on("data", (chunk) => (stdout += String(chunk)))
      const exitCode = await handle.exited
      await ProcessSupervisor.disposeAndWaitForExit(handle, "control-plane contract process")
      const files: string[] = []
      for await (const file of Ripgrep.filesForHost({ cwd: directory })) files.push(file)
      const sampledSkillFiles = await sampledSkillSupportingFilePaths(directory)

      expect({
        exitCode,
        stdout,
        files: files.map((file) => file.replaceAll("\\", "/")).sort(),
        sampledSkillFiles,
      }).toEqual({
        exitCode: 0,
        stdout: "host-control-plane",
        files: ["SKILL.md", "host-control.txt", "references/contract.md"],
        sampledSkillFiles: ["host-control.txt", "references/contract.md"],
      })
    } finally {
      if (previousDescriptor === undefined) delete process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR
      else process.env.OPENCORVUS_EXECUTION_CAPSULE_DESCRIPTOR = previousDescriptor
      await rm(directory, { recursive: true, force: true })
    }
  })
})
