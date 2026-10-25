import { GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX } from "./qualification-matrix.generated"

type MatrixEntry = (typeof GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX)[number]
export type WorkArtifactQualificationID = MatrixEntry["qualification"]
export const WORK_ARTIFACT_QUALIFICATION_IDS = GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.map(
  (entry) => entry.qualification,
)
export type WorkArtifactQualification = Readonly<{
  id: WorkArtifactQualificationID
  profile: MatrixEntry["profile"]
  isolationLevel: "adapter_inputs_only"
  checker: Readonly<{
    script: "script/check-work-artifact-profile.ts"
    catalogArgs: readonly string[]
    packagedArgs: readonly string[]
  }>
  requiredEvidence: MatrixEntry["required_evidence"]
}>
const qualifications = new Map<WorkArtifactQualificationID, WorkArtifactQualification>(
  GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.map((entry) => [
    entry.qualification,
    Object.freeze({
      id: entry.qualification,
      profile: entry.profile,
      isolationLevel: entry.isolation_level,
      checker: Object.freeze({
        script: "script/check-work-artifact-profile.ts" as const,
        catalogArgs: Object.freeze(["--profile", entry.profile]),
        packagedArgs: Object.freeze(["--profile", entry.profile, "--package-root", "<package-root>"]),
      }),
      requiredEvidence: entry.required_evidence,
    }),
  ]),
)
export const WorkArtifactQualificationRegistry = Object.freeze({
  require(id: WorkArtifactQualificationID): WorkArtifactQualification {
    const qualification = qualifications.get(id)
    if (!qualification) throw new Error(`Unknown Work Artifact qualification: ${id}`)
    return qualification
  },
})
