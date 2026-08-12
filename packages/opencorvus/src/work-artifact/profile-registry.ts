export const WORK_ARTIFACT_PROFILE_IDS = ["office.presentation@1"] as const
export type WorkArtifactProfileID = (typeof WORK_ARTIFACT_PROFILE_IDS)[number]

export const WORK_ARTIFACT_OPERATION_IDS = ["inspect", "author", "validate", "deliver"] as const
export type WorkArtifactOperationID = (typeof WORK_ARTIFACT_OPERATION_IDS)[number]

export const WORK_ARTIFACT_TOOL_IDS = [
  "work_artifact_inspect",
  "work_artifact_author",
  "work_artifact_validate",
  "work_artifact_deliver",
] as const

export const WORK_ARTIFACT_PARENT_ONLY_TOOL_IDS = ["work_artifact_deliver"] as const
export const WORK_ARTIFACT_PRESENTATION_TOOL_SCHEMA_REVISION = "work-artifact-presentation@1" as const
export const OFFICE_PRESENTATION_PROFILE_LIMITS = Object.freeze({
  inputBytes: 80 * 1024 * 1024,
  outputBytes: 80 * 1024 * 1024,
  pagesOrFrames: 40,
  wallClockMs: 120_000,
  parserWallClockMs: 10_000,
})
export type WorkArtifactProfile = Readonly<{
  id: WorkArtifactProfileID
  mimeTypes: readonly string[]
  operations: readonly WorkArtifactOperationID[]
  toolSchemaRevision: string
  skillName: "work-artifacts"
  skillResources: readonly string[]
  runtimes: readonly string[]
  releaseTargets: readonly Readonly<{ os: "darwin" | "linux" | "win32"; arch: "arm64" | "x64" }>[]
  qualification: "office-presentation-packaged-lifecycle@1"
  networkIsolation: "adapter_inputs_only"
  limits: Readonly<{
    inputBytes: number
    outputBytes: number
    pagesOrFrames: number
    wallClockMs: number
    parserWallClockMs: number
  }>
}>

const officePresentationProfile: WorkArtifactProfile = Object.freeze({
  id: "office.presentation@1",
  mimeTypes: Object.freeze([
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ]),
  operations: WORK_ARTIFACT_OPERATION_IDS,
  toolSchemaRevision: WORK_ARTIFACT_PRESENTATION_TOOL_SCHEMA_REVISION,
  skillName: "work-artifacts",
  skillResources: Object.freeze([
    "references/common-lifecycle.md",
    "references/office-presentation.md",
    "references/review.md",
    "references/security.md",
  ]),
  runtimes: Object.freeze(["officecli"]),
  releaseTargets: Object.freeze([
    Object.freeze({ os: "win32", arch: "x64" }),
    Object.freeze({ os: "darwin", arch: "x64" }),
    Object.freeze({ os: "darwin", arch: "arm64" }),
    Object.freeze({ os: "linux", arch: "x64" }),
    Object.freeze({ os: "linux", arch: "arm64" }),
  ]),
  qualification: "office-presentation-packaged-lifecycle@1",
  networkIsolation: "adapter_inputs_only",
  limits: OFFICE_PRESENTATION_PROFILE_LIMITS,
})

const profiles = new Map<WorkArtifactProfileID, WorkArtifactProfile>([
  [
    "office.presentation@1",
    officePresentationProfile,
  ],
])

export const WorkArtifactProfileRegistry = Object.freeze({
  all(): readonly WorkArtifactProfile[] {
    return WORK_ARTIFACT_PROFILE_IDS.map((id) => profiles.get(id)!)
  },
  require(id: WorkArtifactProfileID): WorkArtifactProfile {
    const profile = profiles.get(id)
    if (!profile) throw new Error(`Unknown qualified Work Artifact profile: ${id}`)
    return profile
  },
  supports(id: WorkArtifactProfileID, operation: WorkArtifactOperationID): boolean {
    return profiles.get(id)?.operations.includes(operation) ?? false
  },
})
