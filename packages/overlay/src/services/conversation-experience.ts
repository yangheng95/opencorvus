import type { IconName } from "../components/ui/Icon"
import type { ConversationExperience } from "../store/conversation-session"
import { t } from "../utils/i18n"

export function conversationExperienceIcon(experience: ConversationExperience): IconName {
  return experience === "work" ? "work" : "message"
}

export function conversationExperienceLabel(experience: ConversationExperience): string {
  return experience === "work" ? t("work_ledger.kind.work") : t("work_ledger.kind.chat")
}

export function conversationExperienceDescription(experience: ConversationExperience): string {
  return experience === "work" ? t("work_ledger.kind_description.work") : t("work_ledger.kind_description.chat")
}
