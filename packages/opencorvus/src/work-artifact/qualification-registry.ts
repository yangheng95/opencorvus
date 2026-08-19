import { GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX } from "./qualification-matrix.generated"

export const WORK_ARTIFACT_QUALIFICATION_IDS = [GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.qualification] as const
export type WorkArtifactQualificationID = (typeof WORK_ARTIFACT_QUALIFICATION_IDS)[number]

export type WorkArtifactQualification = Readonly<{
  id: WorkArtifactQualificationID
  profile: "office.presentation@1"
  isolationLevel: "adapter_inputs_only"
  checker: Readonly<{
    script: "script/check-work-artifact-profile.ts"
    catalogArgs: readonly string[]
    packagedArgs: readonly string[]
  }>
  requiredEvidence: readonly [
    "skill_projection",
    "tool_schema",
    "runtime_lock",
    "target_package_manifest",
    "runtime_smoke",
    "compiled_opencorvus_typed_lifecycle",
    "canonical_validation_receipt",
    "fresh_delivery_revalidation",
  ]
}>

const officePresentationQualification: WorkArtifactQualification = Object.freeze({
  id: GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.qualification,
  profile: GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.profile,
  isolationLevel: GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.isolation_level,
  checker: Object.freeze({
    script: "script/check-work-artifact-profile.ts",
    catalogArgs: Object.freeze(["--profile", "office.presentation@1"]),
    packagedArgs: Object.freeze([
      "--profile",
      "office.presentation@1",
      "--package-root",
      "<package-root>",
    ]),
  }),
  requiredEvidence: GENERATED_WORK_ARTIFACT_QUALIFICATION_MATRIX.required_evidence,
})

const qualifications = new Map<WorkArtifactQualificationID, WorkArtifactQualification>([
  [
    "office-presentation-packaged-lifecycle@1",
    officePresentationQualification,
  ],
])

export const WorkArtifactQualificationRegistry = Object.freeze({
  require(id: WorkArtifactQualificationID): WorkArtifactQualification {
    const qualification = qualifications.get(id)
    if (!qualification) throw new Error(`Unknown Work Artifact qualification: ${id}`)
    return qualification
  },
})
