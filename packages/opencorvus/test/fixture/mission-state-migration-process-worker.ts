import { Instance } from "@/project/instance"
import { Tool } from "@/tool/tool"
import { MissionStateTestHooks, MissionStateTool } from "@/tool/mission-state"

const [mode, projectPath, sessionID] = process.argv.slice(2)
if ((mode !== "crash" && mode !== "recover") || !projectPath || !sessionID) {
  throw new Error("Mission state migration worker requires crash|recover, project, and Session.")
}

await Instance.provide({
  directory: projectPath,
  fn: async () => {
    using _cut =
      mode === "crash"
        ? MissionStateTestHooks.installAfterLegacyDocumentPublication(() => process.exit(86))
        : undefined
    const missionState = await MissionStateTool.init()
    const result = await missionState.execute(
      { action: "snapshot" },
      {
        sessionID,
        messageID: "mission-state-migration-worker",
        agent: "mission",
        abort: new AbortController().signal,
        messages: [],
        executionSurface: Tool.executionSurface(["mission_state"], []),
        metadata() {},
      },
    )
    process.stdout.write(`MISSION_STATE_MIGRATION_RESULT=${result.output}\n`)
  },
})
