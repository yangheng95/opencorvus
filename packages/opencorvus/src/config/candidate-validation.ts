import { PromptProfile } from "@/agent/prompt-profile"
import { ConversationCapability } from "@/conversation/capability"
import { PromptProfileResolver } from "@/expert-squad/prompt-profile-resolver"
import { NamedError } from "@opencorvus-ai/util/error"
import z from "zod"
import type { Config } from "./config"
import { validateConfigModelReferences } from "./model-reference-validation"
import { SkillReadDiagnostics } from "@/skill/read-diagnostics"

export const ConfigCandidateValidationError = NamedError.create(
  "ConfigCandidateValidationError",
  z.object({ message: z.string() }),
)

export async function validateConfigCandidate(input: {
  config: Config.Info
  root: string
  projectDirectory?: string
  projectOwnedCapabilities?: boolean
  providerScope?: "project" | "global"
}) {
  await SkillReadDiagnostics.phase("config.validate.models", () =>
    validateConfigModelReferences(input.config, input.root, input.providerScope),
  )
  try {
    await SkillReadDiagnostics.phase("config.validate.profile", () =>
      PromptProfileResolver.assertKnownProfileID({
        ...(input.providerScope === "global"
          ? { scope: "global" as const }
          : { projectDirectory: input.projectDirectory! }),
        profileID: PromptProfile.activeID(input.config),
        config: input.config,
      }),
    )
    if (!input.projectOwnedCapabilities) return
    if (input.config.skill_mounts) {
      await SkillReadDiagnostics.phase("config.validate.mounts", () =>
        PromptProfileResolver.assertSkillMountConfig({
          projectDirectory: input.projectDirectory!,
          config: input.config,
        }),
      )
    }
    await SkillReadDiagnostics.phase("config.validate.capabilities", () =>
      ConversationCapability.assertConfig(input.config),
    )
  } catch (error) {
    if (ConversationCapability.InvalidAssignmentError.isInstance(error)) throw error
    throw new ConfigCandidateValidationError({
      message: error instanceof Error ? error.message : String(error),
    })
  }
}
