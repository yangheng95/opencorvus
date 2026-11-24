import { joinServerBaseUrl, ServerBaseUrlError } from "@opencorvus-ai/transport-protocol"
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
  readonly serverUrl: string
}

function retainedServerUrl(requested: string, applied: string): string {
  if (requested === applied) return applied
  try {
    // The request builder defines the effective endpoint. Keep the existing
    // spelling for workspace and preference keys when that endpoint is equal.
    return joinServerBaseUrl(requested, "").href === joinServerBaseUrl(applied, "").href ? applied : requested
  } catch (error) {
    if (!(error instanceof ServerBaseUrlError)) throw error
    // The save transaction validates the requested URL, including when it
    // replaces an invalid address loaded from existing settings.
    return requested
  }
}

/** One admitted durable transaction for an operator's Connection Save. */
export async function saveConnectionSettings(input: ConnectionSettingsInput): Promise<ConnectionSettingsSaveReceipt> {
  const applied = settingsStore.serverUrl
  const requested = { ...input, serverUrl: retainedServerUrl(input.serverUrl, applied) }
  const authority = captureApiAuthority()
  const endpointChanged = requested.serverUrl !== applied
  const prepareDeparture = endpointChanged ? createWorkspaceDepartureIntent() : undefined
  const draftKey = workspaceComposerDraftKey(activeTaskID(), activeSessionID(), activeDirectory())
  let receipt: ConnectionSettingsSaveReceipt | undefined
  await saveSettings({
    overrides: requested,
    fields: endpointChanged ? ["serverUrl", "username", "password"] : ["username", "password"],
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
          onConfirmed: ({ serverUrl, username, password }) => {
            batch(() => {
              let retiredReferences = false
              if (close) {
                retiredReferences = commitDraft?.commit() ?? false
                retireComposerModel(true)
                setChatAttachments([])
                setAppStore("enginePaths", null)
                closeImagePreview()
                close.commit()
              } else if (
                username !== settingsStore.username ||
                password !== settingsStore.password
              ) {
                retireConnectionProjections(false)
                retireComposerModel(false)
              }
              setSettingsStore({ serverUrl, username, password })
              configure({ serverUrl, username, password, directory: activeDirectory() })
              receipt = { authority: captureApiAuthority(), retiredReferences, serverUrl }
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
  if (!receipt) throw new Error("Connection Save completed without a confirmed publication")
  return receipt
}
