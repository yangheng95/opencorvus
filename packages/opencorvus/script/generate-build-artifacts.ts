import path from "path"
import { generateExpertSquadPayloadModule } from "./generate-expert-squad-payload"
import { generateBuiltinSkillPayloadModule } from "./generate-builtin-skill-payload"
import { generateBuiltinMissionSkillPayloadModule } from "./generate-builtin-mission-skill-payload"

export async function generateOpencorvusGeneratedBuildArtifacts(
  input: {
    packageRoot?: string
    repoRoot?: string
    log?: (message: string) => void
  } = {},
) {
  const packageRoot = input.packageRoot ?? path.resolve(import.meta.dir, "..")
  const repoRoot = input.repoRoot ?? path.resolve(packageRoot, "../..")
  const log = input.log ?? (() => {})

  await generateExpertSquadPayloadModule(repoRoot)
  log("Generated expert-squad payload module")
  await generateBuiltinSkillPayloadModule(repoRoot)
  log("Generated built-in Skill payload module")
  await generateBuiltinMissionSkillPayloadModule(repoRoot)
  log("Generated built-in Mission Skill payload module")
}
