import path from "path"

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

  // The build entry binds its validation environment before runtime-backed
  // generators evaluate Global and initialize application directories.
  const { generateExpertSquadPayloadModule } = await import("./generate-expert-squad-payload")
  const { generateExpertSquadSearchLocalizationModule } = await import("./generate-expert-squad-search-localization")
  const { generateBuiltinSkillPayloadModule } = await import("./generate-builtin-skill-payload")
  const { generateBuiltinMissionSkillPayloadModule } = await import("./generate-builtin-mission-skill-payload")
  const { generateWorkArtifactQualificationMatrix } = await import("./generate-work-artifact-qualification-matrix")

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
