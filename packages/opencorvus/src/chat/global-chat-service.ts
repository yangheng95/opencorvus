import { ImplicitProject } from "@/project/implicit-project"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { createRightSidebarConversationSession, type ConversationExperience } from "./session"
import { Config } from "@/config/config"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { deleteProject } from "@/project/delete"
import { randomUUID } from "node:crypto"
import { GlobalCreationAllocation } from "@/project/global-creation-allocation"
import type { Database } from "@/storage/db"
import type { Session } from "@/session"

export namespace GlobalConversationService {
  export async function preflight(input: { model?: string; configSnapshot: Config.Info }) {
    const overlay = Config.Overlay.parse({
      ...(input.model ? { model: input.model } : input.configSnapshot.model ? { model: input.configSnapshot.model } : {}),
      prompt_profile: { active: input.configSnapshot.prompt_profile.active },
    })
    const preview = Config.previewOverlayUpdate(input.configSnapshot, {}, overlay)
    await validateConfigModelReferences(preview.effective, "globalConversation.configOverlay", "global")
    return { initialOverlay: preview.nextOverlay }
  }

  export async function create(input: {
    experience: ConversationExperience
    model?: string
    sessionID?: string
    creationMetadata?: Record<string, unknown>
    creationAllocation?: Parameters<typeof GlobalCreationAllocation.materializeProject>[0]
    configSnapshot?: Config.Info
    commitInTransaction?: (db: Database.TxOrDb, session: Session.Info) => void
  }) {
    const configSnapshot = input.configSnapshot ?? (await Config.getGlobal())
    const preflight = await GlobalConversationService.preflight({ model: input.model, configSnapshot })
    const carryingProject = input.creationAllocation
      ? await GlobalCreationAllocation.materializeProject(input.creationAllocation)
      : await ImplicitProject.create()
    try {
      return await Instance.provide({
        directory: carryingProject.directory,
        init: InstanceBootstrap,
        fn: async () => {
          const session = await createRightSidebarConversationSession(input.experience, {
            id: input.sessionID,
            configOverlay: preflight.initialOverlay,
            creationMetadata: input.creationMetadata,
            commitInTransaction: input.commitInTransaction,
          })
          return { session }
        },
      })
    } catch (error) {
      if (input.creationAllocation) throw error
      await deleteProject(carryingProject.project, {
        actor: "user",
        source: "project.delete",
        surface: "api",
        requestID: randomUUID(),
        reason: "Discard failed global conversation Project creation",
      })
      throw error
    }
  }
}
