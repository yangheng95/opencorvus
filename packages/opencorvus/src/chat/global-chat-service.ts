import { ImplicitProject } from "@/project/implicit-project"
import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { createRightSidebarConversationSession, type ConversationExperience } from "./session"
import { Config } from "@/config/config"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { Session } from "@/session"

export namespace GlobalConversationService {
  export async function create(input: { experience: ConversationExperience; model?: string }) {
    const carryingProject = await ImplicitProject.create()
    try {
      return await Instance.provide({
        directory: carryingProject.directory,
        init: InstanceBootstrap,
        fn: async () => {
          const overlay = Config.Overlay.parse(input.model ? { model: input.model } : {})
          if (input.model) {
            const base = await Config.get()
            const preview = Config.previewOverlayUpdate(base, {}, overlay)
            await validateConfigModelReferences(preview.effective, "globalConversation.configOverlay")
          }
          const session = await createRightSidebarConversationSession(input.experience)
          if (input.model) {
            await Session.mergeConfigOverlayInProject({
              sessionID: session.id,
              projectID: session.projectID,
              patch: overlay,
            })
          }
          return { session: await Session.get(session.id) }
        },
      })
    } catch (error) {
      await carryingProject.discard()
      throw error
    }
  }
}
