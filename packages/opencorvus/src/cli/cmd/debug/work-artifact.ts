import { EOL } from "node:os"
import { bootstrap } from "../../bootstrap"
import { runPackagedWorkArtifactAcceptance } from "../../../work-artifact/packaged-acceptance"
import { cmd } from "../cmd"

export const WorkArtifactLifecycleCommand = cmd({
  command: "work-artifact-lifecycle",
  describe: false,
  async handler() {
    const standalone = (Bun as unknown as { isStandaloneExecutable?: boolean }).isStandaloneExecutable === true
    if (process.env.OPENCORVUS_INTERNAL_WORK_ARTIFACT_ACCEPTANCE !== "1" || !standalone) {
      throw new Error("Packaged Work Artifact acceptance is available only to the isolated release checker")
    }
    const result = await bootstrap(process.env.OPENCORVUS_ORIGINAL_CWD ?? process.cwd(), () => runPackagedWorkArtifactAcceptance())
    process.stdout.write(`OPENCORVUS_WORK_ARTIFACT_ACCEPTANCE=${JSON.stringify(result)}${EOL}`)
  },
})
