import path from "path"
import { fileURLToPath } from "node:url"
import { $ } from "bun"

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

  // Generators consume the SDK's authoring source before its first dist exists.
  // Keep source resolution at this common boundary for every build entry.
  const script = fileURLToPath(import.meta.url)
  for await (const line of $`${process.execPath} --conditions=source ${script} ${packageRoot} ${repoRoot}`
    .cwd(repoRoot)
    .lines()) {
    log(line)
  }
}

async function generate(packageRoot: string, repoRoot: string) {
  const log = console.log
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

if (import.meta.main) {
  const [packageRoot, repoRoot] = process.argv.slice(2)
  if (!packageRoot || !repoRoot) throw new Error("Usage: generate-build-artifacts.ts <package-root> <repo-root>")
  await generate(path.resolve(packageRoot), path.resolve(repoRoot))
}
