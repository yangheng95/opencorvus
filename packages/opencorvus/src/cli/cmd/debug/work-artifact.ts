import { EOL } from "node:os"
import { bootstrap } from "../../bootstrap"
import { runPackagedWorkArtifactAcceptance } from "../../../work-artifact/packaged-acceptance"
import { isCompiledBinaryRuntime } from "../../../runtime/compiled-binary"
import { cmd } from "../cmd"

export const WorkArtifactLifecycleCommand = cmd({
  command: "work-artifact-lifecycle",
  describe: false,
  async handler() {
    if (process.env.OPENCORVUS_INTERNAL_WORK_ARTIFACT_ACCEPTANCE !== "1" || !isCompiledBinaryRuntime()) {
      throw new Error("Packaged Work Artifact acceptance is available only to the isolated release checker")
    }
    const result = await bootstrap(process.env.OPENCORVUS_ORIGINAL_CWD ?? process.cwd(), () => runPackagedWorkArtifactAcceptance())
    process.stdout.write(`OPENCORVUS_WORK_ARTIFACT_ACCEPTANCE=${JSON.stringify(result)}${EOL}`)
  },
})

export const WorkArtifactAcceptanceDebugCommand = cmd({
  command: "debug",
  describe: false,
  builder: (yargs) => yargs.command(WorkArtifactLifecycleCommand).demandCommand(),
  async handler() {},
})
