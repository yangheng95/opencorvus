import fs from "node:fs/promises"
import path from "node:path"
import { Instance } from "@/project/instance"
import { Tool } from "@/tool/tool"
import { MissionStateTool } from "@/tool/mission-state"

const [projectPath, sessionID, baseRevision, barrierPath, workerID, content] = process.argv.slice(2)
if (!projectPath || !sessionID || !baseRevision || !barrierPath || !workerID || content === undefined) {
  throw new Error("Mission state process worker requires project, Session, revision, barrier, worker ID, and content.")
}

await fs.mkdir(barrierPath, { recursive: true })
await fs.writeFile(path.join(barrierPath, `${workerID}.ready`), "ready")
const deadline = Date.now() + 30_000
while (true) {
  try {
    await fs.access(path.join(barrierPath, "go"))
    break
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
    if (Date.now() >= deadline) throw new Error("Mission state process worker timed out waiting for the barrier.")
    await Bun.sleep(10)
  }
}

await Instance.provide({
  directory: projectPath,
  fn: async () => {
    const missionState = await MissionStateTool.init()
    try {
      const result = await missionState.execute(
        {
          action: "commit",
          base_revision: baseRevision,
          updates: [{ file: "frontier.md", content }],
        },
        {
          sessionID,
          messageID: `mission-state-worker-${workerID}`,
          agent: "mission",
          abort: new AbortController().signal,
          messages: [],
          executionSurface: Tool.executionSurface(["mission_state"], []),
          metadata() {},
        },
      )
      process.stdout.write(`MISSION_STATE_PROCESS_RESULT=${JSON.stringify({ workerID, status: "committed", output: JSON.parse(result.output) })}\n`)
    } catch (error) {
      process.stdout.write(
        `MISSION_STATE_PROCESS_RESULT=${JSON.stringify({
          workerID,
          status: "rejected",
          name: error instanceof Error ? error.name : null,
          message: error instanceof Error ? error.message : String(error),
        })}\n`,
      )
    }
  },
})
