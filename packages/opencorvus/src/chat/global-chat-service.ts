import { InstanceBootstrap } from "@/project/bootstrap"
import { Instance } from "@/project/instance"
import { createRightSidebarConversationSession, type ConversationExperience } from "./session"
import { Config } from "@/config/config"
import { validateConfigModelReferences } from "@/config/model-reference-validation"
import { randomUUID } from "node:crypto"
import {
  GlobalCreationAcceptedTargetConflictError,
  GlobalCreationAcceptedTargetUnavailableError,
  GlobalCreationAllocation,
} from "@/project/global-creation-allocation"
import { type Database, NotFoundError, isSqliteIdentityConstraintError } from "@/storage/db"
import { Session } from "@/session"
import {
  assertGlobalConversationCreationSession,
  globalConversationCreationKind,
  globalConversationCreationSessionID,
} from "@/engine/global-creation-target"

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
    sessionID: string
    creationMetadata?: Record<string, unknown>
    creationAllocation: Parameters<typeof GlobalCreationAllocation.materializeProject>[0]
    commitInTransaction?: (db: Database.TxOrDb, session: Session.Info) => void
  } & (
    | { initialConfigOverlay: Record<string, unknown>; model?: never; configSnapshot?: never }
    | { initialConfigOverlay?: never; model?: string; configSnapshot?: Config.Info }
  )) {
    const initialConfigOverlay = input.initialConfigOverlay ?? (
      await preflight({ model: input.model, configSnapshot: input.configSnapshot ?? await Config.getGlobal() })
    ).initialOverlay
    const carryingProject = await GlobalCreationAllocation.materializeProject(input.creationAllocation)
    return Instance.provide({
      directory: carryingProject.directory,
      init: InstanceBootstrap,
      fn: async () => ({
        session: await createRightSidebarConversationSession(input.experience, {
          id: input.sessionID,
          configOverlay: initialConfigOverlay,
          creationMetadata: input.creationMetadata,
          commitInTransaction: input.commitInTransaction,
        }),
      }),
    })
  }

  /** An empty global conversation owns the Project as well as its Session. */
  export async function createEmpty(input: { experience: ConversationExperience; requestID?: string; model?: string }) {
    const { experience, model } = input
    const requestID = input.requestID ?? randomUUID()
    const kind = globalConversationCreationKind(experience)
    const sessionID = globalConversationCreationSessionID(kind, requestID)
    const requestContract = { protocol: "global-conversation-create-v1", experience, model: model ?? null }
    const request = { kind, requestID, requestContract }
    let allocation = GlobalCreationAllocation.find(request)
    if (!allocation) {
      const { initialOverlay } = await preflight({ model, configSnapshot: await Config.getGlobal() })
      allocation = GlobalCreationAllocation.reserve({ ...request, resolutionSeed: { initialConfigOverlay: initialOverlay } })
    }

    async function readAccepted(current: ReturnType<typeof GlobalCreationAllocation.read>) {
      GlobalCreationAllocation.throwIfRejected(current)
      const accepted = GlobalCreationAllocation.acceptedTarget(current)
      if (!accepted) return undefined
      const session = await Session.get(accepted.targetID).catch((error) => {
        if (NotFoundError.isInstance(error as Error)) return undefined
        throw error
      })
      if (!session || session.projectID !== accepted.projectID || current.time_project_retained !== null) {
        throw new GlobalCreationAcceptedTargetUnavailableError({
          message: "The accepted global conversation is no longer retained.",
          kind, requestID, projectID: accepted.projectID, targetID: accepted.targetID, directory: current.directory,
        })
      }
      try {
        assertGlobalConversationCreationSession({
          kind, requestID, requestContract: current.request_contract, resolutionSeed: current.resolution_seed,
          initialConfigOverlay: current.accepted_initial_config_overlay, session,
        })
      } catch (cause) {
        throw new GlobalCreationAcceptedTargetConflictError({
          message: "The accepted global conversation has a different request identity.", kind, requestID, targetID: accepted.targetID,
        }, { cause })
      }
      return { session }
    }

    const accepted = await readAccepted(allocation)
    if (accepted) return accepted
    const allocationID = allocation.id
    const initialConfigOverlay = Config.Overlay.parse(allocation.resolution_seed.initialConfigOverlay)
    try {
      return await create({
        experience,
        sessionID,
        creationAllocation: allocation,
        initialConfigOverlay,
        creationMetadata: { globalConversationCreation: { version: 1, requestID } },
        commitInTransaction: (db, session) => GlobalCreationAllocation.acceptInTransaction(db, {
          allocationID, kind, projectID: session.projectID, targetID: session.id, acceptedAt: session.time.created,
        }),
      })
    } catch (error) {
      if (!isSqliteIdentityConstraintError(error)) throw error
      const winner = await readAccepted(GlobalCreationAllocation.read(allocationID))
      if (winner) return winner
      throw error
    }
  }
}
