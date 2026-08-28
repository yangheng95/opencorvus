import { ImplicitProject } from "@/project/implicit-project"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { createRightSidebarConversationSession, type ConversationExperience } from "./session"
import { Config } from "@/config/config"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { deleteProject } from "@/project/delete"
import { randomUUID } from "node:crypto"

export namespace GlobalConversationService {
  export async function create(input: {
    experience: ConversationExperience
    model?: string
    sessionID?: string
    creationMetadata?: Record<string, unknown>
  }) {
    const carryingProject = await ImplicitProject.create()
    try {
      return await Instance.provide({
        directory: carryingProject.directory,
        init: InstanceBootstrap,
        fn: async () => {
          let initialOverlay: Record<string, unknown> | undefined
          if (input.model) {
            const base = await Config.get()
            const overlay = Config.Overlay.parse({ model: input.model })
            const preview = Config.previewOverlayUpdate(base, {}, overlay)
            await validateConfigModelReferences(preview.effective, "globalConversation.configOverlay")
            initialOverlay = preview.nextOverlay
          }
          const session = await createRightSidebarConversationSession(input.experience, {
            id: input.sessionID,
            configOverlay: initialOverlay,
            creationMetadata: input.creationMetadata,
          })
          return { session }
        },
      })
    } catch (error) {
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
