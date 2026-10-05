import { batch } from "solid-js"
import { saveSettings, settingsStore, setSettingsStore } from "../store/settings"
import { activeTaskID, activeSessionID } from "../store/board"
import {
  captureApiAuthority,
  assertApiAuthorityCurrent,
  isApiAuthorityCurrent,
  configure,
  type ApiAuthority,
} from "./api"
import { activeDirectory, createWorkspaceDepartureIntent } from "./workspace"
import { prepareComposerDraftDeparture, workspaceComposerDraftKey } from "./composer-draft"
import { retireConnectionProjections } from "./connection-projection"
import { retireComposerModel } from "./composer-model"
import { closeImagePreview } from "./image-preview"
import { FileEditorAdmissionError } from "./file-workbench"
import { setConnectionStatus, setAppStore } from "../store/app"
import { setChatAttachments } from "../store/messages"

export interface ConnectionSettingsInput {
  serverUrl: string
  username: string
  password: string
}

export interface ConnectionSettingsSaveReceipt {
  readonly authority: ApiAuthority
  readonly retiredReferences: boolean
}

/** One admitted durable transaction for an operator's Connection Save. */
export async function saveConnectionSettings(input: ConnectionSettingsInput): Promise<ConnectionSettingsSaveReceipt> {
  const requested = { ...input }
  const authority = captureApiAuthority()
  const endpointChanged = requested.serverUrl !== settingsStore.serverUrl
  const prepareDeparture = endpointChanged ? createWorkspaceDepartureIntent() : undefined
  const draftKey = workspaceComposerDraftKey(activeTaskID(), activeSessionID(), activeDirectory())
  let confirmedAuthority: ApiAuthority | undefined
  let retiredReferences = false
  await saveSettings({
    overrides: requested,
    prepare: async () => {
      assertApiAuthorityCurrent(authority)
      const close = await prepareDeparture?.()
      try {
        const commitDraft = endpointChanged ? prepareComposerDraftDeparture(draftKey) : undefined
        return {
          overrides: endpointChanged
            ? {
                directory: "",
                savedDirectory: "",
                workspaceTaskID: "",
                workspaceDirectory: "",
                lastSelectedModel: "",
              }
            : undefined,
          assertCurrent: () => {
            assertApiAuthorityCurrent(authority)
            if (close && !close.isCurrent()) throw new FileEditorAdmissionError("superseded")
          },
          onConfirmed: () => {
            batch(() => {
              if (close) {
                retiredReferences = commitDraft?.commit() ?? false
                retireComposerModel(true)
                setChatAttachments([])
                setAppStore("enginePaths", null)
                closeImagePreview()
                close.commit()
              } else if (
                requested.username !== settingsStore.username ||
                requested.password !== settingsStore.password
              ) {
                retireConnectionProjections(false)
                retireComposerModel(false)
              }
              setSettingsStore(requested)
              configure({ ...requested, directory: activeDirectory() })
              confirmedAuthority = captureApiAuthority()
              if (endpointChanged || !isApiAuthorityCurrent(authority)) setConnectionStatus("connecting")
            })
            return undefined
          },
          release: () => {
            try {
              commitDraft?.release()
            } finally {
              close?.release()
            }
          },
        }
      } catch (error) {
        close?.release()
        throw error
      }
    },
  })
  if (!confirmedAuthority) throw new Error("Connection Save completed without a confirmed publication")
  return { authority: confirmedAuthority, retiredReferences }
}
