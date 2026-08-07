import { appStore } from "../store/app"
import { apiJson } from "./api"
import type {
  ChatCapabilitySettings,
  ConversationCapabilityUpdate,
  WorkCapabilitySettings,
} from "@opencorvus-ai/sdk"

export type ConversationExperience = "chat" | "work"
export type ConversationCapabilityAssignment = ConversationCapabilityUpdate
export type ConversationCapabilitySettings = ChatCapabilitySettings | WorkCapabilitySettings
type SettingsByExperience = {
  chat: ChatCapabilitySettings
  work: WorkCapabilitySettings
}

function path(directory: string, experience: ConversationExperience) {
  const identity = directory.trim()
  if (!identity) throw new Error(`${experience} capability settings require a project directory`)
  return `${experience}/capability?${new URLSearchParams({ directory: identity }).toString()}`
}

export async function loadConversationCapability<Experience extends ConversationExperience>(
  directory: string,
  experience: Experience,
): Promise<SettingsByExperience[Experience]> {
  if (!appStore.connected) throw new Error(`Cannot load ${experience} capabilities while disconnected`)
  return await apiJson<SettingsByExperience[Experience]>(path(directory, experience))
}

export async function updateConversationCapability<Experience extends ConversationExperience>(
  directory: string,
  experience: Experience,
  assignment: ConversationCapabilityAssignment,
): Promise<SettingsByExperience[Experience]> {
  if (!appStore.connected) throw new Error(`Cannot update ${experience} capabilities while disconnected`)
  return await apiJson<SettingsByExperience[Experience]>(path(directory, experience), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(assignment),
  })
}
