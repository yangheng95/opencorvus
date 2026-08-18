import path from "path"
import { generateExpertSquadPayloadModule } from "./generate-expert-squad-payload"
import { generateExpertSquadSearchLocalizationModule } from "./generate-expert-squad-search-localization"
import { generateBuiltinSkillPayloadModule } from "./generate-builtin-skill-payload"
import { generateBuiltinMissionSkillPayloadModule } from "./generate-builtin-mission-skill-payload"
import { generateWorkArtifactQualificationMatrix } from "./generate-work-artifact-qualification-matrix"

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
  await generateExpertSquadSearchLocalizationModule(repoRoot)
  log("Generated expert-squad search localization module")
  await generateBuiltinSkillPayloadModule(repoRoot)
  log("Generated built-in Skill payload module")
  await generateBuiltinMissionSkillPayloadModule(repoRoot)
  log("Generated built-in Mission Skill payload module")
  await generateWorkArtifactQualificationMatrix(packageRoot)
  log("Generated Work Artifact qualification matrix")
}
